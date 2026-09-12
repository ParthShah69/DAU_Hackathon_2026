const { randomUUID } = require('node:crypto');
const { DomainError } = require('./errors');

const REQUIRED = {
  supplier: ['organizationName', 'legalEntityType', 'industry', 'facilityLocation', 'contactEmail', 'annualCaptureEstimate', 'availableQuantity', 'supplyFrequency', 'sourceProcess', 'purity', 'form'],
  buyer: ['organizationName', 'industry', 'facilityLocation', 'contactEmail', 'requiredAmount', 'requiredFrequency', 'minimumPurity', 'requiredForm', 'deliveryLocation'],
  ngo: ['organizationName', 'registrationNumber', 'mission', 'operationalRegions', 'contactEmail', 'projectCategory', 'fundingRequirement'],
  contributor: ['organizationName', 'industry', 'contactEmail', 'annualEmissions', 'emissionsGap', 'sustainabilityBudget', 'contributionType']
};

function profileFor(store, organizationId) { return store.findOne('organizationProfiles', (item) => item.organizationId === organizationId); }
function completeness(profile, capabilities) {
  const fields = [...new Set(capabilities.flatMap((capability) => REQUIRED[capability] || []))];
  const completed = fields.filter((field) => profile?.data?.[field] !== undefined && profile.data[field] !== null && String(profile.data[field]).trim() !== '');
  return { requiredFields: fields, completedFields: completed, percent: fields.length ? Math.round((completed.length / fields.length) * 100) : 100, ready: completed.length === fields.length };
}
function getProfile(store, actor) {
  const profile = profileFor(store, actor.organizationId);
  const progress = completeness(profile, actor.organization.capabilities || [actor.organization.kind]);
  return { organizationId: actor.organizationId, data: profile?.data || {}, verificationStatus: profile?.verificationStatus || 'draft', submittedAt: profile?.submittedAt || null, updatedAt: profile?.updatedAt || null, ...progress };
}
function saveProfile(store, actor, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new DomainError('VALIDATION_ERROR', 'Profile must be an object');
  const existing = profileFor(store, actor.organizationId);
  const data = { ...(existing?.data || {}), ...payload };
  const record = { id: existing?.id || `profile-${randomUUID()}`, organizationId: actor.organizationId, data, verificationStatus: existing?.verificationStatus === 'verified' ? 'verified' : 'draft', updatedAt: store.now() };
  if (existing) store.replace('organizationProfiles', existing.id, record); else store.insert('organizationProfiles', record);
  return getProfile(store, actor);
}
function submitProfile(store, actor) {
  const profile = getProfile(store, actor);
  if (!profile.ready) throw new DomainError('VALIDATION_ERROR', `Complete required fields before submission: ${profile.requiredFields.filter((field) => !profile.completedFields.includes(field)).join(', ')}`, 422);
  const existing = profileFor(store, actor.organizationId);
  store.replace('organizationProfiles', existing.id, { verificationStatus: 'submitted_for_review', submittedAt: store.now(), updatedAt: store.now() });
  const submission = { id: `verification-${randomUUID()}`, organizationId: actor.organizationId, status: 'submitted_for_review', submittedBy: actor.userId, createdAt: store.now(), history: [{ status: 'submitted_for_review', at: store.now(), note: 'Demo verification submission' }] };
  store.insert('verificationSubmissions', submission);
  return { ...getProfile(store, actor), submission };
}
function verificationQueue(store) { return store.findMany('verificationSubmissions').map((submission) => ({ ...submission, organization: store.findOne('organizations', (org) => org.id === submission.organizationId)?.name || 'Organization' })); }
function reviewSubmission(store, actor, id, { status, note = '' }) {
  if (!actor.roles.includes('reviewer')) throw new DomainError('FORBIDDEN', 'Only an admin or verifier can change verification decisions', 403);
  if (!['verified', 'needs_changes', 'rejected', 'suspended'].includes(status)) throw new DomainError('VALIDATION_ERROR', 'Invalid verification status');
  const submission = store.findOne('verificationSubmissions', (item) => item.id === id);
  if (!submission) throw new DomainError('NOT_FOUND', 'Verification submission was not found', 404);
  const history = [...(submission.history || []), { status, note: String(note).slice(0, 1000), at: store.now(), reviewerId: actor.userId }];
  store.replace('verificationSubmissions', id, { status, history, reviewedAt: store.now() });
  const profile = profileFor(store, submission.organizationId);
  if (profile) store.replace('organizationProfiles', profile.id, { verificationStatus: status, updatedAt: store.now() });
  return store.findOne('verificationSubmissions', (item) => item.id === id);
}
module.exports = { getProfile, saveProfile, submitProfile, verificationQueue, reviewSubmission };
