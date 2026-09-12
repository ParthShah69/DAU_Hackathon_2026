const { createHash, randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');
const { discoverProcess } = require('./process-discovery');
const { runMatch, getMatchRun } = require('./matching');
const { createRequirement } = require('./requirements');
const { createSupplyRequest, acceptRequest } = require('./requests');

const ASSISTANT_VERSION = 'carbonbridge-orchestrator-demo-v1';
const MAX_MESSAGE_LENGTH = 12000;

function hashPayload(payload) {
  return createHash('sha256').update(JSON.stringify(sortKeys(payload))).digest('hex');
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  return value;
}

function createConversation(store, { actorUserId, actorOrganizationId, title = 'CarbonBridge assistant' }) {
  const now = store.now();
  return store.insert('conversations', {
    id: `conversation-${randomUUID()}`,
    userId: actorUserId,
    organizationId: actorOrganizationId,
    title: String(title).slice(0, 120),
    state: 'active',
    context: {
      activeProcessId: null,
      activeDiscoveryCandidateIds: [],
      activeRequirementId: null,
      activeMatchRunId: null,
      activeMatchResultIds: [],
      activeRequestId: null,
      pendingActionId: null
    },
    createdAt: now,
    updatedAt: now,
    version: 1
  });
}

function getConversation(store, conversationId, actorOrganizationId) {
  const conversation = store.findOne('conversations', (item) => item.id === conversationId);
  if (!conversation) throw new DomainError('NOT_FOUND', `Conversation ${conversationId} was not found`, 404);
  if (conversation.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Conversation is outside the active organization', 403);
  return conversation;
}

function addMessage(store, conversation, role, content, metadata = {}) {
  return store.insert('messages', {
    id: `message-${randomUUID()}`,
    conversationId: conversation.id,
    organizationId: conversation.organizationId,
    role,
    content,
    metadata,
    createdAt: store.now()
  });
}

function detectIntent(text, context = {}) {
  const normalized = text.toLowerCase();
  if (
    /\b(system\s*override|drop\s*table|execute\s*sql|select\s*\*|insert\s*into|delete\s*from|union\s*select|sql\b)/i.test(normalized) ||
    /\b(ignore\s*(all\s*)?(previous|prior)\s*instructions|disregard\s*(all\s*)?(previous|prior)|jailbreak)\b/i.test(normalized) ||
    /\b(you\s*are\s*now|roleplay\s*as|act\s*as|pretend\s*to\s*be)\s*(systemadmin|admin|root|superuser|developer|god)\b/i.test(normalized) ||
    /\b(without\s*(user\s*)?(confirmation|approval|asking)|automatically\s*(approve|accept|commit|execute))\b/i.test(normalized) ||
    /\b(fetch\s*external\s*url|https?:\/\/|curl\b|wget\b|steal[- ]data|exfiltrat)/i.test(normalized)
  ) {
    return 'security_violation';
  }
  if (/^(yes|y|confirm|approve|approved|go ahead|do it|proceed|okay|ok)\b/.test(normalized)) return 'confirm_action';
  if (/\b(cancel|stop|never mind|discard)\b/.test(normalized)) return 'cancel_action';
  if (/(compare|side by side|which (one|option)|best deal|cheapest)/.test(normalized)) return 'compare_options';
  if (/\b(find|search|match|source|available|show|list|get|see)\b/.test(normalized) && /\b(co2|carbon|tonne|ton|requirement|listing|listings|option|options|supplier|suppliers|buyer|buyers|material|deal|deals|supply)\b/.test(normalized)) return 'find_matches';
  if (/(accept|decline|reject).*\brequest\b/.test(normalized)) return 'manage_request';
  if (/(\brequest\b|\breserve\b|send.*supplier|\bbuy\b|\bpurchase\b)/.test(normalized)) return 'prepare_request';
  if (/(requirement|we need|looking for|need \d|buying)/.test(normalized)) return 'create_requirement';
  if (context?.draftRequirement && (parsePeriod(normalized) || parseQuantity(normalized))) return 'create_requirement';
  if (/(list|publish|sell|marketplace|offer|draft)/.test(normalized) && /(process|output|co2|carbon|stream|material|listing)/.test(normalized)) return 'prepare_listing';
  if (/(process|produce|production|manufactur|generate|byproduct|waste|output|what can i sell|valuable)/.test(normalized)) return 'discover_process_outputs';
  if (/\b(explain|why|how|help|status|what did)\b/.test(normalized)) return 'explain_context';
  return 'clarify';
}

function parseQuantity(text) {
  const match = text.match(/(?:^|[^\w])(-?\d[\d,]*(?:\.\d+)?)\s*(?:metric\s*)?(?:tonnes?|tons?|t)\b/i);
  if (!match) return null;
  const num = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 && num <= 1000000 ? num : null;
}

function parsePurity(text) {
  const match = text.match(/(?:purity|minimum|min)\D{0,16}(\d+(?:\.\d+)?)\s*%/i);
  return match ? Number(match[1]) : null;
}

function parseBudget(text) {
  const match = text.match(/(?:budget|under|below|max(?:imum)?)\D{0,16}(?:₹|inr\s*)?([\d,]+(?:\.\d+)?)\s*(?:\/\s*t|per\s*(?:tonne|ton))?/i);
  return match ? Math.round(Number(match[1].replace(/,/g, '')) * 100) : null;
}

function parseDistance(text) {
  const match = text.match(/(?:within|distance|max(?:imum)?)\D{0,16}(\d+(?:\.\d+)?)\s*km/i);
  return match ? Number(match[1]) : null;
}

function parseForm(text) {
  const normalized = text.toLowerCase();
  if (/\bliquid\b/.test(normalized)) return ['liquid'];
  if (/\bsolid\b|powder/.test(normalized)) return ['solid'];
  return ['gas'];
}

function parsePeriod(text) {
  const monthRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(20\d{2})?\b/i;
  const month = text.match(monthRegex);
  if (!month) return null;
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthPrefix = month[1].toLowerCase().slice(0, 3);
  const index = monthNames.indexOf(monthPrefix);
  if (index === -1) return null;
  const year = Number(month[2] || 2026);
  const start = `${year}-${String(index + 1).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, index + 1, 0));
  const end = `${year}-${String(index + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`;
  return { start, end };
}

function latestOwned(store, collection, field, value) {
  return store.findMany(collection, (item) => item[field] === value).sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))[0] || null;
}

function resolveRequirement(store, conversation, actorOrganizationId, text) {
  const explicit = [...store.requirements].reverse().find((item) => text.includes(item.id));
  if (explicit && explicit.organizationId === actorOrganizationId) return explicit;
  if (conversation.context.activeRequirementId) {
    const active = store.findOne('requirements', (item) => item.id === conversation.context.activeRequirementId && item.organizationId === actorOrganizationId);
    if (active) return active;
  }
  return latestOwned(store, 'requirements', 'organizationId', actorOrganizationId);
}

function resolveMatchResult(store, conversation, text) {
  const results = conversation.context.activeMatchResultIds
    .map((id) => store.findOne('matchResults', (item) => item.id === id))
    .filter(Boolean);
  const explicit = results.find((result) => text.includes(result.id) || text.includes(result.streamId));
  if (explicit) return explicit;
  const ordinal = text.match(/\b(first|second|third|1st|2nd|3rd)\b/i);
  if (ordinal) {
    const index = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2 }[ordinal[1].toLowerCase()];
    if (results[index]) return results[index];
  }
  return results.find((result) => result.status === 'compatible') || results[0] || null;
}

function createAction(store, { conversation, actorUserId, operation, payload, riskClass = 'externally_visible', summary, now = new Date() }) {
  const action = store.insert('actions', {
    id: `action-${randomUUID()}`,
    organizationId: conversation.organizationId,
    actorUserId,
    conversationId: conversation.id,
    operation,
    payload,
    payloadHash: hashPayload(payload),
    riskClass,
    status: 'awaiting_approval',
    requiresApproval: true,
    summary,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    result: null,
    error: null,
    version: 1
  });
  conversation.context.pendingActionId = action.id;
  conversation.updatedAt = now.toISOString();
  return action;
}

function actionCard(action) {
  return {
    type: 'action_preview',
    actionId: action.id,
    operation: action.operation,
    riskClass: action.riskClass,
    summary: action.summary,
    payload: action.payload,
    expiresAt: action.expiresAt,
    requiresApproval: action.requiresApproval,
    instruction: 'Reply with “confirm” to execute this exact action, or “cancel” to discard it.'
  };
}

function appendAudit(store, { actorUserId, organizationId, action, event, before = null, after = null }) {
  store.insert('auditEvents', {
    id: `audit-${randomUUID()}`,
    actorUserId,
    organizationId,
    actionId: action.id,
    event,
    before,
    after,
    createdAt: store.now()
  });
}

function executeAction(store, action, { actorUserId, actorOrganizationId }) {
  if (action.actorUserId !== actorUserId || action.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Only the action creator can approve this action', 403);
  if (hashPayload(action.payload) !== action.payloadHash) {
    store.replace('actions', action.id, { status: 'failed', error: { code: 'ACTION_TAMPERED', message: 'Action payload no longer matches its approval hash' }, version: Number(action.version || 1) + 1 });
    throw new DomainError('ACTION_TAMPERED', 'This action preview no longer matches the approved payload; prepare it again', 409);
  }
  if (action.status === 'succeeded') return structuredClone(action);
  if (action.status !== 'awaiting_approval') throw new DomainError('ACTION_NOT_APPROVABLE', `Action is ${action.status}`);
  if (new Date(action.expiresAt) <= new Date()) {
    store.replace('actions', action.id, { status: 'expired', version: action.version + 1 });
    throw new DomainError('ACTION_EXPIRED', 'This action preview expired; prepare a fresh preview');
  }

  const before = structuredClone(action);
  try {
    let result;
    if (action.operation === 'create_requirement') {
      result = createRequirement(store, { actorOrganizationId, payload: action.payload, now: new Date() });
    } else if (action.operation === 'create_listing_draft') {
      const process = store.findOne('processes', (item) => item.id === action.payload.processId && item.organizationId === actorOrganizationId);
      const candidate = store.findOne('discoveryCandidates', (item) => item.id === action.payload.discoveryCandidateId && item.organizationId === actorOrganizationId);
      if (!process || !candidate) throw new DomainError('NOT_FOUND', 'Discovery opportunity is no longer available', 404);
      result = store.insert('listingDrafts', {
        id: `listing-draft-${randomUUID()}`,
        organizationId: actorOrganizationId,
        processId: process.id,
        discoveryCandidateId: candidate.id,
        material: candidate.material,
        title: candidate.label,
        state: 'draft',
        quantityTonnes: null,
        quality: null,
        evidenceStatus: 'missing',
        canPublish: false,
        createdAt: store.now(),
        updatedAt: store.now(),
        version: 1
      });
    } else if (action.operation === 'submit_supply_request') {
      const selectedResult = store.findOne('matchResults', (item) => item.id === action.payload.matchResultId);
      if (!selectedResult) throw new DomainError('MATCH_STALE', 'The saved match result is no longer available; refresh matches', 409);
      const period = store.findOne('supplyPeriods', (item) => item.id === selectedResult.supplyPeriodId);
      result = createSupplyRequest(store, {
        actorUserId,
        actorOrganizationId,
        payload: { ...action.payload, expectedSupplyVersion: action.payload.expectedSupplyVersion ?? period?.version ?? 1 },
        idempotencyKey: `assistant-action:${action.id}`,
        now: new Date()
      });
    } else if (action.operation === 'accept_supply_request') {
      const request = store.findOne('supplyRequests', (item) => item.id === action.payload.requestId);
      if (!request) throw new DomainError('NOT_FOUND', 'Supply request is no longer available', 404);
      result = acceptRequest(store, {
        actorUserId,
        actorOrganizationId,
        requestId: request.id,
        expectedVersion: action.payload.expectedVersion ?? request.version,
        expectedSupplyVersion: action.payload.expectedSupplyVersion ?? request.expectedSupplyVersion,
        idempotencyKey: `assistant-action:${action.id}`,
        now: new Date()
      });
    } else {
      throw new DomainError('UNSUPPORTED_ACTION', `Operation ${action.operation} is not supported by this prototype`);
    }
    const updated = store.replace('actions', action.id, { status: 'succeeded', result, error: null, version: action.version + 1, completedAt: store.now() });
    appendAudit(store, { actorUserId, organizationId: actorOrganizationId, action, event: 'succeeded', before, after: updated });
    return updated;
  } catch (error) {
    const code = error.code || 'ACTION_FAILED';
    const failed = store.replace('actions', action.id, { status: 'failed', error: { code, message: error.message }, version: action.version + 1 });
    appendAudit(store, { actorUserId, organizationId: actorOrganizationId, action, event: 'failed', before, after: failed });
    throw error;
  }
}

function buildResponse(text, cards = [], extra = {}) {
  return { text, cards, ...extra };
}

function pendingAction(store, conversation) {
  return conversation.context.pendingActionId
    ? store.findOne('actions', (item) => item.id === conversation.context.pendingActionId)
    : null;
}

function getContextStatus(conversation) {
  return {
    activeProcessId: conversation.context.activeProcessId,
    activeRequirementId: conversation.context.activeRequirementId,
    activeMatchRunId: conversation.context.activeMatchRunId,
    activeRequestId: conversation.context.activeRequestId,
    pendingActionId: conversation.context.pendingActionId
  };
}

function orchestrateMessage(store, { conversationId, actorUserId, actorOrganizationId, text, now = new Date(), plan = null }) {
  const conversation = getConversation(store, conversationId, actorOrganizationId);
  const content = String(text || '').trim();
  requireValue(content, 'message');
  if (content.length > MAX_MESSAGE_LENGTH) throw new DomainError('MESSAGE_TOO_LARGE', `Message is limited to ${MAX_MESSAGE_LENGTH} characters`);
  const userMessage = addMessage(store, conversation, 'user', content);
  const intent = plan?.intent || detectIntent(content, conversation.context);
  const toolArgs = plan?.arguments || {};
  const workflow = store.insert('workflows', {
    id: `workflow-${randomUUID()}`,
    conversationId,
    organizationId: actorOrganizationId,
    intent,
    state: 'running',
    startedAt: now.toISOString(),
    completedAt: null,
    provider: plan ? 'ollama-agent' : 'heuristic-demo',
    assistantVersion: ASSISTANT_VERSION,
    stepIds: [],
    plan: plan || null
  });
  let response;
  let state = 'completed';
  try {
    if (intent === 'security_violation') {
      response = buildResponse('Security policy: CarbonBridge strictly blocks arbitrary code/SQL execution, external URL calls, and prompt injection attempts. All operations operate strictly within your authenticated workspace.', [], { needsInput: true });
    } else if (intent === 'confirm_action') {
      const action = pendingAction(store, conversation);
      if (!action) {
        response = buildResponse('There is no pending action to confirm. Ask me to prepare a listing, requirement, or supply request first.', [], { needsInput: true });
      } else {
        const executed = executeAction(store, action, { actorUserId, actorOrganizationId });
        conversation.context.pendingActionId = null;
        if (executed.operation === 'create_requirement') conversation.context.activeRequirementId = executed.result.id;
        if (executed.operation === 'submit_supply_request') conversation.context.activeRequestId = executed.result.id;
        response = buildResponse(`Done. ${action.summary}`, [{ type: 'action_receipt', actionId: action.id, status: executed.status, operation: executed.operation, result: executed.result }], { receipt: executed.result });
      }
    } else if (intent === 'cancel_action') {
      const action = pendingAction(store, conversation);
      if (!action) response = buildResponse('There is no pending action to cancel.', [], { needsInput: true });
      else {
        const cancelled = store.replace('actions', action.id, { status: 'rejected', version: action.version + 1, completedAt: now.toISOString() });
        conversation.context.pendingActionId = null;
        appendAudit(store, { actorUserId, organizationId: actorOrganizationId, action, event: 'rejected', before: action, after: cancelled });
        response = buildResponse('Cancelled. No marketplace record was changed.', [{ type: 'action_receipt', actionId: action.id, status: 'rejected', operation: action.operation }]);
      }
    } else if (intent === 'discover_process_outputs') {
      const description = toolArgs.description || content;
      const result = discoverProcess(store, { actorOrganizationId, description, now });
      conversation.context.activeProcessId = result.process.id;
      conversation.context.activeDiscoveryCandidateIds = result.candidates.map((candidate) => candidate.id);
      response = buildResponse(`I found ${result.candidates.length} possible output${result.candidates.length === 1 ? '' : 's'} to review. They are hypotheses until you add measured quantity and evidence.`, [{ type: 'process_discovery', ...result }], { context: getContextStatus(conversation) });
    } else if (intent === 'prepare_listing') {
      const targetProcessId = toolArgs.processId || conversation.context.activeProcessId;
      if (!targetProcessId) {
        response = buildResponse('First describe the process that creates the output. I will identify candidate resources before preparing a listing.', [], { needsInput: true, missingFields: ['process description'] });
      } else {
        const candidateId = toolArgs.discoveryCandidateId || conversation.context.activeDiscoveryCandidateIds[0];
        const candidate = store.findOne('discoveryCandidates', (item) => item.id === candidateId && item.organizationId === actorOrganizationId);
        if (!candidate) throw new DomainError('NOT_FOUND', 'The discovery opportunity is no longer available', 404);
        const action = createAction(store, { conversation, actorUserId, operation: 'create_listing_draft', riskClass: 'reversible_private', payload: { processId: targetProcessId, discoveryCandidateId: candidate.id }, summary: `Prepare a draft for “${candidate.label}”` , now });
        state = 'waiting_for_approval';
        response = buildResponse('I prepared a draft action. The draft will stay private and cannot publish until its quantity and evidence are complete.', [actionCard(action)], { waitingForApproval: true });
      }
    } else if (intent === 'create_requirement') {
      const existingDraft = conversation.context.draftRequirement || {};
      const parsedQty = parseQuantity(content);
      const quantity = (typeof toolArgs.quantityTonnes === 'number' && toolArgs.quantityTonnes > 0)
        ? toolArgs.quantityTonnes
        : (parsedQty ?? existingDraft.quantityTonnes);
      const parsedPeriodVal = parsePeriod(content);
      const period = (toolArgs.periodStart && toolArgs.periodEnd)
        ? { start: toolArgs.periodStart, end: toolArgs.periodEnd }
        : (parsedPeriodVal ?? existingDraft.period);
      const missingFields = [];
      if (Array.isArray(plan?.missingFields) && plan.missingFields.length > 0) {
        missingFields.push(...plan.missingFields);
      } else {
        if (!quantity) missingFields.push('quantity in tonnes');
        if (!period) missingFields.push('delivery period, for example October 2026');
      }
      if (missingFields.length > 0) {
        conversation.context.draftRequirement = {
          quantityTonnes: quantity || null,
          period: period || null,
          minimumPurityMolPct: (typeof toolArgs.minimumPurityMolPct === 'number') ? toolArgs.minimumPurityMolPct : (parsePurity(content) ?? existingDraft.minimumPurityMolPct),
          acceptableForms: (Array.isArray(toolArgs.acceptableForms) && toolArgs.acceptableForms.length > 0) ? toolArgs.acceptableForms : (content.toLowerCase().includes('liquid') || content.toLowerCase().includes('solid') ? parseForm(content) : existingDraft.acceptableForms),
          maxDistanceKm: (typeof toolArgs.maxDistanceKm === 'number') ? toolArgs.maxDistanceKm : (parseDistance(content) ?? existingDraft.maxDistanceKm),
          maxDeliveredPaisePerTonne: (typeof toolArgs.maxDeliveredPaisePerTonne === 'number') ? toolArgs.maxDeliveredPaisePerTonne : (parseBudget(content) ?? existingDraft.maxDeliveredPaisePerTonne)
        };
        conversation.updatedAt = now.toISOString();
        response = buildResponse('I can create the buyer requirement, but I need a little more information.', [{ type: 'missing_fields', fields: missingFields, examples: { quantity: '100 tonnes', period: 'October 2026', purity: 'at least 95%' } }], { needsInput: true, missingFields });
      } else {
        conversation.context.draftRequirement = null;
        const payload = {
          name: 'Assistant-created buyer requirement',
          siteId: 'site-buyer',
          periodStart: period.start,
          periodEnd: period.end,
          quantityTonnes: quantity,
          minimumPurityMolPct: (typeof toolArgs.minimumPurityMolPct === 'number') ? toolArgs.minimumPurityMolPct : (parsePurity(content) ?? existingDraft.minimumPurityMolPct ?? 0),
          acceptableForms: (Array.isArray(toolArgs.acceptableForms) && toolArgs.acceptableForms.length > 0) ? toolArgs.acceptableForms : (content.toLowerCase().includes('liquid') || content.toLowerCase().includes('solid') ? parseForm(content) : (existingDraft.acceptableForms ?? ['gas'])),
          maxDistanceKm: (typeof toolArgs.maxDistanceKm === 'number') ? toolArgs.maxDistanceKm : (parseDistance(content) ?? existingDraft.maxDistanceKm ?? null),
          maxDeliveredPaisePerTonne: (typeof toolArgs.maxDeliveredPaisePerTonne === 'number') ? toolArgs.maxDeliveredPaisePerTonne : (parseBudget(content) ?? existingDraft.maxDeliveredPaisePerTonne ?? null),
          limits: []
        };
        const action = createAction(store, { conversation, actorUserId, operation: 'create_requirement', riskClass: 'reversible_private', payload, summary: `Create a ${quantity} tonne buyer requirement for ${period.start} to ${period.end}`, now });
        state = 'waiting_for_approval';
        response = buildResponse('Here is the requirement I extracted. Confirm it to save an editable draft.', [actionCard(action)], { waitingForApproval: true });
      }
    } else if (intent === 'find_matches') {
      const explicitReq = toolArgs.requirementId ? store.findOne('requirements', (item) => item.id === toolArgs.requirementId && item.organizationId === actorOrganizationId) : null;
      const requirement = explicitReq || resolveRequirement(store, conversation, actorOrganizationId, content);
      if (!requirement) {
        const publishedStreams = store.findMany('streams', (stream) => stream.state === 'published');
        response = buildResponse(`I found ${publishedStreams.length} published supplier listing${publishedStreams.length === 1 ? '' : 's'} in the marketplace. To match and calculate delivered prices for your exact needs, tell me your required quantity and delivery period (e.g. “need 100 tonnes in October 2026”).`, [{ type: 'marketplace_overview', count: publishedStreams.length, listings: publishedStreams.slice(0, 3).map((s) => ({ id: s.id, name: s.name, form: s.physicalForm })) }], { needsInput: true });
      } else {
        const result = runMatch(store, { requirementId: requirement.id, actorOrganizationId, now });
        conversation.context.activeRequirementId = requirement.id;
        conversation.context.activeMatchRunId = result.run.id;
        conversation.context.activeMatchResultIds = result.results.map((item) => item.id);
        response = buildResponse(`I evaluated ${result.results.length} published options. ${result.groups.compatible.length} are compatible, ${result.groups.needsEvidence.length} need evidence, and ${result.groups.incompatible.length} are incompatible.`, [{ type: 'match_results', ...result }], { context: getContextStatus(conversation) });
      }
    } else if (intent === 'compare_options') {
      if (!conversation.context.activeMatchRunId) {
        response = buildResponse('Run a match first, then ask me to compare the options.', [], { needsInput: true });
      } else {
        const match = getMatchRun(store, conversation.context.activeMatchRunId, actorOrganizationId);
        const results = match.results.filter((item) => item.status === 'compatible').slice(0, 3);
        response = buildResponse(`Here are ${results.length} compatible options compared using the same requirement and rate-card version.`, [{ type: 'comparison', matchRunId: match.run.id, options: results, notes: ['Ranking uses deterministic stored checks and delivered-cost assumptions.', 'A comparison is decision support, not a certification or quote.'] }]);
      }
    } else if (intent === 'prepare_request') {
      const requirement = resolveRequirement(store, conversation, actorOrganizationId, content);
      if (!requirement) {
        response = buildResponse('Create or select a buyer requirement first so I can prepare a request with exact terms.', [], { needsInput: true });
      } else {
        const match = conversation.context.activeMatchRunId ? getMatchRun(store, conversation.context.activeMatchRunId, actorOrganizationId) : runMatch(store, { requirementId: requirement.id, actorOrganizationId, now });
        const targetSearch = toolArgs.target || toolArgs.selection || content;
        const result = resolveMatchResult(store, conversation, String(targetSearch)) || match.results.find((item) => item.status === 'compatible');
        if (!result || result.status !== 'compatible') {
          response = buildResponse('I could not prepare a request because there is no currently compatible option. I can show the evidence gaps and failed checks.', [{ type: 'match_results', ...match }], { needsInput: true });
        } else {
          conversation.context.activeRequirementId = requirement.id;
          conversation.context.activeMatchRunId = match.run.id;
          conversation.context.activeMatchResultIds = match.results.map((item) => item.id);
          const action = createAction(store, {
            conversation,
            actorUserId,
            operation: 'submit_supply_request',
            payload: {
              requirementId: requirement.id,
              streamId: result.streamId,
              matchResultId: result.id,
              quantityTonnes: requirement.quantityTonnes,
              expectedRequirementVersion: Number(requirement.version || 1),
              expectedSupplyVersion: Number(store.findOne('supplyPeriods', (period) => period.id === result.supplyPeriodId)?.version || 1),
              expectedDeliveredPaisePerTonne: result.economics?.deliveredPaisePerTonne ?? null
            },
            summary: `Submit a ${requirement.quantityTonnes} tonne request to ${result.streamName}`,
            now
          });
          state = 'waiting_for_approval';
          response = buildResponse('I prepared the exact supply request. Review the supplier, period, quantity and delivered estimate, then confirm.', [actionCard(action), { type: 'decision_receipt_preview', requirement, selectedOption: result }], { waitingForApproval: true });
        }
      }
    } else if (intent === 'manage_request') {
      const explicitRequestId = toolArgs.requestId;
      const request = [...store.supplyRequests].reverse().find((item) => item.id === explicitRequestId || item.id === conversation.context.activeRequestId || content.includes(item.id));
      if (!request) response = buildResponse('I could not find a request to manage in this conversation.', [], { needsInput: true });
      else if (toolArgs.action === 'accept' || /\baccept/.test(content.toLowerCase())) {
        const period = store.findOne('supplyPeriods', (item) => item.id === request.supplyPeriodId);
        const action = createAction(store, {
          conversation,
          actorUserId,
          operation: 'accept_supply_request',
          riskClass: 'commercial_privileged',
          payload: { requestId: request.id, expectedVersion: Number(request.version || 1), expectedSupplyVersion: Number(period?.version || 1) },
          summary: `Accept request ${request.id} and reserve ${request.quantityTonnes} tonnes`,
          now
        });
        state = 'waiting_for_approval';
        response = buildResponse('This reserves supply for the request. Review the reservation preview and confirm only if the terms are correct.', [actionCard(action)], { waitingForApproval: true });
      } else response = buildResponse(`Request ${request.id} is currently ${request.status}.`, [{ type: 'request_status', request }]);
    } else if (intent === 'explain_context') {
      const action = pendingAction(store, conversation);
      response = buildResponse('I keep the current process, requirement, match run and pending approval in this conversation. I use the marketplace services for calculations and writes, so a chat answer cannot bypass ownership or quality rules.', action ? [actionCard(action)] : [], { context: getContextStatus(conversation) });
    } else {
      const missingFields = Array.isArray(plan?.missingFields) ? plan.missingFields : [];
      if (missingFields.length > 0) {
        response = buildResponse('I need a few more details to proceed.', [{ type: 'missing_fields', fields: missingFields }], { needsInput: true, missingFields });
      } else {
        response = buildResponse('I can discover outputs from a process, prepare a listing draft, create a buyer requirement, find and compare supply, or prepare a request. Tell me what you want to do in your own words.', [{ type: 'capabilities', actions: ['discover_process_outputs', 'prepare_listing', 'create_requirement', 'find_matches', 'compare_options', 'prepare_request'] }], { needsInput: true });
      }
    }
  } catch (error) {
    state = 'failed';
    const failedAction = pendingAction(store, conversation);
    if (failedAction && failedAction.status === 'failed') conversation.context.pendingActionId = null;
    response = buildResponse(error.message, [{ type: 'error', code: error.code || 'ASSISTANT_ERROR', retryable: false }], { failed: true });
  }

  const assistantMessage = addMessage(store, conversation, 'assistant', response.text, { intent, cards: response.cards, context: getContextStatus(conversation) });
  store.replace('workflows', workflow.id, { state, completedAt: store.now(), outputMessageId: assistantMessage.id });
  conversation.updatedAt = store.now();
  conversation.version += 1;
  return {
    conversationId,
    workflowId: workflow.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    intent: {
      name: intent,
      confidence: plan ? 0.95 : 0.86,
      provider: plan ? 'ollama-agent' : 'heuristic-demo',
      schemaVersion: 'intent-v1',
      plan: plan || null
    },
    state,
    response,
    context: getContextStatus(conversation)
  };
}

function getConversationTranscript(store, conversationId, actorOrganizationId) {
  const conversation = getConversation(store, conversationId, actorOrganizationId);
  return {
    conversation: structuredClone(conversation),
    messages: structuredClone(store.findMany('messages', (item) => item.conversationId === conversationId)),
    workflows: structuredClone(store.findMany('workflows', (item) => item.conversationId === conversationId))
  };
}

module.exports = {
  ASSISTANT_VERSION,
  createConversation,
  getConversation,
  getConversationTranscript,
  orchestrateMessage,
  executeAction,
  actionCard,
  detectIntent
};
