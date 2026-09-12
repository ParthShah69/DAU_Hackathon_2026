const { randomUUID } = require('node:crypto');
const { Store } = require('./infra/store');
const { DomainError } = require('./domain/errors');
const { actorFromRequest, requireRole, tokenFromRequest } = require('./infra/auth');
const { discoverProcess, getProcess } = require('./domain/process-discovery');
const { runMatch, getMatchRun } = require('./domain/matching');
const { createRequirement, listRequirements, getRequirement } = require('./domain/requirements');
const { listDrafts, getDraftDetail, patchListingDraft } = require('./domain/listing-drafts');
const { createConversation, getConversationTranscript, orchestrateMessage, executeAction } = require('./domain/assistant');
const { narrateEvidenceBoundOutput, providerStatus } = require('./infra/ollama-provider');
const { createListing, getListing, patchListing, publishListing, archiveListing, listListings } = require('./domain/listings');
const { patchRequirement } = require('./domain/requirements');
const { getRequest, listRequests, createSupplyRequest, acceptRequest, transitionRequest, decisionReceipt, alternativeBuyers, requestFromListing } = require('./domain/requests');
const { register, login, logout, listDemoActors, sessionCookie, organizationKind } = require('./domain/accounts');
const ngo = require('./domain/ngo');
const {
  addParticipation,
  listParticipations: listExtensionParticipations,
  addReview,
  listReviews,
  listPolicies,
  createScreening,
  getScreening,
  knowledgeSearch,
  searchPrices,
  listNotifications,
  markNotificationRead,
  notificationPreferences,
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  report,
  workflow,
  workflowTransition
} = require('./domain/extensions');

const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
]);

function allowedOrigin(request) {
  const origin = request?.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  return 'http://localhost:5173';
}

function corsHeaders(request, extra = {}) {
  return {
    'access-control-allow-origin': allowedOrigin(request),
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-demo-user, x-demo-organization, x-request-id, idempotency-key',
    vary: 'Origin',
    ...extra
  };
}

function jsonResponse(res, statusCode, payload, requestId, request, extraHeaders = {}) {
  const body = JSON.stringify({ data: payload, requestId });
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-request-id': requestId,
    ...corsHeaders(request),
    ...extraHeaders
  });
  res.end(body);
}

function sseEvent(response, event, payload) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    let tooLarge = false;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (tooLarge) return reject(new DomainError('PAYLOAD_TOO_LARGE', 'JSON body is limited to 1 MiB', 413));
      if (!body.trim()) return resolve({});
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Body must be a JSON object');
        resolve(parsed);
      } catch (error) {
        reject(new DomainError('INVALID_JSON', error.message, 400));
      }
    });
    request.on('error', reject);
  });
}

function listingSummary(store, stream) {
  const period = store.findMany('supplyPeriods', (item) => item.streamId === stream.id).sort((left, right) => left.start.localeCompare(right.start))[0] || null;
  const site = store.findOne('sites', (item) => item.id === stream.siteId);
  const quality = store.findMany('qualityReports', (item) => item.streamId === stream.id).sort((left, right) => String(right.sampledAt).localeCompare(String(left.sampledAt)))[0] || null;
  return {
    id: stream.id,
    name: stream.name,
    supplierOrganizationId: stream.organizationId,
    sourceIndustry: stream.sourceIndustry,
    physicalForm: stream.physicalForm,
    co2Origin: stream.co2Origin,
    state: stream.state,
    version: Number(stream.version || 1),
    createdAt: stream.createdAt || null,
    updatedAt: stream.updatedAt || null,
    location: { city: site?.city || null },
    supply: period ? { id: period.id, start: period.start, end: period.end, totalTonnes: period.totalTonnes, reservedTonnes: period.reservedTonnes, remainingTonnes: String(Number(period.totalTonnes) - Number(period.reservedTonnes)), minimumOrderTonnes: period.minimumOrderTonnes, listedPricePaisePerTonne: period.listedPricePaisePerTonne, currency: period.currency } : null,
    quality: quality ? { id: quality.id, purityMolPct: quality.purityMolPct, basis: quality.basis, sampledAt: quality.sampledAt, expiresAt: quality.expiresAt, evidenceStatus: quality.evidenceStatus } : null,
    synthetic: Boolean(stream.synthetic)
  };
}

function listingDetail(store, stream) {
  const summary = listingSummary(store, stream);
  const quality = store.findOne('qualityReports', (item) => item.id === summary.quality?.id);
  return {
    ...summary,
    quality: quality ? { ...summary.quality, analytes: store.findMany('analyteResults', (item) => item.qualityReportId === quality.id) } : null,
    source: { kind: stream.synthetic ? 'synthetic_demo' : 'organization_provided', label: stream.synthetic ? 'Fictional demonstration data' : 'Organization-provided data' }
  };
}

