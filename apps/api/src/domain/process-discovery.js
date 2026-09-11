const { randomUUID } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');

const CATALOG_VERSION = 'process-output-catalog-demo-v1';

const OUTPUT_CATALOG = [
  {
    key: 'captured_co2',
    label: 'Captured CO2 opportunity',
    material: 'captured_co2',
    keywords: ['captured co2', 'captured carbon dioxide', 'ccus', 'carbon capture', 'amine capture', 'flue gas capture'],
    uses: ['concrete curing', 'mineralisation', 'greenhouse enrichment', 'food and beverage processing'],
    evidence: ['capture boundary and measured captured mass', 'purity and impurity report', 'physical form and handling conditions', 'collection period and site'],
    caution: 'Potentially captured CO2 is not available inventory. A measured capture record and fresh quality evidence are required before a listing draft can be published.'
  },
  {
    key: 'co2_stream',
    label: 'CO2 stream requiring capture confirmation',
    material: 'co2_stream',
    keywords: ['co2', 'carbon dioxide', 'flue gas', 'exhaust gas', 'emission'],
    uses: ['capture and purification pathway research', 'industrial process screening'],
    evidence: ['whether capture occurs', 'measured composition', 'capture equipment boundary', 'available quantity and period'],
    caution: 'The process description mentions CO2 but does not establish that it is captured or commercially available.'
  },
  {
    key: 'waste_heat',
    label: 'Recoverable waste heat opportunity',
    material: 'waste_heat',
    keywords: ['waste heat', 'hot exhaust', 'thermal energy', 'heat recovery', 'kiln heat', 'steam'],
    uses: ['process heating', 'district or campus heating', 'industrial heat recovery'],
    evidence: ['temperature profile', 'thermal power over time', 'recovery point and access', 'availability window'],
    caution: 'Heat is a resource opportunity in this release. It is not interchangeable with captured CO2 and cannot be published through the CO2 listing flow.'
  },
  {
    key: 'mineral_residue',
    label: 'Mineral or solid residue opportunity',
    material: 'mineral_residue',
    keywords: ['ash', 'slag', 'kiln dust', 'mineral residue', 'solid residue', 'aggregate', 'byproduct powder'],
    uses: ['construction material research', 'cementitious blending research', 'aggregate substitution research'],
    evidence: ['particle size and composition', 'leachability and safety tests', 'mass available and storage', 'handling classification'],
    caution: 'Solid residue requires a category-specific quality and safety adapter before it can become tradable inventory.'
  },
  {
    key: 'organic_residue',
    label: 'Organic residue opportunity',
    material: 'organic_residue',
    keywords: ['organic waste', 'food waste', 'biomass residue', 'spent grain', 'sludge', 'digestate'],
    uses: ['anaerobic digestion research', 'soil amendment research', 'material recovery research'],
    evidence: ['moisture and contamination', 'mass and collection period', 'storage stability', 'regulatory handling category'],
    caution: 'Organic outputs need an approved category adapter and safety review. They are not CO2 listings.'
  },
  {
    key: 'process_water',
    label: 'Process water or liquid residue opportunity',
    material: 'process_water',
    keywords: ['process water', 'wastewater', 'liquid effluent', 'liquid residue', 'brine'],
    uses: ['water recovery research', 'industrial reuse screening'],
    evidence: ['flow volume and chemistry', 'contaminants', 'treatment boundary', 'discharge or reuse authorization'],
    caution: 'Liquid residues need a separate safety, chemistry and authorization workflow before any market action.'
  }
];

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function scoreOutput(text, output) {
  const hits = output.keywords.filter((keyword) => text.includes(keyword));
  const score = Math.min(0.96, 0.42 + hits.length * 0.12);
  return { hits, score: Number(score.toFixed(2)) };
}

function summarizeStructuredFields(input) {
  if (!input || typeof input !== 'object') return { declaredInputs: [], declaredSteps: [], declaredOutputs: [], declaredScale: null, declaredPeriod: null };
  return {
    declaredInputs: Array.isArray(input.inputs) ? input.inputs.slice(0, 20) : [],
    declaredSteps: Array.isArray(input.steps) ? input.steps.slice(0, 30) : [],
    declaredOutputs: Array.isArray(input.outputs) ? input.outputs.slice(0, 20) : [],
    declaredScale: input.scale || null,
    declaredPeriod: input.period || null
  };
}

