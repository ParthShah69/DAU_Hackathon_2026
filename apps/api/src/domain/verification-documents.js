const { randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const REVIEW_DECISIONS = new Set(['accepted', 'rejected']);
const APPLICATION_DECISIONS = new Set(['verified', 'needs_changes', 'rejected', 'suspended']);

function isPlatformAdmin(actor) {
  return Boolean(actor?.roles?.some((role) => role === 'platform_admin' || role === 'admin'));
}

function requirePlatformAdmin(actor) {
  if (!isPlatformAdmin(actor)) {
    throw new DomainError('FORBIDDEN', 'This action requires a CarbonBridge platform administrator', 403);
  }
}

function publicDocument(document) {
  return structuredClone(document);
}

function documentsFor(store, organizationId) {
  return store.findMany('verificationDocuments', (document) => document.organizationId === organizationId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map(publicDocument);
}

function listOwnDocuments(store, actor) {
  return { organizationId: actor.organizationId, items: documentsFor(store, actor.organizationId) };
}

function uploadDocument(store, actor, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new DomainError('VALIDATION_ERROR', 'Document metadata must be an object');
  }
  const documentType = String(requireValue(payload.documentType, 'documentType')).trim().slice(0, 100);
  const fileName = String(requireValue(payload.fileName, 'fileName')).trim().slice(0, 255);
  const mimeType = String(requireValue(payload.mimeType, 'mimeType')).toLowerCase();
  const sizeBytes = Number(requireValue(payload.sizeBytes, 'sizeBytes'));
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new DomainError('VALIDATION_ERROR', 'mimeType must be PDF, JPEG, or PNG');
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DOCUMENT_BYTES) {
    throw new DomainError('VALIDATION_ERROR', `sizeBytes must be an integer between 1 and ${MAX_DOCUMENT_BYTES}`);
  }
  const document = store.insert('verificationDocuments', {
    id: `verification-document-${randomUUID()}`,
    organizationId: actor.organizationId,
    submittedBy: actor.userId,
    documentType,
    fileName,
    mimeType,
    sizeBytes,
    description: payload.description == null ? null : String(payload.description).trim().slice(0, 1000),
    storage: { kind: 'metadata_only_demo', uploadStatus: 'simulated_uploaded' },
    status: 'pending_review',
    createdAt: store.now(),
    reviewHistory: []
  });
  return publicDocument(document);
}

function submissionFor(store, id) {
  const submission = store.findOne('verificationSubmissions', (item) => item.id === id);
  if (!submission) throw new DomainError('NOT_FOUND', 'Verification submission was not found', 404);
  return submission;
}

function adminQueue(store, actor) {
  requirePlatformAdmin(actor);
  return {
    items: store.findMany('verificationSubmissions')
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .map((submission) => ({
        ...structuredClone(submission),
        organization: store.findOne('organizations', (organization) => organization.id === submission.organizationId)?.name || 'Organization',
        documents: documentsFor(store, submission.organizationId)
      }))
  };
}

function adminSubmission(store, actor, id) {
  requirePlatformAdmin(actor);
  const submission = submissionFor(store, id);
  return {
    ...structuredClone(submission),
    organization: store.findOne('organizations', (organization) => organization.id === submission.organizationId) || null,
    profile: store.findOne('organizationProfiles', (profile) => profile.organizationId === submission.organizationId) || null,
    documents: documentsFor(store, submission.organizationId)
  };
}

function reviewDocument(store, actor, submissionId, documentId, payload) {
  requirePlatformAdmin(actor);
  const submission = submissionFor(store, submissionId);
  const document = store.findOne('verificationDocuments', (item) => item.id === documentId && item.organizationId === submission.organizationId);
  if (!document) throw new DomainError('NOT_FOUND', 'Verification document was not found', 404);
  const decision = String(requireValue(payload?.decision, 'decision')).toLowerCase();
  if (!REVIEW_DECISIONS.has(decision)) throw new DomainError('VALIDATION_ERROR', 'decision must be accepted or rejected');
  const comment = payload?.comment == null ? '' : String(payload.comment).trim().slice(0, 1000);
  const review = { decision, comment, at: store.now(), reviewerId: actor.userId };
  return store.replace('verificationDocuments', document.id, {
    status: decision,
    reviewedAt: review.at,
    reviewedBy: actor.userId,
    reviewHistory: [...(document.reviewHistory || []), review]
  });
}

function reviewSubmission(store, actor, submissionId, payload) {
  requirePlatformAdmin(actor);
  const submission = submissionFor(store, submissionId);
  const status = String(requireValue(payload?.status, 'status')).toLowerCase();
  if (!APPLICATION_DECISIONS.has(status)) {
    throw new DomainError('VALIDATION_ERROR', 'status must be verified, needs_changes, rejected, or suspended');
  }
  const note = payload?.note == null ? '' : String(payload.note).trim().slice(0, 1000);
  const review = { status, note, at: store.now(), reviewerId: actor.userId };
  const updated = store.replace('verificationSubmissions', submission.id, {
    status,
    reviewedAt: review.at,
    reviewedBy: actor.userId,
    history: [...(submission.history || []), review]
  });
  const profile = store.findOne('organizationProfiles', (item) => item.organizationId === submission.organizationId);
  if (profile) store.replace('organizationProfiles', profile.id, { verificationStatus: status, updatedAt: review.at });
  return updated;
}

module.exports = {
  isPlatformAdmin,
  listOwnDocuments,
  uploadDocument,
  adminQueue,
  adminSubmission,
  reviewDocument,
  reviewSubmission
};