function publicCapabilities() {
  return {
    assistantVersion: 'carbonbridge-orchestrator-demo-v1',
    provider: 'heuristic-demo',
    typedTools: [
      { name: 'discover_process_outputs', mode: 'read', riskClass: 'read_calculation' },
      { name: 'search_matches', mode: 'read', riskClass: 'read_calculation' },
      { name: 'compare_options', mode: 'read', riskClass: 'read_calculation' },
      { name: 'create_requirement', mode: 'write', riskClass: 'reversible_private', approval: 'required' },
      { name: 'create_listing_draft', mode: 'write', riskClass: 'reversible_private', approval: 'required' },
      { name: 'submit_supply_request', mode: 'write', riskClass: 'externally_visible', approval: 'required' },
      { name: 'accept_supply_request', mode: 'write', riskClass: 'commercial_privileged', approval: 'required' }
    ],
    safety: ['No arbitrary SQL, shell, URL or code execution tool is exposed', 'AI output is a proposal; deterministic services own values and writes', 'External or commercial actions require an exact action preview and confirmation']
  };
}

async function enrichAssistantOutput(store, output) {
  const enhanced = await narrateEvidenceBoundOutput(output);
  if (enhanced.applied) {
    store.replace('messages', output.assistantMessageId, {
      content: enhanced.output.response.text,
      metadata: { intent: enhanced.output.intent.name, cards: enhanced.output.response.cards, context: enhanced.output.context, provenance: enhanced.output.response.provenance }
    });
  }
  return enhanced.output;
}

