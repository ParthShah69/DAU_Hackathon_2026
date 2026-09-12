const { randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');
const { decimal } = require('./numeric');

function requireRole(actor, roles) {
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new DomainError('FORBIDDEN', `This action requires one of: ${roles.join(', ')}`, 403);
  }
}

const PROJECT_KINDS = new Set(['labor', 'funding', 'greening', 'appreciation']);
const CONTRIBUTION_KINDS = new Set(['labor', 'funding', 'greening']);
const DISCLAIMER = 'Support activity only. This does not retire, net, or certify emissions.';

function withSupportFlags(record) {
  return {
    ...structuredClone(record),
    offsetClaim: false,
    disclaimer: DISCLAIMER
  };
}

function isNgoOrg(actor) {
  return Boolean(actor.organization?.capabilities?.includes('ngo') || actor.organization?.kind === 'ngo');
}

function isSupplierOrg(actor) {
  return Boolean(actor.organization?.capabilities?.includes('supplier') || actor.organization?.kind === 'supplier');
}

function requireNgoMutator(actor) {
  if (!isNgoOrg(actor)) throw new DomainError('FORBIDDEN', 'Only an NGO organization can manage projects', 403);
  requireRole(actor, ['org_admin', 'ngo_editor']);
}

function requireSupplierMutator(actor) {
  if (!isSupplierOrg(actor)) throw new DomainError('FORBIDDEN', 'Only a production house can submit carbon-balance support requests', 403);
  requireRole(actor, ['org_admin', 'supplier_editor']);
}

function getProjectRecord(store, projectId) {
  const project = store.findOne('ngoProjects', (item) => item.id === projectId);
  if (!project) throw new DomainError('NOT_FOUND', 'Project was not found', 404);
  return project;
}

function visibleProject(project, actor) {
  if (project.state === 'published') return true;
  return project.organizationId === actor.organizationId;
}

