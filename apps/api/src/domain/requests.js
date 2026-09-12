const { createHash, randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');
const { runMatch } = require('./matching');
const { createRequirement, getRequirement } = require('./requirements');

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(sortKeys(value))).digest('hex');
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  return value;
}

function requireIdempotency(store, { actorUserId, actorOrganizationId, operation, key, payload }) {
  const value = String(key || '').trim();
  if (!value || value.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide a unique Idempotency-Key for this mutation', 422);
  const bodyHash = stableHash(payload);
  const existing = store.findOne('idempotencyRecords', (record) => record.actorUserId === actorUserId && record.organizationId === actorOrganizationId && record.operation === operation && record.key === value);
  if (existing) {
    if (existing.bodyHash !== bodyHash) throw new DomainError('IDEMPOTENCY_CONFLICT', 'The same Idempotency-Key was used with different terms', 409);
    return existing.response;
  }
  return null;
}

function saveIdempotency(store, { actorUserId, actorOrganizationId, operation, key, payload, response }) {
  store.insert('idempotencyRecords', { id: `idempotency-${randomUUID()}`, actorUserId, organizationId: actorOrganizationId, operation, key: String(key), bodyHash: stableHash(payload), response: structuredClone(response), createdAt: store.now() });
}

function getRequest(store, requestId, actorOrganizationId, now = new Date()) {
  const request = store.findOne('supplyRequests', (item) => item.id === requestId);
  if (!request || (request.buyerOrganizationId !== actorOrganizationId && request.supplierOrganizationId !== actorOrganizationId)) throw new DomainError('NOT_FOUND', 'Request was not found', 404);
  if (request.status === 'pending_supplier' && request.expiresAt && new Date(request.expiresAt) <= now) {
    const expired = store.replace('supplyRequests', request.id, { status: 'expired', version: Number(request.version || 1) + 1, updatedAt: store.now() });
    store.insert('requestEvents', { id: `request-event-${randomUUID()}`, requestId: request.id, actorUserId: null, event: 'expired', createdAt: store.now() });
    return expired;
  }
  return request;
}

function listRequests(store, actorOrganizationId) {
  return store.findMany('supplyRequests', (item) => item.buyerOrganizationId === actorOrganizationId || item.supplierOrganizationId === actorOrganizationId).map((request) => getRequest(store, request.id, actorOrganizationId));
}

function createSupplyRequest(store, { actorUserId, actorOrganizationId, payload, idempotencyKey, now = new Date() }) {
  const replay = requireIdempotency(store, { actorUserId, actorOrganizationId, operation: 'create_supply_request', key: idempotencyKey, payload });
  if (replay) return replay;
  const matchResult = store.findOne('matchResults', (item) => item.id === (payload.matchResultId ?? payload.match_result_id));
  if (!matchResult) throw new DomainError('NOT_FOUND', 'Match result was not found', 404);
  const run = store.findOne('matchRuns', (item) => item.id === matchResult.matchRunId);
  if (!run || run.requesterOrganizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Match result is outside the active organization', 403);
  if (matchResult.status !== 'compatible') throw new DomainError('MATCH_NOT_COMPATIBLE', 'Only a compatible match can become a supply request', 422);
  const requirement = store.findOne('requirements', (item) => item.id === run.requirementId && item.organizationId === actorOrganizationId);
  if (!requirement) throw new DomainError('FORBIDDEN', 'Requirement is outside the active organization', 403);
  const expectedRequirementVersion = payload.expectedRequirementVersion ?? payload.expected_requirement_version;
  if (expectedRequirementVersion !== undefined && Number(expectedRequirementVersion) !== Number(requirement.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Requirement changed; refresh it before requesting supply', 409);
  const period = store.findOne('supplyPeriods', (item) => item.id === matchResult.supplyPeriodId);
  if (!period) throw new DomainError('NOT_FOUND', 'Supply period was not found', 404);
  const quantity = payload.quantityTonnes ?? payload.quantity_t ?? requirement.quantityTonnes;
  if (Number(quantity) !== Number(requirement.quantityTonnes)) throw new DomainError('MATCH_STALE', 'Request quantity must equal the evaluated requirement quantity', 409);
  const expectedVersion = payload.expectedSupplyVersion ?? payload.expected_supply_version;
  if (expectedVersion === undefined || Number(expectedVersion) !== Number(period.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Supply changed; run the match again before requesting it', 409);
  const remaining = Number(period.totalTonnes) - Number(period.reservedTonnes);
  if (remaining < Number(quantity)) throw new DomainError('CAPACITY_CONFLICT', 'Supply no longer has enough available quantity', 409);
  const currentMatch = runMatch(store, { requirementId: requirement.id, actorOrganizationId, now }).results.find((item) => item.streamId === matchResult.streamId);
  if (!currentMatch || currentMatch.status !== 'compatible') throw new DomainError('MATCH_STALE', 'The selected option is no longer compatible; refresh matches', 409);
  if (payload.expectedDeliveredPaisePerTonne !== undefined && Number(payload.expectedDeliveredPaisePerTonne) !== Number(currentMatch.economics?.deliveredPaisePerTonne)) throw new DomainError('MATCH_STALE', 'The delivered estimate changed; review the updated comparison before requesting it', 409);
  const response = store.insert('supplyRequests', {
    id: `request-${randomUUID()}`,
    buyerOrganizationId: actorOrganizationId,
    supplierOrganizationId: matchResult.supplierOrganizationId,
    requirementId: requirement.id,
    streamId: matchResult.streamId,
    supplyPeriodId: matchResult.supplyPeriodId,
    expectedSupplyVersion: Number(period.version || 1),
    matchResultId: currentMatch.id,
    quantityTonnes: requirement.quantityTonnes,
    termsSnapshot: { economics: structuredClone(currentMatch.economics), requirement: structuredClone(requirement), matchRunId: currentMatch.matchRunId || run.id },
    status: 'pending_supplier',
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  store.insert('requestEvents', { id: `request-event-${randomUUID()}`, requestId: response.id, actorUserId, event: 'submitted', createdAt: now.toISOString() });
  saveIdempotency(store, { actorUserId, actorOrganizationId, operation: 'create_supply_request', key: idempotencyKey, payload, response });
  return structuredClone(response);
}

function acceptRequest(store, { actorUserId, actorOrganizationId, requestId, expectedVersion, expectedSupplyVersion, idempotencyKey, now = new Date() }) {
  const payload = { requestId, expectedVersion, expectedSupplyVersion };
  const replay = requireIdempotency(store, { actorUserId, actorOrganizationId, operation: 'accept_supply_request', key: idempotencyKey, payload });
  if (replay) return replay;
  const request = getRequest(store, requestId, actorOrganizationId, now);
  if (request.supplierOrganizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Only the supplier can accept this request', 403);
  if (request.status === 'accepted' && request.reservationId) {
    const existing = { request: structuredClone(request), reservation: structuredClone(store.findOne('reservations', (item) => item.id === request.reservationId)) };
    saveIdempotency(store, { actorUserId, actorOrganizationId, operation: 'accept_supply_request', key: idempotencyKey, payload, response: existing });
    return existing;
  }
  if (request.status !== 'pending_supplier') throw new DomainError('REQUEST_NOT_PENDING', `Request is ${request.status}`, 409);
  if (expectedVersion === undefined || Number(expectedVersion) !== Number(request.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Request changed; refresh it before accepting', 409);
  const period = store.findOne('supplyPeriods', (item) => item.id === request.supplyPeriodId);
  if (!period) throw new DomainError('NOT_FOUND', 'Supply period was not found', 404);
  const expectedPeriodVersion = expectedSupplyVersion ?? request.expectedSupplyVersion;
  if (expectedPeriodVersion === undefined || Number(period.version || 1) !== Number(expectedPeriodVersion)) throw new DomainError('VERSION_CONFLICT', 'Supply period changed; refresh the request before accepting', 409);
  if (request.expiresAt && new Date(request.expiresAt) <= now) throw new DomainError('REQUEST_EXPIRED', 'Request deadline has passed', 409);
  const remaining = Number(period.totalTonnes) - Number(period.reservedTonnes);
  if (remaining < Number(request.quantityTonnes)) throw new DomainError('CAPACITY_CONFLICT', 'The supply period no longer has enough available quantity', 409);
  if (store.findOne('reservations', (item) => item.requestId === request.id && item.status === 'active')) throw new DomainError('RESERVATION_CONFLICT', 'Request already has an active reservation', 409);
  const reservation = store.insert('reservations', { id: `reservation-${randomUUID()}`, requestId: request.id, supplyPeriodId: period.id, quantityTonnes: request.quantityTonnes, status: 'active', createdAt: now.toISOString() });
  const updatedPeriod = store.replace('supplyPeriods', period.id, { reservedTonnes: String(Number(period.reservedTonnes) + Number(request.quantityTonnes)), version: Number(period.version || 1) + 1 });
  const updatedRequest = store.replace('supplyRequests', request.id, { status: 'accepted', reservationId: reservation.id, expectedSupplyVersion: updatedPeriod.version, version: Number(request.version || 1) + 1, updatedAt: now.toISOString() });
  store.insert('requestEvents', { id: `request-event-${randomUUID()}`, requestId: request.id, actorUserId, event: 'accepted', createdAt: now.toISOString() });
  const response = { request: updatedRequest, reservation };
  saveIdempotency(store, { actorUserId, actorOrganizationId, operation: 'accept_supply_request', key: idempotencyKey, payload, response });
  return structuredClone(response);
}

function transitionRequest(store, { actorUserId, actorOrganizationId, requestId, expectedVersion, idempotencyKey, transition, now = new Date() }) {
  const payload = { requestId, expectedVersion };
  const operation = `${transition}_supply_request`;
  const replay = requireIdempotency(store, { actorUserId, actorOrganizationId, operation, key: idempotencyKey, payload });
  if (replay) return replay;
  const request = getRequest(store, requestId, actorOrganizationId);
  if (transition === 'decline' && request.supplierOrganizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Only the supplier can decline this request', 403);
  if (transition === 'cancel' && request.buyerOrganizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Only the buyer can cancel this request', 403);
  if (request.status !== 'pending_supplier') throw new DomainError('REQUEST_NOT_PENDING', `Request is ${request.status}`, 409);
  if (expectedVersion === undefined || Number(expectedVersion) !== Number(request.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Request changed; refresh it before updating', 409);
  const status = transition === 'decline' ? 'declined' : 'cancelled';
  const updated = store.replace('supplyRequests', request.id, { status, version: Number(request.version || 1) + 1, updatedAt: now.toISOString() });
  store.insert('requestEvents', { id: `request-event-${randomUUID()}`, requestId: request.id, actorUserId, event: transition, createdAt: now.toISOString() });
  saveIdempotency(store, { actorUserId, actorOrganizationId, operation, key: idempotencyKey, payload, response: updated });
  return structuredClone(updated);
}

function decisionReceipt(store, { runId, actorOrganizationId }) {
  const run = store.findOne('matchRuns', (item) => item.id === runId);
  if (!run || run.requesterOrganizationId !== actorOrganizationId) throw new DomainError('NOT_FOUND', 'Decision receipt was not found', 404);
  const results = store.findMany('matchResults', (item) => item.matchRunId === run.id);
  return {
    receiptVersion: 'decision-receipt-v1',
    matchRunId: run.id,
    requirement: structuredClone(run.requirementSnapshot),
    engineVersion: run.engineVersion,
    rateCardVersion: run.rateCardVersion,
    evaluatedAt: run.evaluatedAt,
    results: structuredClone(results),
    immutable: true
  };
}

function alternativeBuyers(store, { listingId, actorOrganizationId, now = new Date() }) {
  const stream = store.findOne('streams', (item) => item.id === listingId);
  if (!stream || stream.organizationId !== actorOrganizationId) throw new DomainError('NOT_FOUND', 'Listing was not found', 404);
  const requirements = store.findMany('requirements', (item) => item.state === 'published' && item.organizationId !== actorOrganizationId);
  const matches = [];
  for (const requirement of requirements) {
    const result = runMatch(store, { requirementId: requirement.id, now }).results.find((item) => item.streamId === listingId);
    if (result && result.status === 'compatible') matches.push({ requirementId: requirement.id, buyerOrganizationId: requirement.organizationId, result: structuredClone(result) });
  }
  return { listingId, matches };
}

function requestFromListing(store, { actorUserId, actorOrganizationId, listingId, payload = {}, idempotencyKey, now = new Date() }) {
  const stream = store.findOne('streams', (item) => item.id === listingId);
  if (!stream || stream.state !== 'published') throw new DomainError('NOT_FOUND', 'Listing was not found', 404);
  let requirement;
  if (payload.requirementId) {
    requirement = getRequirement(store, payload.requirementId, actorOrganizationId);
  } else {
    const site = store.findMany('sites', (item) => item.organizationId === actorOrganizationId)[0];
    if (!site) throw new DomainError('VALIDATION_ERROR', 'Create a site before requesting supply from a listing', 422);
    requirement = createRequirement(store, {
      actorOrganizationId,
      payload: {
        siteId: site.id,
        name: payload.name || `Request for ${stream.name}`,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        quantityTonnes: payload.quantityTonnes,
        minimumPurityMolPct: payload.minimumPurityMolPct ?? 0,
        acceptableForms: payload.acceptableForms || [stream.physicalForm],
        maxDistanceKm: payload.maxDistanceKm,
        maxDeliveredPaisePerTonne: payload.maxDeliveredPaisePerTonne,
        limits: payload.limits || []
      },
      state: 'published',
      now
    });
  }
  const match = runMatch(store, { requirementId: requirement.id, actorOrganizationId, now });
  const result = match.results.find((item) => item.streamId === listingId);
  if (!result) throw new DomainError('NOT_FOUND', 'Listing was not evaluated for this requirement', 404);
  if (result.status !== 'compatible') {
    throw new DomainError('MATCH_NOT_COMPATIBLE', 'Listing is not compatible with this requirement', 422, {
      status: result.status,
      checks: result.checks,
      result: structuredClone(result),
      groups: match.groups
    });
  }
  const period = store.findOne('supplyPeriods', (item) => item.id === result.supplyPeriodId);
  if (!period) throw new DomainError('NOT_FOUND', 'Supply period was not found', 404);
  return createSupplyRequest(store, {
    actorUserId,
    actorOrganizationId,
    payload: {
      matchResultId: result.id,
      quantityTonnes: requirement.quantityTonnes,
      expectedSupplyVersion: Number(period.version || 1),
      expectedRequirementVersion: Number(requirement.version || 1)
    },
    idempotencyKey: String(idempotencyKey || `listing-request-${randomUUID()}`),
    now
  });
}

module.exports = { getRequest, listRequests, createSupplyRequest, acceptRequest, transitionRequest, decisionReceipt, alternativeBuyers, requestFromListing };