function createApp({ store = new Store(), persistence = null } = {}) {
  store = persistence?.store || store;
  const persistenceStatus = {
    live: () => (typeof persistence?.live === 'function' ? persistence.live() : true),
    ready: () => (typeof persistence?.ready === 'function' ? persistence.ready() : true)
  };
  return async function handle(request, response) {
    const requestId = request.headers['x-request-id'] || randomUUID();
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, corsHeaders(request));
        response.end();
        return;
      }
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname.replace(/\/$/, '') || '/';
      if (request.method === 'GET' && (path === '/healthz' || path === '/api/v1/health' || path === '/health/live' || path === '/api/v1/health/live')) {
        jsonResponse(response, 200, { status: 'ok', service: 'carbonbridge-api', mode: 'prototype', seed: store.seedSource }, requestId, request);
        return;
      }
      if (request.method === 'GET' && (path === '/health/ready' || path === '/api/v1/health/ready')) {
        if (!persistenceStatus.ready()) {
          jsonResponse(response, 503, { status: 'not_ready', service: 'carbonbridge-api' }, requestId, request);
          return;
        }
        jsonResponse(response, 200, { status: 'ready', service: 'carbonbridge-api', persistence: 'available' }, requestId, request);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/demo/seed') {
        if (process.env.NODE_ENV === 'production') throw new DomainError('DISABLED_IN_PRODUCTION', 'Demo seed reset is disabled in production', 403);
        const snapshot = store.reset();
        // Extension-domain records are intentionally in-memory too, so a demo reset
        // returns the whole API to its seeded baseline.
        delete store.__carbonBridgeExtensions;
        jsonResponse(response, 200, { status: 'seeded', source: snapshot.source, counts: Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'source').map(([key, value]) => [key, value.length])) }, requestId, request);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/auth/register') {
        const body = await readJson(request);
        const result = register(store, body);
        jsonResponse(response, 201, result, requestId, request, { 'set-cookie': sessionCookie(result.session.token) });
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/auth/login') {
        const body = await readJson(request);
        const result = login(store, body);
        jsonResponse(response, 200, result, requestId, request, { 'set-cookie': sessionCookie(result.session.token) });
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/auth/logout') {
        const extracted = tokenFromRequest(request);
        jsonResponse(response, 200, logout(store, extracted.token), requestId, request, { 'set-cookie': sessionCookie('', { clear: true }) });
        return;
      }
      if (request.method === 'GET' && path === '/api/v1/auth/demo-actors') {
        jsonResponse(response, 200, { items: listDemoActors(store) }, requestId, request);
        return;
      }

      const actor = actorFromRequest(store, request);

      if (request.method === 'GET' && path === '/api/v1/me') {
        const kind = organizationKind(actor.organization);
        jsonResponse(response, 200, {
          user: { id: actor.user.id, displayName: actor.user.displayName, email: actor.user.email || null, externalSubject: actor.user.externalSubject },
          currentOrganization: { id: actor.organization.id, name: actor.organization.name, kind, capabilities: actor.organization.capabilities, status: actor.organization.status },
          memberships: store.findMany('memberships', (membership) => membership.userId === actor.userId).map((membership) => ({ organizationId: membership.organizationId, roles: membership.roles })),
          capabilities: actor.roles,
          organizationKind: kind,
          sites: store.findMany('sites', (site) => site.organizationId === actor.organizationId).map((site) => ({ id: site.id, label: site.label, city: site.city })),
          session: { authenticated: true, method: actor.sessionMethod || 'demo-header' }
        }, requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/assistant/capabilities') {
        jsonResponse(response, 200, publicCapabilities(), requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/dashboard') {
        const ownedStreams = store.findMany('streams', (stream) => stream.organizationId === actor.organizationId);
        const ownedRequirements = store.findMany('requirements', (requirement) => requirement.organizationId === actor.organizationId);
        const requests = store.findMany('supplyRequests', (item) => item.buyerOrganizationId === actor.organizationId || item.supplierOrganizationId === actor.organizationId);
        const supplyPeriods = store.findMany('supplyPeriods', (period) => ownedStreams.some((stream) => stream.id === period.streamId));
        jsonResponse(response, 200, {
          organizationId: actor.organizationId,
          counts: {
            listings: ownedStreams.length,
            publishedListings: ownedStreams.filter((stream) => stream.state === 'published').length,
            listingDrafts: ownedStreams.filter((stream) => stream.state === 'draft').length + store.findMany('listingDrafts', (draft) => draft.organizationId === actor.organizationId).length,
            requirements: ownedRequirements.length,
            requests: requests.length,
            pendingRequests: requests.filter((item) => item.status === 'pending_supplier').length,
            activeReservations: store.findMany('reservations', (reservation) => reservation.status === 'active' && supplyPeriods.some((period) => period.id === reservation.supplyPeriodId)).length,
            ...ngo.ngoDashboardCounts(store, actor)
          },
          availability: { totalTonnes: supplyPeriods.reduce((sum, period) => sum + Number(period.totalTonnes || 0), 0), reservedTonnes: supplyPeriods.reduce((sum, period) => sum + Number(period.reservedTonnes || 0), 0) },
          source: store.seedSource
        }, requestId, request);
        return;
      }

      if (request.method === 'GET' && (path === '/api/v1/marketplace/listings' || path === '/api/v1/listings')) {
        const state = url.searchParams.get('state') || 'published';
        const sourceIndustry = url.searchParams.get('sourceIndustry') || null;
        const listings = listListings(store, {
          actorOrganizationId: actor.organizationId,
          state,
          sourceIndustry,
          q: url.searchParams.get('q'),
          physicalForm: url.searchParams.get('physicalForm'),
          minPurityMolPct: url.searchParams.get('minPurityMolPct'),
          availableFrom: url.searchParams.get('availableFrom'),
          availableTo: url.searchParams.get('availableTo')
        }).map((stream) => listingSummary(store, stream));
        jsonResponse(response, 200, { items: listings, count: listings.length, asOf: store.now(), source: store.seedSource }, requestId, request);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/listings') {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        const stream = createListing(store, { actorOrganizationId: actor.organizationId, payload: body, now: new Date() });
        jsonResponse(response, 201, listingDetail(store, stream), requestId, request);
        return;
      }

      const listingMatch = path.match(/^\/api\/v1\/listings\/([^/]+)$/);
      if (request.method === 'GET' && listingMatch) {
        const stream = getListing(store, listingMatch[1], actor.organizationId);
        jsonResponse(response, 200, listingDetail(store, stream), requestId, request);
        return;
      }
      if (request.method === 'PATCH' && listingMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        const stream = patchListing(store, { listingId: listingMatch[1], actorOrganizationId: actor.organizationId, payload: body, now: new Date() });
        jsonResponse(response, 200, listingDetail(store, stream), requestId, request);
        return;
      }
      const listingPublishMatch = path.match(/^\/api\/v1\/listings\/([^/]+)\/publish$/);
      if (request.method === 'POST' && listingPublishMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        const stream = publishListing(store, { listingId: listingPublishMatch[1], actorOrganizationId: actor.organizationId, expectedVersion: body.version ?? body.expectedVersion ?? body.expected_version, now: new Date() });
        jsonResponse(response, 200, listingDetail(store, stream), requestId, request);
        return;
      }
      const listingArchiveMatch = path.match(/^\/api\/v1\/listings\/([^/]+)\/archive$/);
      if (request.method === 'POST' && listingArchiveMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        const stream = archiveListing(store, { listingId: listingArchiveMatch[1], actorOrganizationId: actor.organizationId, expectedVersion: body.version ?? body.expectedVersion ?? body.expected_version, now: new Date() });
        jsonResponse(response, 200, listingDetail(store, stream), requestId, request);
        return;
      }
      const listingRequestMatch = path.match(/^\/api\/v1\/listings\/([^/]+)\/request$/);
      if (request.method === 'POST' && listingRequestMatch) {
        requireRole(actor, ['org_admin', 'buyer_editor']);
        const body = await readJson(request);
        const created = requestFromListing(store, {
          actorUserId: actor.userId,
          actorOrganizationId: actor.organizationId,
          listingId: listingRequestMatch[1],
          payload: body,
          idempotencyKey: request.headers['idempotency-key'],
          now: new Date()
        });
        jsonResponse(response, 201, created, requestId, request);
        return;
      }
      const listingAlternativesMatch = path.match(/^\/api\/v1\/listings\/([^/]+)\/alternative-buyers$/);
      if (request.method === 'POST' && listingAlternativesMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor', 'viewer']);
        jsonResponse(response, 200, alternativeBuyers(store, { listingId: listingAlternativesMatch[1], actorOrganizationId: actor.organizationId, now: new Date() }), requestId, request);
        return;
      }

      if (path === '/api/v1/listing-drafts' && request.method === 'GET') {
        requireRole(actor, ['org_admin', 'supplier_editor', 'viewer']);
        jsonResponse(response, 200, { items: listDrafts(store, actor.organizationId) }, requestId, request);
        return;
      }
      const listingDraftMatch = path.match(/^\/api\/v1\/listing-drafts\/([^/]+)$/);
      if (request.method === 'GET' && listingDraftMatch) {
        jsonResponse(response, 200, getDraftDetail(store, listingDraftMatch[1], actor.organizationId), requestId, request);
        return;
      }
      if (request.method === 'PATCH' && listingDraftMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        jsonResponse(response, 200, patchListingDraft(store, { draftId: listingDraftMatch[1], actorOrganizationId: actor.organizationId, payload: body, now: new Date() }), requestId, request);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/processes/discover') {
        requireRole(actor, ['org_admin', 'supplier_editor', 'buyer_editor']);
        const body = await readJson(request);
        jsonResponse(response, 200, discoverProcess(store, { actorOrganizationId: actor.organizationId, description: body.description, structured: body.structured, processId: body.processId, now: new Date() }), requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/processes') {
        requireRole(actor, ['org_admin', 'supplier_editor', 'buyer_editor', 'viewer']);
        const processes = store.findMany('processes', (item) => item.organizationId === actor.organizationId).map((process) => ({
          ...structuredClone(process),
          candidates: store.findMany('discoveryCandidates', (candidate) => candidate.processId === process.id)
        }));
        jsonResponse(response, 200, { items: processes }, requestId, request);
        return;
      }

      const processMatch = path.match(/^\/api\/v1\/processes\/([^/]+)$/);
      if (request.method === 'GET' && processMatch) {
        jsonResponse(response, 200, getProcess(store, processMatch[1], actor.organizationId), requestId, request);
        return;
      }

      if (path === '/api/v1/requirements' && request.method === 'GET') {
        requireRole(actor, ['org_admin', 'buyer_editor', 'viewer']);
        jsonResponse(response, 200, { items: listRequirements(store, actor.organizationId) }, requestId, request);
        return;
      }
      if (path === '/api/v1/requirements' && request.method === 'POST') {
        requireRole(actor, ['org_admin', 'buyer_editor']);
        const body = await readJson(request);
        jsonResponse(response, 201, createRequirement(store, { actorOrganizationId: actor.organizationId, payload: body, state: body.state === 'draft' ? 'draft' : 'published', now: new Date() }), requestId, request);
        return;
      }
      const requirementMatch = path.match(/^\/api\/v1\/requirements\/([^/]+)$/);
      if (request.method === 'GET' && requirementMatch) {
        jsonResponse(response, 200, getRequirement(store, requirementMatch[1], actor.organizationId), requestId, request);
        return;
      }
      if (request.method === 'PATCH' && requirementMatch) {
        requireRole(actor, ['org_admin', 'buyer_editor']);
        const body = await readJson(request);
        jsonResponse(response, 200, patchRequirement(store, { requirementId: requirementMatch[1], actorOrganizationId: actor.organizationId, payload: body, now: new Date() }), requestId, request);
        return;
      }

      if (request.method === 'POST' && (path === '/api/v1/matches/run' || path === '/api/v1/match-runs')) {
        requireRole(actor, ['org_admin', 'buyer_editor', 'viewer']);
        const body = await readJson(request);
        const requestedRequirementId = body.requirementId ?? body.requirement_id;
        const currentRequirement = store.findOne('requirements', (item) => item.id === requestedRequirementId && item.organizationId === actor.organizationId);
        if (body.expectedRequirementVersion !== undefined || body.expected_requirement_version !== undefined) {
          const expected = body.expectedRequirementVersion ?? body.expected_requirement_version;
          if (!currentRequirement || Number(expected) !== Number(currentRequirement.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Requirement changed; refresh it before matching', 409);
        }
        jsonResponse(response, 200, runMatch(store, { requirementId: requestedRequirementId, actorOrganizationId: actor.organizationId, now: new Date() }), requestId, request);
        return;
      }
      const matchRunMatch = path.match(/^\/api\/v1\/(?:matches|match-runs)\/([^/]+)$/);
      if (request.method === 'GET' && matchRunMatch) {
        jsonResponse(response, 200, getMatchRun(store, matchRunMatch[1], actor.organizationId), requestId, request);
        return;
      }
      const scenarioMatch = path.match(/^\/api\/v1\/(?:matches|match-runs)\/([^/]+)\/scenarios$/);
      if (request.method === 'POST' && scenarioMatch) {
        requireRole(actor, ['org_admin', 'buyer_editor', 'viewer']);
        const body = await readJson(request);
        const original = store.findOne('matchRuns', (item) => item.id === scenarioMatch[1] && item.requesterOrganizationId === actor.organizationId);
        if (!original) throw new DomainError('NOT_FOUND', 'Match run was not found', 404);
        const requirement = store.findOne('requirements', (item) => item.id === original.requirementId && item.organizationId === actor.organizationId);
        if (!requirement) throw new DomainError('NOT_FOUND', 'Requirement was not found', 404);
        const overrides = body.overrides || body;
        const allowed = ['quantityTonnes', 'quantity_t', 'minimumPurityMolPct', 'minimum_purity', 'maxDistanceKm', 'max_distance_km', 'maxDeliveredPaisePerTonne', 'max_delivered_paise_per_tonne', 'acceptableForms', 'acceptable_forms'];
        const scenarioRequirement = { ...structuredClone(requirement) };
        for (const key of allowed) {
          if (Object.prototype.hasOwnProperty.call(overrides, key)) {
            const canonical = { quantity_t: 'quantityTonnes', minimum_purity: 'minimumPurityMolPct', max_distance_km: 'maxDistanceKm', max_delivered_paise_per_tonne: 'maxDeliveredPaisePerTonne', acceptable_forms: 'acceptableForms' }[key] || key;
            scenarioRequirement[canonical] = overrides[key];
          }
        }
        const result = runMatch(store, { requirementId: requirement.id, actorOrganizationId: actor.organizationId, requirementOverride: scenarioRequirement, scenarioOf: original.id, now: new Date() });
        result.run.scenario = true;
        result.run.scenarioOf = original.id;
        jsonResponse(response, 201, result, requestId, request);
        return;
      }
      const receiptMatch = path.match(/^\/api\/v1\/(?:matches|match-runs)\/([^/]+)\/receipt$/);
      if (request.method === 'GET' && receiptMatch) {
        jsonResponse(response, 200, decisionReceipt(store, { runId: receiptMatch[1], actorOrganizationId: actor.organizationId }), requestId, request);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/conversations') {
        const body = await readJson(request);
        jsonResponse(response, 201, createConversation(store, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId, title: body.title }), requestId, request);
        return;
      }
      const conversationMatch = path.match(/^\/api\/v1\/conversations\/([^/]+)$/);
      if (request.method === 'GET' && conversationMatch) {
        jsonResponse(response, 200, getConversationTranscript(store, conversationMatch[1], actor.organizationId), requestId, request);
        return;
      }
      const conversationStreamMatch = path.match(/^\/api\/v1\/conversations\/([^/]+)\/messages\/stream$/);
      if (request.method === 'POST' && conversationStreamMatch) {
        const body = await readJson(request);
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-store',
          connection: 'keep-alive',
          'x-request-id': requestId,
          ...corsHeaders(request)
        });
        sseEvent(response, 'workflow.started', { conversationId: conversationStreamMatch[1], requestId });
        try {
          const output = await enrichAssistantOutput(store, orchestrateMessage(store, { conversationId: conversationStreamMatch[1], actorUserId: actor.userId, actorOrganizationId: actor.organizationId, text: body.message || body.text, now: new Date() }));
          sseEvent(response, 'assistant.result', output);
          sseEvent(response, 'workflow.completed', { workflowId: output.workflowId, state: output.state });
        } catch (error) {
          sseEvent(response, 'workflow.failed', { code: error.code || 'ASSISTANT_ERROR', message: error.message });
        }
        response.end();
        return;
      }
      const conversationMessageMatch = path.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/);
      if (request.method === 'POST' && conversationMessageMatch) {
        const body = await readJson(request);
        jsonResponse(response, 200, await enrichAssistantOutput(store, orchestrateMessage(store, { conversationId: conversationMessageMatch[1], actorUserId: actor.userId, actorOrganizationId: actor.organizationId, text: body.message || body.text, now: new Date() })), requestId, request);
        return;
      }

      const actionMatch = path.match(/^\/api\/v1\/actions\/([^/]+)$/);
      if (request.method === 'GET' && actionMatch) {
        const action = store.findOne('actions', (item) => item.id === actionMatch[1] && item.organizationId === actor.organizationId);
        if (!action) throw new DomainError('NOT_FOUND', 'Action was not found', 404);
        jsonResponse(response, 200, action, requestId, request);
        return;
      }
      const actionApproveMatch = path.match(/^\/api\/v1\/actions\/([^/]+)\/approve$/);
      if (request.method === 'POST' && actionApproveMatch) {
        const action = store.findOne('actions', (item) => item.id === actionApproveMatch[1]);
        if (!action) throw new DomainError('NOT_FOUND', 'Action was not found', 404);
        jsonResponse(response, 200, executeAction(store, action, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId }), requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/requests') {
        const requests = listRequests(store, actor.organizationId);
        jsonResponse(response, 200, { items: requests }, requestId, request);
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/requests') {
        requireRole(actor, ['org_admin', 'buyer_editor']);
        const body = await readJson(request);
        const responseData = createSupplyRequest(store, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId, payload: body, idempotencyKey: request.headers['idempotency-key'], now: new Date() });
        jsonResponse(response, 201, responseData, requestId, request);
        return;
      }
      const requestMatch = path.match(/^\/api\/v1\/requests\/([^/]+)$/);
      if (request.method === 'GET' && requestMatch) {
        const supplyRequest = getRequest(store, requestMatch[1], actor.organizationId);
        jsonResponse(response, 200, { ...supplyRequest, events: store.findMany('requestEvents', (item) => item.requestId === supplyRequest.id), reservation: supplyRequest.reservationId ? store.findOne('reservations', (item) => item.id === supplyRequest.reservationId) : null }, requestId, request);
        return;
      }
      const requestAcceptMatch = path.match(/^\/api\/v1\/requests\/([^/]+)\/accept$/);
      if (request.method === 'POST' && requestAcceptMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        const result = acceptRequest(store, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId, requestId: requestAcceptMatch[1], expectedVersion: body.version ?? body.expectedVersion ?? body.expected_version, expectedSupplyVersion: body.supplyVersion ?? body.expectedSupplyVersion ?? body.expected_supply_version, idempotencyKey: request.headers['idempotency-key'], now: new Date() });
        jsonResponse(response, 200, result, requestId, request);
        return;
      }
      const requestDeclineMatch = path.match(/^\/api\/v1\/requests\/([^/]+)\/decline$/);
      if (request.method === 'POST' && requestDeclineMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        jsonResponse(response, 200, transitionRequest(store, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId, requestId: requestDeclineMatch[1], expectedVersion: body.version ?? body.expectedVersion ?? body.expected_version, idempotencyKey: request.headers['idempotency-key'], transition: 'decline', now: new Date() }), requestId, request);
        return;
      }
      const requestCancelMatch = path.match(/^\/api\/v1\/requests\/([^/]+)\/cancel$/);
      if (request.method === 'POST' && requestCancelMatch) {
        requireRole(actor, ['org_admin', 'buyer_editor']);
        const body = await readJson(request);
        jsonResponse(response, 200, transitionRequest(store, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId, requestId: requestCancelMatch[1], expectedVersion: body.version ?? body.expectedVersion ?? body.expected_version, idempotencyKey: request.headers['idempotency-key'], transition: 'cancel', now: new Date() }), requestId, request);
        return;
      }
      if (request.method === 'GET' && path === '/api/v1/activity') {
        jsonResponse(response, 200, { items: store.findMany('auditEvents', (item) => item.organizationId === actor.organizationId) }, requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/projects') {
        jsonResponse(response, 200, { items: ngo.listProjects(store, { actor, kind: url.searchParams.get('kind') }) }, requestId, request);
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/projects') {
        const body = await readJson(request);
        jsonResponse(response, 201, ngo.createProject(store, { actor, payload: body, now: new Date() }), requestId, request);
        return;
      }
      const projectPublishMatch = path.match(/^\/api\/v1\/projects\/([^/]+)\/publish$/);
      if (request.method === 'POST' && projectPublishMatch) {
        jsonResponse(response, 200, ngo.publishProject(store, { actor, projectId: projectPublishMatch[1], now: new Date() }), requestId, request);
        return;
      }
      const projectMatch = path.match(/^\/api\/v1\/projects\/([^/]+)$/);
      if (request.method === 'GET' && projectMatch) {
        jsonResponse(response, 200, ngo.getProject(store, { actor, projectId: projectMatch[1] }), requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/balance-requests') {
        jsonResponse(response, 200, { items: ngo.listBalanceRequests(store, { actor }) }, requestId, request);
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/balance-requests') {
        const body = await readJson(request);
        jsonResponse(response, 201, ngo.createBalanceRequest(store, { actor, payload: body, now: new Date() }), requestId, request);
        return;
      }
      const balanceOfferMatch = path.match(/^\/api\/v1\/balance-requests\/([^/]+)\/offer$/);
      if (request.method === 'POST' && balanceOfferMatch) {
        const body = await readJson(request);
        jsonResponse(response, 200, ngo.offerBalanceSupport(store, { actor, requestId: balanceOfferMatch[1], payload: body, now: new Date() }), requestId, request);
        return;
      }
      const balanceAcceptMatch = path.match(/^\/api\/v1\/balance-requests\/([^/]+)\/accept$/);
      if (request.method === 'POST' && balanceAcceptMatch) {
        jsonResponse(response, 200, ngo.acceptBalanceSupport(store, { actor, requestId: balanceAcceptMatch[1], now: new Date() }), requestId, request);
        return;
      }
      const balanceDeclineMatch = path.match(/^\/api\/v1\/balance-requests\/([^/]+)\/decline$/);
      if (request.method === 'POST' && balanceDeclineMatch) {
        jsonResponse(response, 200, ngo.declineBalanceSupport(store, { actor, requestId: balanceDeclineMatch[1], now: new Date() }), requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/participations') {
        jsonResponse(response, 200, { items: ngo.listParticipations(store, { actor }) }, requestId, request);
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/participations') {
        const body = await readJson(request);
        jsonResponse(response, 201, ngo.createParticipation(store, { actor, payload: body, now: new Date() }), requestId, request);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/appreciations') {
        jsonResponse(response, 200, { items: ngo.listAppreciations(store, { organizationId: url.searchParams.get('organizationId'), actor }) }, requestId, request);
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/appreciations') {
        const body = await readJson(request);
        jsonResponse(response, 201, ngo.createAppreciation(store, { actor, payload: body, now: new Date() }), requestId, request);
        return;
      }
      if (request.method === 'GET' && path === '/api/v1/assistant/provider') {
        jsonResponse(response, 200, await providerStatus(), requestId);
        return;
      }

      // Nested review/participation remain on the extension domain used by the
      // existing NGO catalog screens; published projects themselves are served above.
      const isNgo = actor.organization.capabilities?.includes('ngo') || actor.organization.kind === 'ngo';
      const participationMatch = path.match(/^\/api\/v1\/projects\/([^/]+)\/participations$/);
      if (participationMatch && request.method === 'GET') {
        if (!isNgo) throw new DomainError('FORBIDDEN', 'Projects are available to NGO organizations', 403);
        jsonResponse(response, 200, { items: listExtensionParticipations(store, participationMatch[1], actor.organizationId) }, requestId, request);
        return;
      }
      if (participationMatch && request.method === 'POST') {
        if (!isNgo) throw new DomainError('FORBIDDEN', 'Projects are available to NGO organizations', 403);
        requireRole(actor, ['org_admin', 'reviewer', 'ngo_editor']);
        jsonResponse(response, 201, addParticipation(store, { projectId: participationMatch[1], organizationId: actor.organizationId, userId: actor.userId, payload: await readJson(request) }), requestId, request);
        return;
      }
      const reviewMatch = path.match(/^\/api\/v1\/projects\/([^/]+)\/review$/);
      if (reviewMatch && request.method === 'GET') {
        if (!isNgo) throw new DomainError('FORBIDDEN', 'Project reviews are available to NGO organizations', 403);
        jsonResponse(response, 200, { items: listReviews(store, reviewMatch[1], actor.organizationId) }, requestId, request);
        return;
      }
      if (reviewMatch && request.method === 'POST') {
        if (!isNgo) throw new DomainError('FORBIDDEN', 'Project reviews are available to NGO organizations', 403);
        requireRole(actor, ['org_admin', 'reviewer', 'ngo_editor']);
        jsonResponse(response, 201, addReview(store, { projectId: reviewMatch[1], organizationId: actor.organizationId, userId: actor.userId, payload: await readJson(request) }), requestId, request);
        return;
      }
      if (path === '/api/v1/review' && request.method === 'GET') {
        if (!isNgo) throw new DomainError('FORBIDDEN', 'Reviews are available to NGO organizations', 403);
        jsonResponse(response, 200, { items: listReviews(store, url.searchParams.get('projectId'), actor.organizationId) }, requestId);
        return;
      }
      if (path === '/api/v1/review' && request.method === 'POST') {
        if (!isNgo) throw new DomainError('FORBIDDEN', 'Reviews are available to NGO organizations', 403);
        requireRole(actor, ['org_admin', 'reviewer']);
        const body = await readJson(request);
        jsonResponse(response, 201, addReview(store, { projectId: body.projectId, organizationId: actor.organizationId, userId: actor.userId, payload: body }), requestId);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/policies') {
        jsonResponse(response, 200, { items: listPolicies({ jurisdiction: url.searchParams.get('jurisdiction'), mechanism: url.searchParams.get('mechanism'), asOf: url.searchParams.get('asOf') }) }, requestId);
        return;
      }
      if (request.method === 'POST' && path === '/api/v1/screenings') {
        requireRole(actor, ['org_admin', 'reviewer', 'buyer_editor', 'supplier_editor']);
        jsonResponse(response, 201, createScreening(store, { organizationId: actor.organizationId, userId: actor.userId, payload: await readJson(request) }), requestId);
        return;
      }
      const screeningMatch = path.match(/^\/api\/v1\/screenings\/([^/]+)$/);
      if (request.method === 'GET' && screeningMatch) {
        jsonResponse(response, 200, getScreening(store, screeningMatch[1], actor.organizationId), requestId);
        return;
      }
      if (request.method === 'GET' && path === '/api/v1/knowledge/search') {
        requireRole(actor, ['org_admin', 'reviewer', 'buyer_editor', 'supplier_editor', 'viewer']);
        jsonResponse(response, 200, { items: knowledgeSearch({ query: url.searchParams.get('q') || url.searchParams.get('query'), limit: url.searchParams.get('limit') }) }, requestId);
        return;
      }
      if (request.method === 'GET' && path === '/api/v1/price-observations') {
        jsonResponse(response, 200, { items: searchPrices({ material: url.searchParams.get('material'), geography: url.searchParams.get('geography'), observationType: url.searchParams.get('observationType'), freshness: url.searchParams.get('freshness') || 'current' }), provenance: 'synthetic_demo' }, requestId);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/notifications') {
        jsonResponse(response, 200, { items: listNotifications(store, actor.organizationId) }, requestId);
        return;
      }
      const notificationReadMatch = path.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
      if (request.method === 'POST' && notificationReadMatch) {
        jsonResponse(response, 200, markNotificationRead(store, notificationReadMatch[1], actor.organizationId), requestId);
        return;
      }
      if (path === '/api/v1/notification-preferences') {
        if (request.method === 'GET') { jsonResponse(response, 200, notificationPreferences(store, actor.organizationId), requestId); return; }
        if (request.method === 'PATCH') { jsonResponse(response, 200, notificationPreferences(store, actor.organizationId, await readJson(request)), requestId); return; }
      }
      if (path === '/api/v1/saved-searches') {
        if (request.method === 'GET') { jsonResponse(response, 200, { items: listSavedSearches(store, actor.organizationId) }, requestId); return; }
        if (request.method === 'POST') { jsonResponse(response, 201, createSavedSearch(store, { organizationId: actor.organizationId, userId: actor.userId, payload: await readJson(request) }), requestId); return; }
      }
      const savedSearchMatch = path.match(/^\/api\/v1\/saved-searches\/([^/]+)$/);
      if (request.method === 'DELETE' && savedSearchMatch) { deleteSavedSearch(store, savedSearchMatch[1], actor.organizationId); response.writeHead(204, { 'access-control-allow-origin': 'http://localhost:5173', 'x-request-id': requestId }); response.end(); return; }
      if (request.method === 'GET' && path === '/api/v1/reports') {
        requireRole(actor, ['org_admin', 'reviewer', 'buyer_editor', 'supplier_editor', 'viewer']);
        jsonResponse(response, 200, report(store, actor.organizationId), requestId);
        return;
      }
      const workflowMatch = path.match(/^\/api\/v1\/workflows\/([^/]+)$/);
      if (request.method === 'GET' && workflowMatch) { jsonResponse(response, 200, workflow(store, workflowMatch[1], actor.organizationId), requestId); return; }
      const workflowTransitionMatch = path.match(/^\/api\/v1\/workflows\/([^/]+)\/(resume|cancel)$/);
      if (request.method === 'POST' && workflowTransitionMatch) { jsonResponse(response, 200, workflowTransition(store, { id: workflowTransitionMatch[1], organizationId: actor.organizationId, transition: workflowTransitionMatch[2] }), requestId); return; }

      throw new DomainError('NOT_FOUND', 'Route was not found', 404);
    } catch (error) {
      const status = error instanceof DomainError ? error.statusCode : 500;
      const code = error instanceof DomainError ? error.code : 'INTERNAL_ERROR';
      if (status >= 500) console.error(`[${requestId}]`, error);
      jsonResponse(response, status, { error: { code, message: error.message, details: error.details } }, requestId, request);
    }
  };
}

module.exports = { createApp, listingSummary, listingDetail };