function createProject(store, { actor, payload, now = new Date() }) {
  requireNgoMutator(actor);
  const kind = String(requireValue(payload.kind, 'kind'));
  if (!PROJECT_KINDS.has(kind)) throw new DomainError('VALIDATION_ERROR', 'kind must be labor, funding, greening or appreciation');
  const capacity = decimal(payload.capacity ?? payload.capacityPaise ?? 0, 'capacity', { min: 0 });
  const unit = String(payload.unit || (kind === 'funding' ? 'paise' : kind === 'labor' ? 'volunteer-days' : 'unit'));
  const project = store.insert('ngoProjects', {
    id: payload.id || `project-${randomUUID()}`,
    organizationId: actor.organizationId,
    title: String(requireValue(payload.title ?? payload.name, 'title')).trim().slice(0, 200),
    kind,
    description: String(payload.description || '').trim().slice(0, 4000),
    city: payload.city ? String(payload.city).trim().slice(0, 120) : null,
    capacity: String(capacity),
    remaining: String(payload.remaining ?? payload.remainingPaise ?? capacity),
    unit,
    carbonFocus: payload.carbonFocus ? String(payload.carbonFocus).trim().slice(0, 400) : null,
    state: payload.state === 'published' ? 'published' : 'draft',
    provenance: 'organization_provided',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  return structuredClone(project);
}

function listProjects(store, { actor, kind = null }) {
  return store.findMany('ngoProjects', (project) => {
    if (!visibleProject(project, actor)) return false;
    if (kind && project.kind !== kind) return false;
    return true;
  }).map((project) => structuredClone(project));
}

function getProject(store, { actor, projectId }) {
  const project = getProjectRecord(store, projectId);
  if (!visibleProject(project, actor)) throw new DomainError('NOT_FOUND', 'Project was not found', 404);
  return structuredClone(project);
}

function publishProject(store, { actor, projectId, now = new Date() }) {
  requireNgoMutator(actor);
  const project = getProjectRecord(store, projectId);
  if (project.organizationId !== actor.organizationId) throw new DomainError('FORBIDDEN', 'Only the owning NGO can publish this project', 403);
  if (project.state === 'published') return structuredClone(project);
  return store.replace('ngoProjects', project.id, { state: 'published', updatedAt: now.toISOString() });
}

function createBalanceRequest(store, { actor, payload, now = new Date() }) {
  requireSupplierMutator(actor);
  const preferredSupport = Array.isArray(payload.preferredSupport)
    ? payload.preferredSupport.map(String)
    : payload.preferredSupport
      ? [String(payload.preferredSupport)]
      : [];
  if (preferredSupport.some((item) => !['labor', 'funding', 'greening', 'appreciation'].includes(item))) {
    throw new DomainError('VALIDATION_ERROR', 'preferredSupport must contain labor, funding, greening or appreciation');
  }
  const request = store.insert('balanceRequests', {
    id: `balance-${randomUUID()}`,
    organizationId: actor.organizationId,
    estimatedTonnesCo2e: String(decimal(requireValue(payload.estimatedTonnesCo2e, 'estimatedTonnesCo2e'), 'estimatedTonnesCo2e', { min: 0 })),
    message: String(payload.message || '').trim().slice(0, 4000),
    preferredSupport,
    city: payload.city ? String(payload.city).trim().slice(0, 120) : null,
    status: 'open',
    offsetClaim: false,
    disclaimer: DISCLAIMER,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  return withSupportFlags(request);
}

function listBalanceRequests(store, { actor }) {
  return store.findMany('balanceRequests', (item) => {
    if (item.organizationId === actor.organizationId) return true;
    if (isNgoOrg(actor) && item.status === 'open') return true;
    if (isNgoOrg(actor) && (item.status === 'offered' || item.status === 'supported') && item.offeredByOrganizationId === actor.organizationId) return true;
    return false;
  }).map((item) => withSupportFlags(item));
}

function getOwnedBalanceRequest(store, requestId) {
  const request = store.findOne('balanceRequests', (item) => item.id === requestId);
  if (!request) throw new DomainError('NOT_FOUND', 'Balance request was not found', 404);
  return request;
}

function offerBalanceSupport(store, { actor, requestId, payload, now = new Date() }) {
  requireNgoMutator(actor);
  const request = getOwnedBalanceRequest(store, requestId);
  if (request.status !== 'open') throw new DomainError('CONFLICT', `Balance request is ${request.status}`, 409);
  const projectId = requireValue(payload.projectId, 'projectId');
  const project = getProjectRecord(store, projectId);
  if (project.organizationId !== actor.organizationId) throw new DomainError('FORBIDDEN', 'Offer a project owned by the active NGO', 403);
  if (project.state !== 'published') throw new DomainError('VALIDATION_ERROR', 'Project must be published before it can be offered', 422);
  const contributionKind = CONTRIBUTION_KINDS.has(project.kind) ? project.kind : 'greening';
  const participation = store.insert('participations', {
    id: `participation-${randomUUID()}`,
    projectId: project.id,
    organizationId: request.organizationId,
    offeredByOrganizationId: actor.organizationId,
    contributionKind,
    note: payload.note ? String(payload.note).trim().slice(0, 2000) : null,
    status: 'offered',
    balanceRequestId: request.id,
    offsetClaim: false,
    disclaimer: DISCLAIMER,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  const updated = store.replace('balanceRequests', request.id, {
    status: 'offered',
    offeredProjectId: project.id,
    offeredParticipationId: participation.id,
    offeredByOrganizationId: actor.organizationId,
    updatedAt: now.toISOString()
  });
  return { balanceRequest: withSupportFlags(updated), participation: withSupportFlags(participation) };
}

function acceptBalanceSupport(store, { actor, requestId, now = new Date() }) {
  requireSupplierMutator(actor);
  const request = getOwnedBalanceRequest(store, requestId);
  if (request.organizationId !== actor.organizationId) throw new DomainError('FORBIDDEN', 'Only the production house can accept this offer', 403);
  if (request.status !== 'offered') throw new DomainError('CONFLICT', `Balance request is ${request.status}`, 409);
  const participation = store.findOne('participations', (item) => item.id === request.offeredParticipationId);
  if (!participation) throw new DomainError('NOT_FOUND', 'Offered participation was not found', 404);
  const updatedParticipation = store.replace('participations', participation.id, { status: 'active', updatedAt: now.toISOString() });
  applyContribution(store, updatedParticipation, now);
  const updated = store.replace('balanceRequests', request.id, { status: 'supported', updatedAt: now.toISOString() });
  return { balanceRequest: withSupportFlags(updated), participation: withSupportFlags(updatedParticipation) };
}

function declineBalanceSupport(store, { actor, requestId, now = new Date() }) {
  requireSupplierMutator(actor);
  const request = getOwnedBalanceRequest(store, requestId);
  if (request.organizationId !== actor.organizationId) throw new DomainError('FORBIDDEN', 'Only the production house can decline this offer', 403);
  if (request.status !== 'open' && request.status !== 'offered') throw new DomainError('CONFLICT', `Balance request is ${request.status}`, 409);
  if (request.offeredParticipationId) {
    const participation = store.findOne('participations', (item) => item.id === request.offeredParticipationId);
    if (participation && participation.status === 'offered') {
      store.replace('participations', participation.id, { status: 'declined', updatedAt: now.toISOString() });
    }
  }
  const updated = store.replace('balanceRequests', request.id, { status: 'declined', updatedAt: now.toISOString() });
  return withSupportFlags(updated);
}

function applyContribution(store, participation, now) {
  const project = store.findOne('ngoProjects', (item) => item.id === participation.projectId);
  if (!project) return;
  const remaining = Number(project.remaining || 0);
  let used = 0;
  if (participation.contributionKind === 'funding') used = Number(participation.amountPaise || 0);
  else if (participation.hours) used = Number(participation.hours);
  else used = 1;
  const next = Math.max(0, remaining - (Number.isFinite(used) ? used : 0));
  store.replace('ngoProjects', project.id, { remaining: String(next), updatedAt: now.toISOString() });
}

function createParticipation(store, { actor, payload, now = new Date() }) {
  requireRole(actor, ['org_admin', 'supplier_editor', 'buyer_editor', 'ngo_editor', 'contributor_editor']);
  const project = getProjectRecord(store, requireValue(payload.projectId, 'projectId'));
  if (project.state !== 'published') throw new DomainError('NOT_FOUND', 'Project was not found', 404);
  const contributionKind = String(requireValue(payload.contributionKind, 'contributionKind'));
  if (!CONTRIBUTION_KINDS.has(contributionKind)) throw new DomainError('VALIDATION_ERROR', 'contributionKind must be labor, funding or greening');
  const participation = store.insert('participations', {
    id: `participation-${randomUUID()}`,
    projectId: project.id,
    organizationId: actor.organizationId,
    offeredByOrganizationId: null,
    contributionKind,
    hours: payload.hours === undefined || payload.hours === null ? null : decimal(payload.hours, 'hours', { min: 0 }),
    amountPaise: payload.amountPaise === undefined || payload.amountPaise === null ? null : Math.round(decimal(payload.amountPaise, 'amountPaise', { min: 0 })),
    note: payload.note ? String(payload.note).trim().slice(0, 2000) : null,
    status: 'active',
    balanceRequestId: null,
    offsetClaim: false,
    disclaimer: DISCLAIMER,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  });
  applyContribution(store, participation, now);
  return withSupportFlags(participation);
}

function listParticipations(store, { actor }) {
  return store.findMany('participations', (item) => {
    if (item.organizationId === actor.organizationId || item.offeredByOrganizationId === actor.organizationId) return true;
    const project = store.findOne('ngoProjects', (project) => project.id === item.projectId);
    return project?.organizationId === actor.organizationId;
  }).map((item) => withSupportFlags(item));
}

function createAppreciation(store, { actor, payload, now = new Date() }) {
  requireRole(actor, ['org_admin', 'buyer_editor', 'ngo_editor', 'supplier_editor', 'reviewer']);
  const subjectOrganizationId = requireValue(payload.subjectOrganizationId ?? payload.organizationId, 'subjectOrganizationId');
  const subject = store.findOne('organizations', (item) => item.id === subjectOrganizationId);
  if (!subject) throw new DomainError('NOT_FOUND', 'Subject organization was not found', 404);
  if (payload.relatedParticipationId) {
    const participation = store.findOne('participations', (item) => item.id === payload.relatedParticipationId);
    if (!participation) throw new DomainError('NOT_FOUND', 'Related participation was not found', 404);
  }
  const appreciation = store.insert('appreciations', {
    id: `appreciation-${randomUUID()}`,
    fromOrganizationId: actor.organizationId,
    fromUserId: actor.userId,
    subjectOrganizationId,
    message: String(requireValue(payload.message, 'message')).trim().slice(0, 2000),
    relatedParticipationId: payload.relatedParticipationId || null,
    offsetClaim: false,
    disclaimer: DISCLAIMER,
    createdAt: now.toISOString()
  });
  return withSupportFlags(appreciation);
}

function listAppreciations(store, { organizationId = null, actor = null } = {}) {
  const subjectId = organizationId || actor?.organizationId;
  return store.findMany('appreciations', (item) => {
    if (subjectId) return item.subjectOrganizationId === subjectId || item.fromOrganizationId === subjectId;
    return true;
  }).map((item) => withSupportFlags(item));
}

function ngoDashboardCounts(store, actor) {
  if (!isNgoOrg(actor)) return {};
  const projects = store.findMany('ngoProjects', (item) => item.organizationId === actor.organizationId);
  const openBalanceRequests = store.findMany('balanceRequests', (item) => item.status === 'open');
  const activeParticipations = store.findMany('participations', (item) => {
    if (item.status !== 'active') return false;
    if (item.offeredByOrganizationId === actor.organizationId) return true;
    const project = store.findOne('ngoProjects', (project) => project.id === item.projectId);
    return project?.organizationId === actor.organizationId;
  });
  return {
    projects: projects.length,
    openBalanceRequests: openBalanceRequests.length,
    activeParticipations: activeParticipations.length
  };
}

module.exports = {
  DISCLAIMER,
  createProject,
  listProjects,
  getProject,
  publishProject,
  createBalanceRequest,
  listBalanceRequests,
  offerBalanceSupport,
  acceptBalanceSupport,
  declineBalanceSupport,
  createParticipation,
  listParticipations,
  createAppreciation,
  listAppreciations,
  ngoDashboardCounts,
  withSupportFlags
};
