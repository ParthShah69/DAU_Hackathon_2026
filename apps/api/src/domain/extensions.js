const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DomainError, requireValue } = require('./errors');

// These routes deliberately keep their prototype state separate from the marketplace
// collections.  This makes their in-memory nature explicit and avoids presenting
// fixture data as durable production records.
const policyRules = require('../../../../data/fixtures/v2/policy_rules.json');
const priceObservations = require('../../../../data/fixtures/v2/price_observations.json');
function readJsonLines(name) {
  return readFileSync(join(__dirname, '../../../../data/fixtures/v2', name), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}
const knowledgeDocuments = readJsonLines('knowledge_documents.jsonl');
const knowledgeChunks = readJsonLines('knowledge_chunks.jsonl');

function state(store) {
  if (!store.__carbonBridgeExtensions) {
    Object.defineProperty(store, '__carbonBridgeExtensions', {
      value: { projects: [], participations: [], reviews: [], screenings: [], notifications: [], preferences: [], savedSearches: [] },
      writable: true,
      enumerable: false
    });
  }
  return store.__carbonBridgeExtensions;
}

function own(record, organizationId, label = 'Record') {
  if (!record) throw new DomainError('NOT_FOUND', `${label} was not found`, 404);
  if (record.organizationId !== organizationId) throw new DomainError('FORBIDDEN', `${label} is outside the active organization`, 403);
  return record;
}
function now(store) { return store.now(); }
function notify(store, organizationId, type, title, entityId) {
  return state(store).notifications.push({ id: `notification-${randomUUID()}`, organizationId, type, title, entityId: entityId || null, readAt: null, createdAt: now(store), synthetic: false });
}

function listProjects(store, organizationId) { return structuredClone(state(store).projects.filter((item) => item.organizationId === organizationId)); }
function createProject(store, { organizationId, userId, payload }) {
  const name = String(requireValue(payload.name, 'name')).trim();
  if (!name) throw new DomainError('VALIDATION_ERROR', 'name is required');
  const project = { id: `project-${randomUUID()}`, organizationId, name: name.slice(0, 160), description: payload.description ? String(payload.description).slice(0, 2000) : null, status: 'draft', targets: Array.isArray(payload.targets) ? structuredClone(payload.targets) : [], actionPlan: Array.isArray(payload.actionPlan) ? structuredClone(payload.actionPlan) : [], createdBy: userId, createdAt: now(store), updatedAt: now(store), synthetic: false };
  state(store).projects.push(project); notify(store, organizationId, 'project.created', `Project created: ${project.name}`, project.id); return structuredClone(project);
}
function getProject(store, id, organizationId) { return structuredClone(own(state(store).projects.find((item) => item.id === id), organizationId, 'Project')); }
function addParticipation(store, { projectId, organizationId, userId, payload }) {
  own(state(store).projects.find((item) => item.id === projectId), organizationId, 'Project');
  const participation = { id: `participation-${randomUUID()}`, projectId, organizationId, participantOrganizationId: String(requireValue(payload.organizationId || payload.participantOrganizationId, 'organizationId')), role: String(payload.role || 'contributor'), status: 'invited', invitedBy: userId, createdAt: now(store), updatedAt: now(store) };
  state(store).participations.push(participation); return structuredClone(participation);
}
function listParticipations(store, projectId, organizationId) { own(state(store).projects.find((item) => item.id === projectId), organizationId, 'Project'); return structuredClone(state(store).participations.filter((item) => item.projectId === projectId)); }
function addReview(store, { projectId, organizationId, userId, payload }) {
  own(state(store).projects.find((item) => item.id === projectId), organizationId, 'Project');
  const review = { id: `review-${randomUUID()}`, projectId, organizationId, status: String(payload.status || 'needs_changes'), notes: String(requireValue(payload.notes, 'notes')).slice(0, 4000), reviewedBy: userId, createdAt: now(store) };
  state(store).reviews.push(review); return structuredClone(review);
}
function listReviews(store, projectId, organizationId) { own(state(store).projects.find((item) => item.id === projectId), organizationId, 'Project'); return structuredClone(state(store).reviews.filter((item) => item.projectId === projectId)); }

function listPolicies({ jurisdiction, mechanism, asOf }) {
  const date = asOf ? new Date(asOf) : new Date('2026-09-12T00:00:00Z');
  if (Number.isNaN(date.valueOf())) throw new DomainError('VALIDATION_ERROR', 'asOf must be an ISO date');
  return policyRules.filter((rule) => (!jurisdiction || rule.jurisdiction === jurisdiction || rule.jurisdiction === 'GLOBAL') && (!mechanism || rule.mechanism === mechanism)).map((rule) => ({ ...structuredClone(rule), activeAtAsOf: new Date(rule.effective_from) <= date && (!rule.effective_to || date < new Date(rule.effective_to)), synthetic: true }));
}
function createScreening(store, { organizationId, userId, payload }) {
  const jurisdiction = String(requireValue(payload.jurisdiction, 'jurisdiction'));
  const mechanism = String(requireValue(payload.mechanism, 'mechanism'));
  const asOf = payload.asOf || payload.as_of || '2026-09-12T00:00:00Z';
  const facts = payload.facts && typeof payload.facts === 'object' ? payload.facts : {};
  const rules = listPolicies({ jurisdiction, mechanism, asOf });
  const applicable = rules.filter((rule) => rule.activeAtAsOf);
  const missingFacts = [...new Set(applicable.flatMap((rule) => rule.required_facts).filter((key) => facts[key] === undefined || facts[key] === null || facts[key] === ''))];
  const result = applicable.length === 0 ? 'unknown' : missingFacts.length ? 'unknown' : 'screening_only';
  const screening = { id: `screening-${randomUUID()}`, organizationId, jurisdiction, mechanism, asOf, facts: structuredClone(facts), result, missingFacts, ruleIds: applicable.map((rule) => rule.id), disclaimer: 'This is a fixture-backed policy screening, not legal advice or a carbon-credit eligibility determination.', createdBy: userId, createdAt: now(store), synthetic: true };
  state(store).screenings.push(screening); return structuredClone(screening);
}
function getScreening(store, id, organizationId) { return structuredClone(own(state(store).screenings.find((item) => item.id === id), organizationId, 'Screening')); }

function knowledgeSearch({ query, limit = 10 }) {
  const terms = String(requireValue(query, 'query')).toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  if (!terms.length) throw new DomainError('VALIDATION_ERROR', 'query must contain a meaningful term');
  const docs = new Map(knowledgeDocuments.map((doc) => [doc.id, doc]));
  return knowledgeChunks.map((chunk) => ({ chunk, score: terms.reduce((score, term) => score + (chunk.text.toLowerCase().includes(term) ? 1 : 0), 0) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.chunk.ordinal - b.chunk.ordinal).slice(0, Math.min(Math.max(Number(limit) || 10, 1), 25)).map(({ chunk, score }) => ({ id: chunk.id, score, excerpt: chunk.text, locator: chunk.locator, document: (() => { const doc = docs.get(chunk.document_id); return { id: doc.id, title: doc.title, sourceUri: doc.source_uri, sourceClass: doc.source_class, reviewState: doc.review_state }; })(), synthetic: true }));
}
function searchPrices({ material, geography, observationType, freshness = 'current' }) { return priceObservations.filter((item) => (!material || item.material === material) && (!geography || item.geography === geography) && (!observationType || item.observation_type === observationType) && (!freshness || item.freshness === freshness)).map((item) => ({ ...structuredClone(item), disclaimer: item.is_guaranteed_quote ? null : 'Indicative synthetic market observation; not a guaranteed quote.' })); }

function listNotifications(store, organizationId) { return structuredClone(state(store).notifications.filter((item) => item.organizationId === organizationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
function markNotificationRead(store, id, organizationId) { const item = own(state(store).notifications.find((entry) => entry.id === id), organizationId, 'Notification'); item.readAt = item.readAt || now(store); return structuredClone(item); }
function notificationPreferences(store, organizationId, payload) { const items = state(store).preferences; let preference = items.find((item) => item.organizationId === organizationId); if (!preference) { preference = { id: `notification-preferences-${randomUUID()}`, organizationId, email: false, inApp: true, updatedAt: now(store) }; items.push(preference); } if (payload) { if (payload.email !== undefined) preference.email = Boolean(payload.email); if (payload.inApp !== undefined) preference.inApp = Boolean(payload.inApp); preference.updatedAt = now(store); } return structuredClone(preference); }
function listSavedSearches(store, organizationId) { return structuredClone(state(store).savedSearches.filter((item) => item.organizationId === organizationId)); }
function createSavedSearch(store, { organizationId, userId, payload }) { const name = String(requireValue(payload.name, 'name')).trim(); const query = payload.query && typeof payload.query === 'object' ? structuredClone(payload.query) : {}; const item = { id: `saved-search-${randomUUID()}`, organizationId, name: name.slice(0, 160), query, createdBy: userId, createdAt: now(store), synthetic: false }; state(store).savedSearches.push(item); return structuredClone(item); }
function deleteSavedSearch(store, id, organizationId) { const items = state(store).savedSearches; const index = items.findIndex((item) => item.id === id && item.organizationId === organizationId); if (index < 0) throw new DomainError('NOT_FOUND', 'Saved search was not found', 404); items.splice(index, 1); }

function report(store, organizationId) { const streams = store.findMany('streams', (item) => item.organizationId === organizationId); const requirements = store.findMany('requirements', (item) => item.organizationId === organizationId); const requests = store.findMany('supplyRequests', (item) => item.buyerOrganizationId === organizationId || item.supplierOrganizationId === organizationId); const accepted = requests.filter((item) => item.status === 'accepted'); return { organizationId, generatedAt: now(store), provenance: { kind: store.seedSource?.kind || 'prototype', disclaimer: 'Acceptance is not delivery, reuse, avoidance, or a climate claim.' }, metrics: { listings: streams.length, requirements: requirements.length, requests: requests.length, acceptedRequests: accepted.length, requestedTonnes: requests.reduce((total, item) => total + Number(item.quantityTonnes || 0), 0), reservedTonnes: accepted.reduce((total, item) => total + Number(item.quantityTonnes || 0), 0) } }; }
function workflow(store, id, organizationId) { const row = store.findOne('workflows', (item) => item.id === id); if (!row) throw new DomainError('NOT_FOUND', 'Workflow was not found', 404); const conversation = store.findOne('conversations', (item) => item.id === row.conversationId); if (!conversation || conversation.organizationId !== organizationId) throw new DomainError('FORBIDDEN', 'Workflow is outside the active organization', 403); return row; }
function workflowTransition(store, { id, organizationId, transition }) { const row = workflow(store, id, organizationId); if (transition === 'cancel' && !['completed', 'failed', 'cancelled'].includes(row.state)) return store.replace('workflows', id, { state: 'cancelled', cancelledAt: now(store) }); if (transition === 'resume' && ['failed', 'cancelled'].includes(row.state)) return store.replace('workflows', id, { state: 'resumed', resumedAt: now(store), note: 'Prototype workflow resumed; no background job is started.' }); throw new DomainError('INVALID_WORKFLOW_STATE', `Workflow cannot be ${transition}d from ${row.state}`, 409); }

module.exports = { state, listProjects, createProject, getProject, addParticipation, listParticipations, addReview, listReviews, listPolicies, createScreening, getScreening, knowledgeSearch, searchPrices, listNotifications, markNotificationRead, notificationPreferences, listSavedSearches, createSavedSearch, deleteSavedSearch, report, workflow, workflowTransition };
