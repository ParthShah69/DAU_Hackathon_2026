const { randomUUID } = require('node:crypto');
const { DomainError } = require('./errors');
const { decimal, clamp, roundMoney } = require('./numeric');

const ENGINE_VERSION = 'deterministic-linear-road-demo-v1';

function asDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError('INVALID_DATE', `${field} must be an ISO date or timestamp`);
  }
  return date;
}

function covers(period, requirement) {
  return period.start <= requirement.periodStart && period.end >= requirement.periodEnd;
}

function newestReport(store, streamId) {
  return store.findMany('qualityReports', (report) => report.streamId === streamId)
    .sort((left, right) => String(right.sampledAt).localeCompare(String(left.sampledAt)))[0] || null;
}

function resultMap(store, qualityReportId) {
  return new Map(store.findMany('analyteResults', (result) => result.qualityReportId === qualityReportId)
    .map((result) => [`${result.analyte}|${result.unit}|${result.basis}`, result]));
}

function addCheck(checks, code, label, status, observed = null, required = null, message = null) {
  checks.push({ code, label, status, observed, required, message });
}

function evaluateCandidate(store, stream, requirement, now) {
  const checks = [];
  const periods = store.findMany('supplyPeriods', (period) => period.streamId === stream.id);
  const period = periods.find((candidate) => covers(candidate, requirement)) || null;
  const quality = newestReport(store, stream.id);

  addCheck(checks, 'PUBLISHED', 'Published listing', stream.state === 'published' ? 'pass' : 'fail', stream.state, 'published', stream.state === 'published' ? null : 'Listing is not published');
  addCheck(checks, 'PERIOD_COVERAGE', 'Supply period covers requirement', period ? 'pass' : 'fail', period ? `${period.start}/${period.end}` : null, `${requirement.periodStart}/${requirement.periodEnd}`, period ? null : 'No single supply period covers the requested interval');
  addCheck(checks, 'PHYSICAL_FORM', 'Physical form', requirement.acceptableForms.includes(stream.physicalForm) ? 'pass' : 'fail', stream.physicalForm, requirement.acceptableForms, requirement.acceptableForms.includes(stream.physicalForm) ? null : 'Form is outside the buyer requirement');

  const qualityFresh = quality && asDate(quality.expiresAt, 'quality.expiresAt') > now;
  if (!quality) {
    addCheck(checks, 'QUALITY_EVIDENCE', 'Quality evidence exists', 'unknown', null, 'fresh quality report', 'No quality report is available');
    addCheck(checks, 'PURITY_MIN', 'Minimum purity', 'unknown', null, requirement.minimumPurityMolPct, 'Purity cannot be checked without a quality report');
  } else if (!qualityFresh) {
    addCheck(checks, 'QUALITY_EVIDENCE', 'Quality evidence is fresh', 'unknown', quality.expiresAt, 'after evaluation time', 'Quality report has expired');
    addCheck(checks, 'PURITY_MIN', 'Minimum purity', 'unknown', quality.purityMolPct, requirement.minimumPurityMolPct, 'Purity is present but the report is expired');
  } else {
    addCheck(checks, 'QUALITY_EVIDENCE', 'Quality evidence is fresh', 'pass', quality.evidenceStatus, 'fresh report', null);
    const purity = decimal(quality.purityMolPct, 'quality.purityMolPct', { min: 0, max: 100 });
    const minimumPurity = decimal(requirement.minimumPurityMolPct, 'minimumPurityMolPct', { min: 0, max: 100 });
    addCheck(checks, 'PURITY_MIN', 'Minimum purity', purity >= minimumPurity ? 'pass' : 'fail', purity, minimumPurity, purity >= minimumPurity ? null : `Purity is ${minimumPurity - purity} percentage points below the minimum`);
  }

  const analytes = qualityFresh ? resultMap(store, quality?.id) : new Map();
  for (const limit of requirement.limits || []) {
    const analyte = analytes.get(`${limit.analyte}|${limit.unit}|${limit.basis}`);
    if (!analyte) {
      addCheck(checks, `ANALYTE_${limit.analyte}`, `${limit.analyte} limit`, 'unknown', null, `${limit.maxValue} ${limit.unit} (${limit.basis})`, 'Required analyte is missing or has a non-comparable basis');
      continue;
    }
    const value = decimal(analyte.value, `analyte.${limit.analyte}`, { min: 0 });
    const maximum = decimal(limit.maxValue, `limit.${limit.analyte}`, { min: 0 });
    addCheck(checks, `ANALYTE_${limit.analyte}`, `${limit.analyte} limit`, value <= maximum ? 'pass' : 'fail', `${value} ${analyte.unit}`, `${maximum} ${limit.unit}`, value <= maximum ? null : `${limit.analyte} exceeds the buyer limit`);
  }

  const remaining = period ? decimal(period.totalTonnes, 'period.totalTonnes', { min: 0 }) - decimal(period.reservedTonnes, 'period.reservedTonnes', { min: 0 }) : null;
  const requiredTonnes = decimal(requirement.quantityTonnes, 'quantityTonnes', { min: 0 });
  if (!period) {
    addCheck(checks, 'MIN_ORDER', 'Minimum order and availability', 'unknown', null, requiredTonnes, 'Availability cannot be checked without a covering period');
  } else {
    const minimumOrder = decimal(period.minimumOrderTonnes, 'period.minimumOrderTonnes', { min: 0 });
    addCheck(checks, 'MIN_ORDER', 'Minimum order', requiredTonnes >= minimumOrder ? 'pass' : 'fail', requiredTonnes, minimumOrder, requiredTonnes >= minimumOrder ? null : 'Requested quantity is below the minimum order');
    addCheck(checks, 'REMAINING_QUANTITY', 'Remaining quantity', remaining >= requiredTonnes ? 'pass' : 'fail', remaining, requiredTonnes, remaining >= requiredTonnes ? null : `Short by ${requiredTonnes - remaining} tonnes`);
  }

  const distance = store.findOne('distanceEstimates', (estimate) => estimate.originSiteId === stream.siteId && estimate.destinationSiteId === requirement.siteId) || null;
  const distanceKm = distance ? decimal(distance.distanceKm, 'distance.distanceKm', { min: 0 }) : null;
  if (requirement.maxDistanceKm !== null && requirement.maxDistanceKm !== undefined) {
    const maximumDistance = decimal(requirement.maxDistanceKm, 'maxDistanceKm', { min: 0 });
    addCheck(checks, 'MAX_DISTANCE', 'Maximum distance', distanceKm === null ? 'unknown' : distanceKm <= maximumDistance ? 'pass' : 'fail', distanceKm, maximumDistance, distanceKm === null ? 'Route estimate is unavailable' : distanceKm <= maximumDistance ? null : 'Estimated route is beyond the buyer limit');
  }

  const rateCard = store.rateCards[0];
  let economics = null;
  if (period && distanceKm !== null && rateCard) {
    const listed = decimal(period.listedPricePaisePerTonne, 'listedPricePaisePerTonne', { min: 0 });
    const handling = decimal(rateCard.handlingPaisePerTonne, 'handlingPaisePerTonne', { min: 0 });
    const rate = decimal(rateCard.ratePaisePerTonneKm, 'ratePaisePerTonneKm', { min: 0 });
    const logistics = handling + distanceKm * rate;
    const delivered = listed + logistics;
    const total = roundMoney(delivered * requiredTonnes);
    economics = {
      currency: period.currency,
      listedPaisePerTonne: listed,
      distanceKm,
      handlingPaisePerTonne: handling,
      ratePaisePerTonneKm: rate,
      logisticsPaisePerTonne: logistics,
      deliveredPaisePerTonne: delivered,
      orderTonnes: requiredTonnes,
      orderTotalPaise: total,
      formulaVersion: rateCard.version,
      exclusions: ['taxes', 'loading_equipment', 'conditioning', 'tanker_availability', 'hazmat_constraints', 'tolls', 'scheduling']
    };
    if (requirement.maxDeliveredPaisePerTonne !== null && requirement.maxDeliveredPaisePerTonne !== undefined) {
      const maxBudget = decimal(requirement.maxDeliveredPaisePerTonne, 'maxDeliveredPaisePerTonne', { min: 0 });
      addCheck(checks, 'DELIVERED_BUDGET', 'Delivered budget', delivered <= maxBudget ? 'pass' : 'fail', delivered, maxBudget, delivered <= maxBudget ? null : 'Estimated delivered price exceeds the buyer budget');
    }
  } else if (requirement.maxDeliveredPaisePerTonne !== null && requirement.maxDeliveredPaisePerTonne !== undefined) {
    addCheck(checks, 'DELIVERED_BUDGET', 'Delivered budget', 'unknown', null, requirement.maxDeliveredPaisePerTonne, 'Delivered estimate is unavailable');
  }

  const hasFailure = checks.some((check) => check.status === 'fail');
  const hasUnknown = checks.some((check) => check.status === 'unknown');
  const status = hasFailure ? 'incompatible' : hasUnknown ? 'needs_evidence' : 'compatible';
  const ageDays = quality ? Math.max(0, (now.getTime() - asDate(quality.sampledAt, 'quality.sampledAt').getTime()) / 86400000) : null;
  let score = null;
  let scoreComponents = null;
  if (status === 'compatible' && economics && period && quality) {
    const remainingTonnes = decimal(period.totalTonnes, 'period.totalTonnes', { min: 0 }) - decimal(period.reservedTonnes, 'period.reservedTonnes', { min: 0 });
    const costFit = clamp(1 - economics.deliveredPaisePerTonne / 400000);
    const distanceFit = clamp(1 - economics.distanceKm / 600);
    const quantityHeadroom = clamp((remainingTonnes - requiredTonnes) / requiredTonnes);
    const evidenceFreshness = clamp(1 - ageDays / 30);
    scoreComponents = { costFit, distanceFit, quantityHeadroom, evidenceFreshness };
    score = Number((100 * (0.45 * costFit + 0.2 * distanceFit + 0.15 * quantityHeadroom + 0.2 * evidenceFreshness)).toFixed(2));
  }

  const explanation = checks.filter((check) => check.status !== 'pass').map((check) => check.message || check.label);
  return {
    id: `match-result-${randomUUID()}`,
    streamId: stream.id,
    streamName: stream.name,
    supplierOrganizationId: stream.organizationId,
    supplyPeriodId: period?.id || null,
    qualityReportId: quality?.id || null,
    status,
    checks,
    economics,
    score,
    scoreComponents,
    explanation,
    evaluatedAt: now.toISOString(),
    engineVersion: ENGINE_VERSION
  };
}

