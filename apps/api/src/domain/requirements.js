const { randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');
const { decimal } = require('./numeric');

function validDate(value, field) {
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new DomainError('INVALID_DATE', `${field} must be a valid ISO date`);
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new DomainError('INVALID_DATE', `${field} must be a valid calendar date`);
  return text;
}

function normalizeRequirement(store, { actorOrganizationId, payload, state = 'published', now = new Date() }) {
  const site = store.findOne('sites', (item) => item.id === payload.siteId && item.organizationId === actorOrganizationId);
  if (!site) throw new DomainError('FORBIDDEN', 'Requirement site is not owned by the active organization', 403);
  const periodStart = validDate(requireValue(payload.periodStart, 'periodStart'), 'periodStart');
  const periodEnd = validDate(requireValue(payload.periodEnd, 'periodEnd'), 'periodEnd');
  if (periodEnd < periodStart) throw new DomainError('INVALID_PERIOD', 'periodEnd must be after periodStart');
  const quantityTonnes = decimal(requireValue(payload.quantityTonnes, 'quantityTonnes'), 'quantityTonnes', { min: 0.000001 });
  const minimumPurityMolPct = decimal(payload.minimumPurityMolPct ?? 0, 'minimumPurityMolPct', { min: 0, max: 100 });
  const acceptableForms = Array.isArray(payload.acceptableForms) && payload.acceptableForms.length > 0 ? payload.acceptableForms.map(String) : ['gas'];
  if (acceptableForms.some((form) => !['gas', 'liquid', 'solid'].includes(form))) throw new DomainError('VALIDATION_ERROR', 'acceptableForms must contain only gas, liquid or solid');
  const limits = Array.isArray(payload.limits) ? payload.limits.map((limit) => ({
    analyte: requireValue(limit.analyte, 'limit.analyte'),
    maxValue: decimal(requireValue(limit.maxValue, `limit.${limit.analyte}`), `limit.${limit.analyte}`, { min: 0 }),
    unit: requireValue(limit.unit, `limit.${limit.analyte}.unit`),
    basis: requireValue(limit.basis, `limit.${limit.analyte}.basis`),
    critical: limit.critical !== false
  })) : [];
  return {
    id: `requirement-${randomUUID()}`,
    organizationId: actorOrganizationId,
    siteId: site.id,
    name: String(payload.name || 'Untitled requirement').trim().slice(0, 160),
    periodStart,
    periodEnd,
    quantityTonnes: String(quantityTonnes),
    minimumPurityMolPct: String(minimumPurityMolPct),
    acceptableForms,
    maxDistanceKm: payload.maxDistanceKm === null || payload.maxDistanceKm === undefined ? null : String(decimal(payload.maxDistanceKm, 'maxDistanceKm', { min: 0 })),
    maxDeliveredPaisePerTonne: payload.maxDeliveredPaisePerTonne === null || payload.maxDeliveredPaisePerTonne === undefined ? null : Math.round(decimal(payload.maxDeliveredPaisePerTonne, 'maxDeliveredPaisePerTonne', { min: 0 })),
    limits,
    state,
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    synthetic: false
  };
}

function createRequirement(store, args) {
  return store.insert('requirements', normalizeRequirement(store, args));
}

function listRequirements(store, actorOrganizationId) {
  return store.findMany('requirements', (item) => item.organizationId === actorOrganizationId).map((item) => structuredClone(item));
}

function getRequirement(store, requirementId, actorOrganizationId) {
  const requirement = store.findOne('requirements', (item) => item.id === requirementId);
  if (!requirement) throw new DomainError('NOT_FOUND', `Requirement ${requirementId} was not found`, 404);
  if (actorOrganizationId && requirement.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Requirement is outside the active organization', 403);
  return structuredClone(requirement);
}

function patchRequirement(store, { requirementId, actorOrganizationId, payload, now = new Date() }) {
  const requirement = store.findOne('requirements', (item) => item.id === requirementId);
  if (!requirement) throw new DomainError('NOT_FOUND', `Requirement ${requirementId} was not found`, 404);
  if (requirement.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Requirement is outside the active organization', 403);
  if (payload.version === undefined || Number(payload.version) !== Number(requirement.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Requirement changed; refresh it before editing', 409);
  const merged = { ...requirement, ...payload, siteId: requirement.siteId };
  const normalized = normalizeRequirement(store, { actorOrganizationId, payload: merged, state: merged.state === 'draft' ? 'draft' : 'published', now });
  const updated = store.replace('requirements', requirement.id, {
    ...normalized,
    id: requirement.id,
    createdAt: requirement.createdAt,
    version: Number(requirement.version || 1) + 1,
    updatedAt: now.toISOString()
  });
  return structuredClone(updated);
}

module.exports = { normalizeRequirement, createRequirement, listRequirements, getRequirement, patchRequirement };
