function number(data, key) {
  const value = Number(data?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function confidence(data, fields) {
  const complete = fields.filter((field) => number(data, field) !== null).length;
  return { score: Math.round((complete / fields.length) * 100), level: complete === fields.length ? 'high' : complete >= Math.ceil(fields.length * 0.6) ? 'medium' : 'low' };
}

function supplierAssessment(store, actor) {
  const data = store.findOne('organizationProfiles', (item) => item.organizationId === actor.organizationId)?.data || {};
  const production = number(data, 'annualProductionTonnes');
  const process = number(data, 'annualProcessCo2Tonnes') || 0;
  const fuel = number(data, 'annualFuelCo2Tonnes') || 0;
  const electricityKwh = number(data, 'annualElectricityKwh') || 0;
  const factor = number(data, 'gridEmissionFactorKgPerKwh') ?? 0.7;
  const scope2 = electricityKwh * factor / 1000;
  const total = process + fuel + scope2;
  const captured = number(data, 'annualCapturedCo2Tonnes') || 0;
  const buyerDemand = store.findMany('requirements', (item) => item.state === 'published' && item.organizationId !== actor.organizationId).reduce((sum, item) => sum + (Number(item.quantityTonnes) || 0), 0);
  const buyers = store.findMany('requirements', (item) => item.state === 'published' && item.organizationId !== actor.organizationId).length;
  const excess = Math.max(0, captured - buyerDemand);
  const actions = [];
  if (scope2 > 0) actions.push({ priority: 1, title: 'Cut electricity intensity first', rationale: `${Math.round(scope2)} tCO₂e/year is estimated from ${electricityKwh.toLocaleString()} kWh of electricity. Meter compressors, motors and heat systems by line; target leaks, VFDs and heat recovery before buying attributes.`, estimatedReductionTonnes: Math.round(scope2 * 0.08), evidenceNeeded: '12 monthly electricity bills or meter exports' });
  if (process > 0) actions.push({ priority: actions.length + 1, title: 'Optimize the emissions-generating process', rationale: `${Math.round(process)} tCO₂e/year is reported as process CO₂. Review kiln/boiler set points, feedstock and capture efficiency with an engineer; utilization alone does not reduce this source.`, estimatedReductionTonnes: Math.round(process * 0.06), evidenceNeeded: 'Process meter or mass-balance records' });
  if (fuel > 0) actions.push({ priority: actions.length + 1, title: 'Reduce fuel combustion emissions', rationale: `${Math.round(fuel)} tCO₂e/year is reported from stationary fuel use. Compare combustion efficiency, insulation, waste heat recovery and lower-carbon fuel options.`, estimatedReductionTonnes: Math.round(fuel * 0.05), evidenceNeeded: 'Fuel purchase and consumption records by fuel type' });
  if (excess > 0) actions.push({ priority: actions.length + 1, title: 'Do not treat excess captured CO₂ as a reduction', rationale: `${Math.round(excess)} t/year of captured CO₂ exceeds current marketplace demand (${Math.round(buyerDemand)} t across ${buyers} buyer request${buyers === 1 ? '' : 's'}). Aggregate demand, improve storage/logistics, and prioritize upstream reduction of uncaptured emissions.`, estimatedReductionTonnes: 0, evidenceNeeded: 'Capture meter and delivery records' });
  if (!actions.length) actions.push({ priority: 1, title: 'Complete the facility baseline', rationale: 'Enter annual production, process CO₂, fuel CO₂ and electricity kWh to generate facility-specific actions.', estimatedReductionTonnes: null, evidenceNeeded: 'Production records, electricity bills, and fuel/process records' });
  return { role: 'supplier', methodology: 'Operational estimate: Scope 1 process + fuel, Scope 2 electricity. This is a planning estimate, not a verified inventory.', emissions: { scope1ProcessTonnes: process, scope1FuelTonnes: fuel, scope2ElectricityTonnes: Number(scope2.toFixed(2)), totalTonnes: Number(total.toFixed(2)), intensityTonnesPerProduct: production ? Number((total / production).toFixed(4)) : null, electricityKwh, gridEmissionFactorKgPerKwh: factor }, marketContext: { annualCapturedTonnes: captured, visibleBuyerDemandTonnes: buyerDemand, averageBuyerRequestTonnes: buyers ? Number((buyerDemand / buyers).toFixed(2)) : null, excessCapturedTonnes: excess }, confidence: confidence(data, ['annualProductionTonnes', 'annualProcessCo2Tonnes', 'annualFuelCo2Tonnes', 'annualElectricityKwh']), actions };
}

function generalAssessment(store, actor) {
  const data = store.findOne('organizationProfiles', (item) => item.organizationId === actor.organizationId)?.data || {};
  if (actor.organization.kind === 'buyer') return { role: 'buyer', methodology: 'Buyer readiness assessment; disclosed electricity and current CO₂ source are used to prioritize lower-emission procurement.', confidence: confidence(data, ['annualProductionTonnes', 'annualElectricityKwh']), actions: [{ priority: 1, title: 'Measure the receiving process', rationale: 'Record monthly electricity use, production volume and current CO₂ source before comparing supplier offers.', estimatedReductionTonnes: null, evidenceNeeded: 'Electricity bills and CO₂ purchase/delivery records' }, { priority: 2, title: 'Buy on delivered emissions, not just tonnes', rationale: 'Compare supplier purity, transport distance, capture evidence and delivery schedule.', estimatedReductionTonnes: null, evidenceNeeded: 'Supplier quality reports and transport plan' }] };
  return { role: 'ngo', methodology: 'NGO intervention readiness assessment; projects support residual emissions but do not erase a facility inventory.', confidence: confidence(data, ['projectBaselineTonnes', 'expectedAnnualReductionTonnes']), actions: [{ priority: 1, title: 'Set a monitored project baseline', rationale: 'Record the pre-project emissions, beneficiary, geography and measurement method.', estimatedReductionTonnes: number(data, 'expectedAnnualReductionTonnes'), evidenceNeeded: 'Baseline methodology and monitoring plan' }, { priority: 2, title: 'Prioritize facilities with documented residual emissions', rationale: 'Offer labor, greening or funding after operational reduction actions are identified.', estimatedReductionTonnes: null, evidenceNeeded: 'Facility assessment and project reporting cadence' }] };
}

function getAssessment(store, actor) { return actor.organization.kind === 'supplier' ? supplierAssessment(store, actor) : generalAssessment(store, actor); }
module.exports = { getAssessment };
