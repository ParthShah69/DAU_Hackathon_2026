const { DomainError } = require('./errors');
const { decimal } = require('./numeric');

const EVIDENCE_STATUSES = new Set(['missing', 'self_reported', 'reviewed']);

function getDraft(store, draftId, actorOrganizationId) {
  const draft = store.findOne('listingDrafts', (item) => item.id === draftId);
  if (!draft) throw new DomainError('NOT_FOUND', 'Listing draft was not found', 404);
  if (draft.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Listing draft is outside the active organization', 403);
  return draft;
}

function blockers(draft) {
  const result = [];
  if (!draft.quantityTonnes || Number(draft.quantityTonnes) <= 0) result.push('measured quantity');
  if (!draft.quality) result.push('quality/composition evidence');
  if (draft.evidenceStatus !== 'reviewed') result.push('reviewed evidence');
  if (draft.material !== 'captured_co2') result.push('category adapter for this material');
  return result;
}

function patchListingDraft(store, { draftId, actorOrganizationId, payload, now = new Date() }) {
  const draft = getDraft(store, draftId, actorOrganizationId);
  if (payload.version !== undefined && Number(payload.version) !== Number(draft.version)) throw new DomainError('VERSION_CONFLICT', 'Listing draft changed; refresh it before editing', 409);
  const update = {};
  if (payload.title !== undefined) update.title = String(payload.title).trim().slice(0, 160);
  if (payload.quantityTonnes !== undefined) update.quantityTonnes = String(decimal(payload.quantityTonnes, 'quantityTonnes', { min: 0.000001 }));
  if (payload.quality !== undefined) {
    if (!payload.quality || typeof payload.quality !== 'object' || Array.isArray(payload.quality)) throw new DomainError('VALIDATION_ERROR', 'quality must be an object');
    update.quality = {
      purityMolPct: payload.quality.purityMolPct === undefined ? null : String(decimal(payload.quality.purityMolPct, 'quality.purityMolPct', { min: 0, max: 100 })),
      basis: payload.quality.basis ? String(payload.quality.basis) : null,
      analytes: Array.isArray(payload.quality.analytes) ? payload.quality.analytes.slice(0, 30) : []
    };
  }
  if (payload.evidenceStatus !== undefined) {
    if (!EVIDENCE_STATUSES.has(payload.evidenceStatus)) throw new DomainError('VALIDATION_ERROR', `evidenceStatus must be one of: ${[...EVIDENCE_STATUSES].join(', ')}`);
    update.evidenceStatus = payload.evidenceStatus;
  }
  update.updatedAt = now.toISOString();
  update.version = Number(draft.version || 1) + 1;
  const updated = store.replace('listingDrafts', draft.id, update);
  const publishBlockers = blockers(updated);
  return { ...structuredClone(updated), canPublish: publishBlockers.length === 0, publishBlockers };
}

function listDrafts(store, actorOrganizationId) {
  return store.findMany('listingDrafts', (item) => item.organizationId === actorOrganizationId).map((item) => ({ ...structuredClone(item), canPublish: blockers(item).length === 0, publishBlockers: blockers(item) }));
}

function getDraftDetail(store, draftId, actorOrganizationId) {
  const draft = getDraft(store, draftId, actorOrganizationId);
  const process = store.findOne('processes', (item) => item.id === draft.processId);
  const candidate = store.findOne('discoveryCandidates', (item) => item.id === draft.discoveryCandidateId);
  return { draft: { ...structuredClone(draft), canPublish: blockers(draft).length === 0, publishBlockers: blockers(draft) }, process: structuredClone(process), candidate: structuredClone(candidate) };
}

module.exports = { listDrafts, getDraftDetail, patchListingDraft, blockers };