function runMatch(store, { requirementId, actorOrganizationId, now = new Date(), requirementOverride = null, scenarioOf = null }) {
  const requirement = requirementOverride || store.findOne('requirements', (item) => item.id === requirementId);
  if (!requirement) throw new DomainError('NOT_FOUND', `Requirement ${requirementId} was not found`, 404);
  if (actorOrganizationId && requirement.organizationId !== actorOrganizationId) {
    throw new DomainError('FORBIDDEN', 'Requirement is outside the active organization', 403);
  }
  asDate(requirement.periodStart, 'periodStart');
  asDate(requirement.periodEnd, 'periodEnd');
  if (requirement.periodEnd < requirement.periodStart) throw new DomainError('INVALID_PERIOD', 'Requirement period end must be after start');
  decimal(requirement.quantityTonnes, 'quantityTonnes', { min: 0.000001 });

  const candidates = store.findMany('streams', (stream) => stream.state === 'published');
  const results = candidates.map((stream) => evaluateCandidate(store, stream, requirement, now));
  results.sort((left, right) => {
    const rank = { compatible: 0, needs_evidence: 1, incompatible: 2 };
    if (rank[left.status] !== rank[right.status]) return rank[left.status] - rank[right.status];
    if ((right.score ?? -1) !== (left.score ?? -1)) return (right.score ?? -1) - (left.score ?? -1);
    if ((left.economics?.deliveredPaisePerTonne ?? Number.MAX_SAFE_INTEGER) !== (right.economics?.deliveredPaisePerTonne ?? Number.MAX_SAFE_INTEGER)) return (left.economics?.deliveredPaisePerTonne ?? Number.MAX_SAFE_INTEGER) - (right.economics?.deliveredPaisePerTonne ?? Number.MAX_SAFE_INTEGER);
    return left.streamId.localeCompare(right.streamId);
  });

  const run = store.insert('matchRuns', {
    id: `match-run-${randomUUID()}`,
    requirementId,
    scenarioOf,
    requesterOrganizationId: requirement.organizationId,
    requirementSnapshot: structuredClone(requirement),
    status: 'completed',
    engineVersion: ENGINE_VERSION,
    rateCardVersion: store.rateCards[0]?.version || null,
    evaluatedAt: now.toISOString(),
    resultIds: results.map((result) => result.id)
  });
  for (const result of results) {
    store.insert('matchResults', { ...result, matchRunId: run.id });
  }
  return {
    run,
    requirement: structuredClone(requirement),
    results,
    groups: {
      compatible: results.filter((result) => result.status === 'compatible'),
      needsEvidence: results.filter((result) => result.status === 'needs_evidence'),
      incompatible: results.filter((result) => result.status === 'incompatible')
    }
  };
}

function getMatchRun(store, runId, actorOrganizationId) {
  const run = store.findOne('matchRuns', (item) => item.id === runId);
  if (!run) throw new DomainError('NOT_FOUND', `Match run ${runId} was not found`, 404);
  if (actorOrganizationId && run.requesterOrganizationId !== actorOrganizationId) throw new DomainError('FORBIDDEN', 'Match run is outside the active organization', 403);
  const results = store.findMany('matchResults', (item) => item.matchRunId === runId);
  return { run: structuredClone(run), results: structuredClone(results) };
}

module.exports = { ENGINE_VERSION, runMatch, getMatchRun };