function discoverProcess(store, { actorOrganizationId, description, structured = {}, processId = null, now = new Date() }) {
  const rawText = normalizeText(description);
  requireValue(rawText, 'description');
  if (rawText.length < 24) throw new DomainError('INSUFFICIENT_DESCRIPTION', 'Describe the main inputs, steps and outputs in at least one sentence');
  if (rawText.length > 12000) throw new DomainError('DESCRIPTION_TOO_LARGE', 'Process description is limited to 12,000 characters');

  const normalized = rawText.toLowerCase();
  const matched = OUTPUT_CATALOG.map((output) => ({ output, ...scoreOutput(normalized, output) }))
    .filter((item) => item.hits.length > 0)
    .sort((left, right) => right.score - left.score || left.output.key.localeCompare(right.output.key));
  const structuredFields = summarizeStructuredFields(structured);

  const process = processId
    ? store.findOne('processes', (item) => item.id === processId)
    : null;
  if (processId && (!process || process.organizationId !== actorOrganizationId)) {
    throw new DomainError('NOT_FOUND', 'Process was not found in the active organization', 404);
  }

  const savedProcess = process
    ? store.replace('processes', process.id, {
        rawDescription: rawText,
        structuredFields,
        updatedAt: now.toISOString(),
        version: (process.version || 1) + 1
      })
    : store.insert('processes', {
        id: `process-${randomUUID()}`,
        organizationId: actorOrganizationId,
        rawDescription: rawText,
        structuredFields,
        state: 'analyzed',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        version: 1,
        synthetic: false
      });

  if (process) {
    store.discoveryCandidates = store.discoveryCandidates.filter((candidate) => candidate.processId !== process.id);
  }

  const candidates = matched.map(({ output, hits, score }) => {
    const isCaptured = output.material === 'captured_co2';
    const explicitCapture = /capture|ccus|captured/.test(normalized);
    const discoveryStatus = isCaptured && !explicitCapture ? 'needs_confirmation' : 'hypothesis';
    return store.insert('discoveryCandidates', {
      id: `discovery-candidate-${randomUUID()}`,
      processId: savedProcess.id,
      organizationId: actorOrganizationId,
      key: output.key,
      label: output.label,
      material: output.material,
      status: discoveryStatus,
      confidence: score,
      matchedSignals: hits,
      quantity: null,
      purity: null,
      price: null,
      potentialUses: output.uses,
      evidenceRequired: output.evidence,
      rationale: isCaptured && explicitCapture
        ? 'The description includes a capture signal; the amount and quality still need evidence.'
        : 'The output was inferred from process language and must be verified by the operator.',
      caution: output.caution,
      sourceRefs: [{ id: CATALOG_VERSION, kind: 'synthetic_catalog', locator: output.key }],
      canPublish: false,
      createdAt: now.toISOString()
    });
  });

  if (candidates.length === 0) {
    candidates.push(store.insert('discoveryCandidates', {
      id: `discovery-candidate-${randomUUID()}`,
      processId: savedProcess.id,
      organizationId: actorOrganizationId,
      key: 'unclassified_output',
      label: 'Unclassified output requiring review',
      material: 'unsupported',
      status: 'needs_confirmation',
      confidence: 0.2,
      matchedSignals: [],
      quantity: null,
      purity: null,
      price: null,
      potentialUses: [],
      evidenceRequired: ['name and physical state', 'quantity and period', 'composition or quality data', 'safe handling and use context'],
      rationale: 'No catalog signal was strong enough to classify the output.',
      caution: 'Keep this as a research opportunity until a category adapter and evidence are available.',
      sourceRefs: [{ id: CATALOG_VERSION, kind: 'synthetic_catalog', locator: 'unclassified' }],
      canPublish: false,
      createdAt: now.toISOString()
    }));
  }

  const missing = [
    structuredFields.declaredScale ? null : 'production scale and time basis',
    structuredFields.declaredPeriod ? null : 'collection or availability period',
    'measured quantity for each selected output',
    'quality/composition evidence for each selected output'
  ].filter(Boolean);

  return {
    process: structuredClone(savedProcess),
    candidates: structuredClone(candidates),
    analysis: {
      catalogVersion: CATALOG_VERSION,
      detectedSignals: matched.flatMap((item) => item.hits),
      missingInformation: missing,
      nextSteps: ['Review each opportunity and remove false positives', 'Add measured quantity and period', 'Attach quality or composition evidence', 'Use the category-specific editor before preparing a listing'],
      canPrepareListing: false,
      warning: 'AI discovery identifies possibilities. It does not create verified inventory, legal approval, certification, market price or climate credit.'
    }
  };
}

function getProcess(store, processId, actorOrganizationId) {
  const process = store.findOne('processes', (item) => item.id === processId);
  if (!process || (actorOrganizationId && process.organizationId !== actorOrganizationId)) throw new DomainError('NOT_FOUND', 'Process was not found in the active organization', 404);
  return {
    process: structuredClone(process),
    candidates: structuredClone(store.findMany('discoveryCandidates', (item) => item.processId === processId))
  };
}

module.exports = { CATALOG_VERSION, OUTPUT_CATALOG, discoverProcess, getProcess };
