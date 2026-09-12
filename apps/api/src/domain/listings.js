const { randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');
const { decimal } = require('./numeric');

const PHYSICAL_FORMS = new Set(['gas', 'liquid', 'solid']);
const STREAM_STATES = new Set(['draft', 'published', 'archived']);

function dateOnly(value, field) {
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new DomainError('INVALID_DATE', `${field} must be an ISO date`);
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new DomainError('INVALID_DATE', `${field} must be a valid calendar date`);
  return text;
}

function ownedSite(store, siteId, organizationId) {
  const site = store.findOne('sites', (item) => item.id === siteId && item.organizationId === organizationId);
  if (!site) throw new DomainError('FORBIDDEN', 'Listing site is outside the active organization', 403);
  return site;
}

function normalizePeriod(period, streamId) {
  const start = dateOnly(requireValue(period.start ?? period.start_date, 'supply period start'), 'supply period start');
  const end = dateOnly(requireValue(period.end ?? period.end_date, 'supply period end'), 'supply period end');
  if (end <= start) throw new DomainError('INVALID_PERIOD', 'Supply period end must be after start');
  const totalTonnes = decimal(requireValue(period.totalTonnes ?? period.total_t, 'supply period totalTonnes'), 'totalTonnes', { min: 0.000001 });
  const minimumOrderTonnes = decimal(period.minimumOrderTonnes ?? period.min_order_t ?? 0, 'minimumOrderTonnes', { min: 0 });
  const listedPricePaisePerTonne = Math.round(decimal(requireValue(period.listedPricePaisePerTonne ?? period.price_minor_per_t, 'listedPricePaisePerTonne'), 'listedPricePaisePerTonne', { min: 0 }));
  if (minimumOrderTonnes > totalTonnes) throw new DomainError('INVALID_PERIOD', 'Minimum order cannot exceed total quantity');
  return {
    id: period.id || `period-${randomUUID()}`,
    streamId,
    start,
    end,
    totalTonnes: String(totalTonnes),
    reservedTonnes: '0',
    minimumOrderTonnes: String(minimumOrderTonnes),
    listedPricePaisePerTonne,
    currency: String(period.currency || 'INR'),
    version: 1
  };
}

function normalizeQuality(store, streamId, quality, now) {
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) throw new DomainError('VALIDATION_ERROR', 'quality must be an object');
  const purityMolPct = decimal(requireValue(quality.purityMolPct ?? quality.purity, 'quality.purityMolPct'), 'quality.purityMolPct', { min: 0, max: 100 });
  const basis = String(quality.basis || 'dry');
  const sampledAt = quality.sampledAt || now.toISOString();
  const expiresAt = quality.expiresAt || new Date(new Date(sampledAt).getTime() + 30 * 86400000).toISOString();
  if (Number.isNaN(new Date(sampledAt).getTime()) || Number.isNaN(new Date(expiresAt).getTime())) throw new DomainError('INVALID_DATE', 'Quality sampledAt and expiresAt must be valid timestamps');
  const report = {
    id: quality.id || `quality-${randomUUID()}`,
    streamId,
    purityMolPct: String(purityMolPct),
    basis,
    sampledAt: new Date(sampledAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    evidenceStatus: String(quality.evidenceStatus || 'self_reported'),
    synthetic: false,
    version: 1
  };
  const analytes = Array.isArray(quality.analytes) ? quality.analytes.slice(0, 50).map((analyte) => ({
    qualityReportId: report.id,
    analyte: requireValue(analyte.analyte ?? analyte.code, 'quality analyte'),
    value: analyte.value === null || analyte.value === undefined ? null : String(decimal(analyte.value, `quality.${analyte.analyte ?? analyte.code}`, { min: 0 })),
    unit: requireValue(analyte.unit, 'quality analyte unit'),
    basis: requireValue(analyte.basis, 'quality analyte basis'),
    qualifier: String(analyte.qualifier || 'measured')
  })) : [];
  return { report, analytes };
}

function createListing(store, { actorOrganizationId, payload, now = new Date() }) {
  const siteId = requireValue(payload.siteId ?? payload.supplierSiteId ?? payload.supplier_site_id, 'siteId');
  ownedSite(store, siteId, actorOrganizationId);
  const physicalForm = String(payload.physicalForm ?? payload.physical_form ?? 'gas');
  if (!PHYSICAL_FORMS.has(physicalForm)) throw new DomainError('VALIDATION_ERROR', 'physicalForm must be gas, liquid or solid');
  const stream = store.insert('streams', {
    id: payload.id || `stream-${randomUUID()}`,
    organizationId: actorOrganizationId,
    siteId,
    name: String(payload.name || 'Untitled supply stream').trim().slice(0, 160),
    sourceIndustry: String(payload.sourceIndustry ?? payload.source_industry ?? 'unspecified').trim().slice(0, 100),
    physicalForm,
    co2Origin: String(payload.co2Origin ?? payload.co2_origin ?? 'unknown'),
    state: 'draft',
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    synthetic: false
  });
  const periods = Array.isArray(payload.supplyPeriods ?? payload.supply_periods) ? (payload.supplyPeriods ?? payload.supply_periods).map((period) => normalizePeriod(period, stream.id)) : [];
  for (const period of periods) store.insert('supplyPeriods', period);
  if (payload.quality) {
    const quality = normalizeQuality(store, stream.id, payload.quality, now);
    store.insert('qualityReports', quality.report);
    for (const analyte of quality.analytes) store.insert('analyteResults', analyte);
  }
  return structuredClone(stream);
}

function getListing(store, listingId, actorOrganizationId, { allowDraftOwner = true } = {}) {
  const stream = store.findOne('streams', (item) => item.id === listingId);
  if (!stream) throw new DomainError('NOT_FOUND', 'Listing was not found', 404);
  if (stream.state !== 'published' && (!allowDraftOwner || stream.organizationId !== actorOrganizationId)) throw new DomainError('NOT_FOUND', 'Listing was not found', 404);
  if (stream.state !== 'published' && stream.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Listing is outside the active organization', 403);
  return structuredClone(stream);
}

function patchListing(store, { listingId, actorOrganizationId, payload, now = new Date() }) {
  const stream = getListing(store, listingId, actorOrganizationId);
  if (stream.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Only the owning organization can edit this listing', 403);
  if (payload.version === undefined || Number(payload.version) !== Number(stream.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Listing changed; refresh it before editing', 409);
  const update = {};
  if (payload.name !== undefined) update.name = String(payload.name).trim().slice(0, 160);
  if (payload.sourceIndustry !== undefined || payload.source_industry !== undefined) update.sourceIndustry = String(payload.sourceIndustry ?? payload.source_industry).trim().slice(0, 100);
  if (payload.physicalForm !== undefined || payload.physical_form !== undefined) {
    const form = String(payload.physicalForm ?? payload.physical_form);
    if (!PHYSICAL_FORMS.has(form)) throw new DomainError('VALIDATION_ERROR', 'physicalForm must be gas, liquid or solid');
    update.physicalForm = form;
  }
  if (payload.co2Origin !== undefined || payload.co2_origin !== undefined) update.co2Origin = String(payload.co2Origin ?? payload.co2_origin);
  update.updatedAt = now.toISOString();
  update.version = Number(stream.version || 1) + 1;
  return store.replace('streams', listingId, update);
}

function publishListing(store, { listingId, actorOrganizationId, expectedVersion, now = new Date() }) {
  const stream = getListing(store, listingId, actorOrganizationId);
  if (stream.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Only the owning organization can publish this listing', 403);
  if (expectedVersion === undefined || Number(expectedVersion) !== Number(stream.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Listing changed; refresh it before publishing', 409);
  if (stream.state === 'published') return stream;
  const periods = store.findMany('supplyPeriods', (item) => item.streamId === stream.id);
  if (periods.length === 0) throw new DomainError('PUBLICATION_BLOCKED', 'Add at least one bounded supply period before publishing', 422);
  if (periods.some((period) => Number(period.totalTonnes) <= 0 || Number(period.totalTonnes) < Number(period.minimumOrderTonnes))) throw new DomainError('PUBLICATION_BLOCKED', 'Supply periods need positive capacity and a valid minimum order', 422);
  const quality = store.findMany('qualityReports', (item) => item.streamId === stream.id).sort((left, right) => String(right.sampledAt).localeCompare(String(left.sampledAt)))[0];
  if (!quality) throw new DomainError('PUBLICATION_BLOCKED', 'Add a quality report before publishing', 422);
  if (new Date(quality.expiresAt) <= now) throw new DomainError('PUBLICATION_BLOCKED', 'Quality report is expired; add a fresh report before publishing', 422);
  const updated = store.replace('streams', stream.id, { state: 'published', version: Number(stream.version || 1) + 1, updatedAt: now.toISOString() });
  return updated;
}

function archiveListing(store, { listingId, actorOrganizationId, expectedVersion, now = new Date() }) {
  const stream = getListing(store, listingId, actorOrganizationId);
  if (stream.organizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Only the owning organization can archive this listing', 403);
  if (expectedVersion === undefined || Number(expectedVersion) !== Number(stream.version || 1)) throw new DomainError('VERSION_CONFLICT', 'Listing changed; refresh it before archiving', 409);
  return store.replace('streams', stream.id, { state: 'archived', version: Number(stream.version || 1) + 1, updatedAt: now.toISOString() });
}

function listListings(store, { actorOrganizationId = null, state = 'published', sourceIndustry = null } = {}) {
  return store.findMany('streams', (stream) => stream.state === state && (!sourceIndustry || stream.sourceIndustry === sourceIndustry) && (state === 'published' || stream.organizationId === actorOrganizationId)).map((stream) => structuredClone(stream));
}

module.exports = { PHYSICAL_FORMS, STREAM_STATES, createListing, getListing, patchListing, publishListing, archiveListing, listListings };
