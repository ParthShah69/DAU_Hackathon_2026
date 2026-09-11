const { randomUUID } = require('node:crypto');
const { Store } = require('./infra/store');
const { DomainError } = require('./domain/errors');
const { actorFromRequest, requireRole } = require('./infra/auth');
const { discoverProcess, getProcess } = require('./domain/process-discovery');
const { runMatch, getMatchRun } = require('./domain/matching');
const { createRequirement, listRequirements, getRequirement } = require('./domain/requirements');
const { listDrafts, getDraftDetail, patchListingDraft } = require('./domain/listing-drafts');
const { createConversation, getConversationTranscript, orchestrateMessage, executeAction } = require('./domain/assistant');

const MAX_BODY_BYTES = 1024 * 1024;

function jsonResponse(res, statusCode, payload, requestId) {
  const body = JSON.stringify({ data: payload, requestId });
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': 'http://localhost:5173',
    vary: 'Origin',
    'x-request-id': requestId
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

function createApp({ store = new Store() } = {}) {
  return async function handle(request, response) {
    const requestId = request.headers['x-request-id'] || randomUUID();
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'access-control-allow-origin': 'http://localhost:5173', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'content-type,x-demo-user,x-demo-organization,x-request-id' });
        response.end();
        return;
      }
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname.replace(/\/$/, '') || '/';
      if (request.method === 'GET' && (path === '/healthz' || path === '/api/v1/health')) {
        jsonResponse(response, 200, { status: 'ok', service: 'carbonbridge-api', mode: 'prototype', seed: store.seedSource }, requestId);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/demo/seed') {
        if (process.env.NODE_ENV === 'production') throw new DomainError('DISABLED_IN_PRODUCTION', 'Demo seed reset is disabled in production', 403);
        const snapshot = store.reset();
        jsonResponse(response, 200, { status: 'seeded', source: snapshot.source, counts: Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'source').map(([key, value]) => [key, value.length])) }, requestId);
        return;
      }

      const actor = actorFromRequest(store, request);

      if (request.method === 'GET' && path === '/api/v1/assistant/capabilities') {
        jsonResponse(response, 200, publicCapabilities(), requestId);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/marketplace/listings') {
        const state = url.searchParams.get('state') || 'published';
        const sourceIndustry = url.searchParams.get('sourceIndustry');
        const listings = store.findMany('streams', (stream) => stream.state === state && (!sourceIndustry || stream.sourceIndustry === sourceIndustry)).map((stream) => listingSummary(store, stream));
        jsonResponse(response, 200, { items: listings, count: listings.length, asOf: store.now(), source: store.seedSource }, requestId);
        return;
      }

      const listingMatch = path.match(/^\/api\/v1\/listings\/([^/]+)$/);
      if (request.method === 'GET' && listingMatch) {
        const stream = store.findOne('streams', (item) => item.id === listingMatch[1]);
        if (!stream || stream.state !== 'published') throw new DomainError('NOT_FOUND', 'Listing was not found', 404);
        jsonResponse(response, 200, listingDetail(store, stream), requestId);
        return;
      }

      if (path === '/api/v1/listing-drafts' && request.method === 'GET') {
        requireRole(actor, ['org_admin', 'supplier_editor', 'viewer']);
        jsonResponse(response, 200, { items: listDrafts(store, actor.organizationId) }, requestId);
        return;
      }
      const listingDraftMatch = path.match(/^\/api\/v1\/listing-drafts\/([^/]+)$/);
      if (request.method === 'GET' && listingDraftMatch) {
        jsonResponse(response, 200, getDraftDetail(store, listingDraftMatch[1], actor.organizationId), requestId);
        return;
      }
      if (request.method === 'PATCH' && listingDraftMatch) {
        requireRole(actor, ['org_admin', 'supplier_editor']);
        const body = await readJson(request);
        jsonResponse(response, 200, patchListingDraft(store, { draftId: listingDraftMatch[1], actorOrganizationId: actor.organizationId, payload: body, now: new Date() }), requestId);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/processes/discover') {
        requireRole(actor, ['org_admin', 'supplier_editor', 'buyer_editor']);
        const body = await readJson(request);
        jsonResponse(response, 200, discoverProcess(store, { actorOrganizationId: actor.organizationId, description: body.description, structured: body.structured, processId: body.processId, now: new Date() }), requestId);
        return;
      }

      const processMatch = path.match(/^\/api\/v1\/processes\/([^/]+)$/);
      if (request.method === 'GET' && processMatch) {
        jsonResponse(response, 200, getProcess(store, processMatch[1], actor.organizationId), requestId);
        return;
      }

      if (path === '/api/v1/requirements' && request.method === 'GET') {
        requireRole(actor, ['org_admin', 'buyer_editor', 'viewer']);
        jsonResponse(response, 200, { items: listRequirements(store, actor.organizationId) }, requestId);
        return;
      }
      if (path === '/api/v1/requirements' && request.method === 'POST') {
        requireRole(actor, ['org_admin', 'buyer_editor']);
        const body = await readJson(request);
        jsonResponse(response, 201, createRequirement(store, { actorOrganizationId: actor.organizationId, payload: body, state: body.state === 'draft' ? 'draft' : 'published', now: new Date() }), requestId);
        return;
      }
      const requirementMatch = path.match(/^\/api\/v1\/requirements\/([^/]+)$/);
      if (request.method === 'GET' && requirementMatch) {
        jsonResponse(response, 200, getRequirement(store, requirementMatch[1], actor.organizationId), requestId);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/matches/run') {
        requireRole(actor, ['org_admin', 'buyer_editor', 'viewer']);
        const body = await readJson(request);
        jsonResponse(response, 200, runMatch(store, { requirementId: body.requirementId, actorOrganizationId: actor.organizationId, now: new Date() }), requestId);
        return;
      }
      const matchRunMatch = path.match(/^\/api\/v1\/matches\/([^/]+)$/);
      if (request.method === 'GET' && matchRunMatch) {
        jsonResponse(response, 200, getMatchRun(store, matchRunMatch[1], actor.organizationId), requestId);
        return;
      }

      if (request.method === 'POST' && path === '/api/v1/conversations') {
        const body = await readJson(request);
        jsonResponse(response, 201, createConversation(store, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId, title: body.title }), requestId);
        return;
      }
      const conversationMatch = path.match(/^\/api\/v1\/conversations\/([^/]+)$/);
      if (request.method === 'GET' && conversationMatch) {
        jsonResponse(response, 200, getConversationTranscript(store, conversationMatch[1], actor.organizationId), requestId);
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
          'access-control-allow-origin': 'http://localhost:5173'
        });
        sseEvent(response, 'workflow.started', { conversationId: conversationStreamMatch[1], requestId });
        try {
          const output = orchestrateMessage(store, { conversationId: conversationStreamMatch[1], actorUserId: actor.userId, actorOrganizationId: actor.organizationId, text: body.message || body.text, now: new Date() });
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
        jsonResponse(response, 200, orchestrateMessage(store, { conversationId: conversationMessageMatch[1], actorUserId: actor.userId, actorOrganizationId: actor.organizationId, text: body.message || body.text, now: new Date() }), requestId);
        return;
      }

      const actionMatch = path.match(/^\/api\/v1\/actions\/([^/]+)$/);
      if (request.method === 'GET' && actionMatch) {
        const action = store.findOne('actions', (item) => item.id === actionMatch[1] && item.organizationId === actor.organizationId);
        if (!action) throw new DomainError('NOT_FOUND', 'Action was not found', 404);
        jsonResponse(response, 200, action, requestId);
        return;
      }
      const actionApproveMatch = path.match(/^\/api\/v1\/actions\/([^/]+)\/approve$/);
      if (request.method === 'POST' && actionApproveMatch) {
        const action = store.findOne('actions', (item) => item.id === actionApproveMatch[1]);
        if (!action) throw new DomainError('NOT_FOUND', 'Action was not found', 404);
        jsonResponse(response, 200, executeAction(store, action, { actorUserId: actor.userId, actorOrganizationId: actor.organizationId }), requestId);
        return;
      }

      if (request.method === 'GET' && path === '/api/v1/requests') {
        const requests = store.findMany('supplyRequests', (item) => item.buyerOrganizationId === actor.organizationId || item.supplierOrganizationId === actor.organizationId);
        jsonResponse(response, 200, { items: requests }, requestId);
        return;
      }
      const requestMatch = path.match(/^\/api\/v1\/requests\/([^/]+)$/);
      if (request.method === 'GET' && requestMatch) {
        const supplyRequest = store.findOne('supplyRequests', (item) => item.id === requestMatch[1] && (item.buyerOrganizationId === actor.organizationId || item.supplierOrganizationId === actor.organizationId));
        if (!supplyRequest) throw new DomainError('NOT_FOUND', 'Request was not found', 404);
        jsonResponse(response, 200, { ...supplyRequest, events: store.findMany('requestEvents', (item) => item.requestId === supplyRequest.id), reservation: supplyRequest.reservationId ? store.findOne('reservations', (item) => item.id === supplyRequest.reservationId) : null }, requestId);
        return;
      }
      if (request.method === 'GET' && path === '/api/v1/activity') {
        jsonResponse(response, 200, { items: store.findMany('auditEvents', (item) => item.organizationId === actor.organizationId) }, requestId);
        return;
      }

      throw new DomainError('NOT_FOUND', 'Route was not found', 404);
    } catch (error) {
      const status = error instanceof DomainError ? error.statusCode : 500;
      const code = error instanceof DomainError ? error.code : 'INTERNAL_ERROR';
      if (status >= 500) console.error(`[${requestId}]`, error);
      jsonResponse(response, status, { error: { code, message: error.message, details: error.details } }, requestId);
    }
  };
}

module.exports = { createApp, listingSummary, listingDetail };
