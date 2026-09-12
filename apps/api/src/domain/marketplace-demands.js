const { randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');

function publicOrganization(store, organizationId) {
  const organization = store.findOne('organizations', (item) => item.id === organizationId);
  if (!organization) throw new DomainError('NOT_FOUND', 'Organization was not found', 404);
  const profile = store.findOne('organizationProfiles', (item) => item.organizationId === organizationId);
  const data = profile?.data || {};
  // Keep contact information, document references, signatories, and raw verification data private.
  const allowed = ['industry', 'facilityLocation', 'annualCaptureEstimate', 'availableQuantity', 'supplyFrequency', 'sourceProcess', 'purity', 'form', 'requiredAmount', 'requiredFrequency', 'minimumPurity', 'requiredForm', 'deliveryLocation', 'mission', 'operationalRegions', 'projectCategory'];
  const details = Object.fromEntries(allowed.filter((key) => data[key] !== undefined && data[key] !== '').map((key) => [key, data[key]]));
  return { id: organization.id, name: organization.name, kind: organization.kind, capabilities: organization.capabilities || [], verificationStatus: profile?.verificationStatus || 'unverified', details };
}

function listPublicDemands(store, actor) {
  return store.findMany('requirements', (item) => item.state === 'published' && item.organizationId !== actor.organizationId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .map((requirement) => ({
      id: requirement.id,
      name: requirement.name,
      quantityTonnes: requirement.quantityTonnes,
      minimumPurityMolPct: requirement.minimumPurityMolPct,
      acceptableForms: requirement.acceptableForms,
      periodStart: requirement.periodStart,
      periodEnd: requirement.periodEnd,
      maxDistanceKm: requirement.maxDistanceKm,
      maxDeliveredPaisePerTonne: requirement.maxDeliveredPaisePerTonne,
      buyer: publicOrganization(store, requirement.organizationId),
      synthetic: Boolean(requirement.synthetic)
    }));
}

function offerOnDemand(store, actor, requirementId, payload) {
  const requirement = store.findOne('requirements', (item) => item.id === requirementId && item.state === 'published');
  if (!requirement) throw new DomainError('NOT_FOUND', 'Published buyer request was not found', 404);
  if (requirement.organizationId === actor.organizationId) throw new DomainError('FORBIDDEN', 'You cannot offer on your own request', 403);
  const quantity = String(requireValue(payload.quantity, 'quantity'));
  const thread = store.insert('negotiationThreads', {
    id: `negotiation-${randomUUID()}`,
    requirementId: requirement.id,
    buyerOrganizationId: requirement.organizationId,
    supplierOrganizationId: actor.organizationId,
    status: 'pending',
    summary: {
      quantity,
      unit: String(payload.unit || 'tonnes'),
      purity: String(payload.purity || `≥ ${requirement.minimumPurityMolPct}% CO₂`),
      priceBasis: String(payload.priceBasis || 'Open to offers'),
      delivery: String(payload.delivery || 'To be agreed'),
      schedule: String(payload.schedule || `${requirement.periodStart} to ${requirement.periodEnd}`)
    },
    createdAt: store.now(), updatedAt: store.now(), synthetic: false
  });
  store.insert('negotiationMessages', { id: `negotiation-message-${randomUUID()}`, threadId: thread.id, organizationId: actor.organizationId, kind: 'offer', offerStatus: 'pending', content: String(payload.message || 'Supply offer submitted.').slice(0, 3000), createdAt: store.now() });
  return thread;
}

module.exports = { publicOrganization, listPublicDemands, offerOnDemand };
