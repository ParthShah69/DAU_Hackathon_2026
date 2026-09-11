import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'data', 'fixtures', 'v2');
const schemaVersion = '2.0';
const fixtureClock = '2026-09-12T00:00:00Z';
const expectedFiles = [
  'organizations.json', 'users.json', 'process_profiles.json', 'process_scenarios.json',
  'buyer_specification_examples.json', 'treatment_pathways.json', 'knowledge_sources.json',
  'knowledge_documents.jsonl', 'knowledge_chunks.jsonl', 'policy_rules.json', 'policy_scenarios.json',
  'price_observations.json', 'marketplace_snapshot.json', 'conversation_scenarios.json',
  'assistant_eval_set.jsonl', 'manifest.json',
];
const expectedCounts = {
  organizations: 5, users: 6, process_profiles: 6, process_scenarios: 12,
  buyer_specification_examples: 8, treatment_pathways: 7, knowledge_sources: 12,
  knowledge_documents: 12, knowledge_chunks: 48, policy_rules: 10, policy_scenarios: 8,
  price_observations: 12, conversation_scenarios: 16, assistant_eval_set: 60,
};
const evalCategoryCounts = {
  intent_entity: 10, marketplace_read: 10, process_quality_grounding: 8, environment_policy: 10,
  mutation_confirmation: 8, authorization_privacy: 6, prompt_injection: 5, reliability: 3,
};
const sourceClasses = new Set(['synthetic_demo', 'synthetic_hypothesis', 'official_primary', 'technical_primary', 'organization_provided']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function isDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function loadJson(name) {
  const text = await readFile(path.join(fixtureDir, name), 'utf8');
  return { value: JSON.parse(text), text };
}

async function loadJsonl(name) {
  const text = await readFile(path.join(fixtureDir, name), 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return { value: lines.map((line, index) => {
    try { return JSON.parse(line); } catch (error) { fail(`${name}:${index + 1} is not valid JSONL: ${error.message}`); }
  }), text };
}

function assertCommon(recordValue, label) {
  assert(recordValue && typeof recordValue === 'object' && !Array.isArray(recordValue), `${label} must be an object`);
  assert(uuidPattern.test(recordValue.id), `${label}.id must be a UUID`);
  assert(recordValue.schema_version === schemaVersion, `${label}.schema_version must be ${schemaVersion}`);
  assert(recordValue.created_at === fixtureClock && recordValue.updated_at === fixtureClock, `${label} must use the fixed fixture clock`);
  assert(isDate(recordValue.created_at) && isDate(recordValue.updated_at), `${label} timestamps must be date-time strings`);
  if (recordValue.source_class !== undefined) assert(sourceClasses.has(recordValue.source_class), `${label}.source_class is unsupported`);
  const serialized = JSON.stringify(recordValue).toLowerCase();
  assert(!serialized.includes('api_key') && !serialized.includes('private_key') && !serialized.includes('password'), `${label} contains a secret-like field`);
  assert(!serialized.includes('iot') && !serialized.includes('sensor_device'), `${label} must not introduce IoT device integration`);
}

function assertCollection(values, name, count) {
  assert(Array.isArray(values), `${name} must be an array`);
  assert(values.length === count, `${name} expected ${count} records, received ${values.length}`);
  const seen = new Set();
  values.forEach((value, index) => {
    const label = `${name}[${index}]`;
    assertCommon(value, label);
    assert(!seen.has(value.id), `${name} contains duplicate id ${value.id}`);
    seen.add(value.id);
  });
}

function assertQuantity(value, label) {
  if (value === null || value === undefined) return;
  assert(value && typeof value === 'object', `${label} must be an object or null`);
  if (value.value !== null && value.value !== undefined) {
    assert(typeof value.value === 'string', `${label}.value must be a decimal string or null`);
    assert(!['unknown', 'n/a', 'na', 'tbd'].includes(value.value.toLowerCase()), `${label}.value must use null for unknown`);
    assert(/^-?[0-9]+(?:\.[0-9]+)?$/.test(value.value), `${label}.value must be a decimal string`);
  }
  assert(typeof value.unit === 'string' && value.unit.length > 0, `${label}.unit is required`);
  assert(['wet', 'dry', 'as_received', 'standardized', 'per_tonne'].includes(value.basis), `${label}.basis is unsupported`);
}

function assertMoney(value, label) {
  if (value === null || value === undefined) return;
  assert(value && typeof value === 'object', `${label} must be an object or null`);
  assert(Number.isInteger(value.amount_minor) && value.amount_minor >= 0, `${label}.amount_minor must be a non-negative integer`);
  assert(typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency), `${label}.currency must be an ISO-like code`);
  assert(typeof value.basis === 'string' && value.basis.length > 0, `${label}.basis is required`);
}

function assertRef(value, set, label) {
  assert(uuidPattern.test(value), `${label} must be a UUID`);
  assert(set.has(value), `${label} points to an unknown id ${value}`);
}

function checkProcessData(data) {
  for (const [index, profile] of data.processProfiles.entries()) {
    assert(typeof profile.slug === 'string' && profile.slug.length > 0, `process_profiles[${index}].slug is required`);
    assertRef(profile.organization_id, data.organizationIds, `process_profiles[${index}].organization_id`);
    assert(Array.isArray(profile.steps) && profile.steps.length >= 2, `process_profiles[${index}].steps needs at least two steps`);
    assert(Array.isArray(profile.possible_outputs) && profile.possible_outputs.length >= 1, `process_profiles[${index}].possible_outputs is required`);
  }
  for (const [index, scenario] of data.processScenarios.entries()) {
    assertRef(scenario.process_profile_id, data.processProfileIds, `process_scenarios[${index}].process_profile_id`);
    assert(typeof scenario.submitted_text === 'string' && scenario.submitted_text.length >= 20, `process_scenarios[${index}].submitted_text is too short`);
    assert(Array.isArray(scenario.expected_missing_fields), `process_scenarios[${index}].expected_missing_fields must be an array`);
    assert(['ready_for_review', 'needs_input', 'internal_use', 'rejected'].includes(scenario.expected_discovery_status), `process_scenarios[${index}] has invalid discovery status`);
  }
  const candidateProfiles = data.processProfiles.filter((profile) => profile.possible_outputs.some((output) => output.tradability_status === 'candidate' || output.tradability_status === 'opportunity' || output.tradability_status === 'hypothesis'));
  assert(candidateProfiles.length >= 3, 'process fixture needs at least three candidate/opportunity profiles');
}

function checkKnowledgeData(data) {
  for (const [index, source] of data.knowledgeSources.entries()) {
    assert(typeof source.source_uri === 'string' && source.source_uri.length > 0, `knowledge_sources[${index}].source_uri is required`);
    assert(['public', 'project', 'tenant:northstar-bioenergy', 'tenant:terrabuild-materials'].includes(source.access_scope), `knowledge_sources[${index}] has invalid access scope`);
  }
  for (const [index, document] of data.knowledgeDocuments.entries()) {
    assertRef(document.source_id, data.knowledgeSourceIds, `knowledge_documents[${index}].source_id`);
    assert(typeof document.text === 'string' && document.text.length > 40, `knowledge_documents[${index}].text is too short`);
    assert(document.checksum_sha256 === hashText(document.text), `knowledge_documents[${index}] checksum does not match text`);
    assert(isDate(document.effective_from) && (document.effective_to === null || isDate(document.effective_to)), `knowledge_documents[${index}] effective dates are invalid`);
    assert(['approved', 'pending', 'rejected'].includes(document.review_state), `knowledge_documents[${index}] review_state is invalid`);
  }
  for (const [index, chunk] of data.knowledgeChunks.entries()) {
    assertRef(chunk.document_id, data.knowledgeDocumentIds, `knowledge_chunks[${index}].document_id`);
    assertRef(chunk.source_id, data.knowledgeSourceIds, `knowledge_chunks[${index}].source_id`);
    assert(typeof chunk.ordinal === 'number' && chunk.ordinal >= 1, `knowledge_chunks[${index}].ordinal is invalid`);
    assert(chunk.locator && Number.isInteger(chunk.locator.page), `knowledge_chunks[${index}].locator.page is required`);
    assert(typeof chunk.text === 'string' && chunk.text.length > 10, `knowledge_chunks[${index}].text is too short`);
  }
  for (const source of data.knowledgeSources) {
    if (['official_primary', 'technical_primary'].includes(source.source_class)) assert(source.source_uri.startsWith('https://'), `${source.id} external source must use HTTPS`);
  }
}

function checkPolicyData(data) {
  for (const [index, rule] of data.policyRules.entries()) {
    assertRef(rule.source_document_id, data.knowledgeDocumentIds, `policy_rules[${index}].source_document_id`);
    assert(isDate(rule.effective_from) && (rule.effective_to === null || isDate(rule.effective_to)), `policy_rules[${index}] effective dates invalid`);
    if (rule.effective_to !== null) assert(Date.parse(rule.effective_to) > Date.parse(rule.effective_from), `policy_rules[${index}] effective_to must be after effective_from`);
    assert(Array.isArray(rule.required_facts) && rule.required_facts.length >= 1, `policy_rules[${index}].required_facts is empty`);
  }
  for (const [index, scenario] of data.policyScenarios.entries()) {
    assertRef(scenario.policy_rule_id, data.policyRuleIds, `policy_scenarios[${index}].policy_rule_id`);
    assert(['in_scope', 'out_of_scope', 'undetermined', 'source_conflict', 'source_stale', 'not_evaluated', 'screening_only', 'future_effective', 'review_required', 'not_a_credit'].includes(scenario.expected_result), `policy_scenarios[${index}] expected result invalid`);
  }
}

function checkCommercialData(data) {
  for (const [index, observation] of data.priceObservations.entries()) {
    assert(Number.isInteger(observation.amount_minor_per_tonne) && observation.amount_minor_per_tonne >= 0, `price_observations[${index}].amount_minor_per_tonne must be an integer`);
    assert(/^[A-Z]{3}$/.test(observation.currency), `price_observations[${index}].currency invalid`);
    assert(['listing', 'transport', 'quote'].includes(observation.observation_type), `price_observations[${index}].observation_type invalid`);
    assert(['current', 'stale'].includes(observation.freshness), `price_observations[${index}].freshness invalid`);
    assert(observation.is_guaranteed_quote === false, `price_observations[${index}] cannot be represented as a guaranteed quote`);
  }
  const snapshot = data.marketplaceSnapshot;
  assertCommon(snapshot, 'marketplace_snapshot');
  assert(Array.isArray(snapshot.listings) && snapshot.listings.length === 6, 'marketplace_snapshot.listings must contain six listings');
  for (const [index, listing] of snapshot.listings.entries()) {
    assertCommon(listing, `marketplace_snapshot.listings[${index}]`);
    assertRef(listing.organization_id, data.organizationIds, `listing[${index}].organization_id`);
    assertQuantity(listing.quantity_available, `listing[${index}].quantity_available`);
    assertMoney(listing.price && { amount_minor: listing.price.amount_minor_per_tonne, currency: listing.price.currency, basis: listing.price.basis }, `listing[${index}].price`);
    assert(['active', 'draft', 'expired', 'archived'].includes(listing.status), `listing[${index}].status invalid`);
    if (listing.status === 'active') assert(listing.public === true, `active listing ${listing.id} must be public`);
  }
  for (const requirementId of snapshot.requirements) assertRef(requirementId, data.buyerSpecificationIds, 'marketplace_snapshot.requirements[]');
  for (const [index, request] of snapshot.requests.entries()) {
    assertCommon(request, `marketplace_snapshot.requests[${index}]`);
    assertRef(request.buyer_requirement_id, data.buyerSpecificationIds, `request[${index}].buyer_requirement_id`);
    assertRef(request.listing_id, new Set(snapshot.listings.map((listing) => listing.id)), `request[${index}].listing_id`);
    assertRef(request.buyer_organization_id, data.organizationIds, `request[${index}].buyer_organization_id`);
    assertRef(request.supplier_organization_id, data.organizationIds, `request[${index}].supplier_organization_id`);
    assertQuantity(request.quantity, `request[${index}].quantity`);
  }
}

function checkAssistantData(data) {
  for (const [index, scenario] of data.conversationScenarios.entries()) {
    assertRef(scenario.organization_id, data.organizationIds, `conversation_scenarios[${index}].organization_id`);
    assert(Array.isArray(scenario.expected_tools) && Array.isArray(scenario.forbidden_tools), `conversation_scenarios[${index}] tool arrays are required`);
    assert(scenario.expected_action_state !== 'committed' || scenario.requires_confirmation === true, `conversation_scenarios[${index}] committed action must require confirmation`);
    assert(!scenario.forbidden_tools.includes('raw_sql') || !scenario.expected_tools.includes('raw_sql'), `conversation_scenarios[${index}] permits raw_sql`);
  }
  const categoryCounts = Object.fromEntries(Object.keys(evalCategoryCounts).map((key) => [key, 0]));
  for (const [index, testCase] of data.evalCases.entries()) {
    assert(typeof testCase.category === 'string' && categoryCounts[testCase.category] !== undefined, `assistant_eval_set[${index}] category invalid`);
    categoryCounts[testCase.category] += 1;
    assert(testCase.model_independent === true, `assistant_eval_set[${index}] must be replayable without a provider`);
    assert(Array.isArray(testCase.forbidden_tools) && testCase.forbidden_tools.includes('raw_sql'), `assistant_eval_set[${index}] lacks raw_sql prohibition`);
    assert(Array.isArray(testCase.must_not_claim) && testCase.must_not_claim.length >= 2, `assistant_eval_set[${index}] must include negative claims`);
    if (testCase.category === 'mutation_confirmation') assert(testCase.must_confirm === true && testCase.expected_action_state === 'needs_approval', `assistant_eval_set[${index}] mutation must pause for approval`);
    if (testCase.category === 'prompt_injection') assert(testCase.expected_action_state === 'rejected', `assistant_eval_set[${index}] injection must be rejected`);
  }
  assert(JSON.stringify(categoryCounts) === JSON.stringify(evalCategoryCounts), `eval category counts differ: ${JSON.stringify(categoryCounts)}`);
}

async function validateAll({ quiet = false } = {}) {
  const jsonNames = expectedFiles.filter((name) => name.endsWith('.json') && name !== 'manifest.json');
  const jsonlNames = expectedFiles.filter((name) => name.endsWith('.jsonl'));
  const loaded = {};
  for (const name of jsonNames) loaded[name.replace('.json', '')] = await loadJson(name);
  for (const name of jsonlNames) loaded[name.replace('.jsonl', '')] = await loadJsonl(name);
  const manifest = (await loadJson('manifest.json')).value;
  assertCommon(manifest, 'manifest');
  assert(manifest.dataset === 'carbonbridge-v2-demo' && manifest.dataset_version === '2.0.0', 'manifest dataset identity is invalid');
  assert(manifest.fixture_seed === '26' && manifest.fixture_clock === fixtureClock, 'manifest seed or clock is invalid');
  const get = (key) => loaded[key].value;
  const data = {
    organizations: get('organizations'), users: get('users'), processProfiles: get('process_profiles'), processScenarios: get('process_scenarios'),
    buyerSpecifications: get('buyer_specification_examples'), treatmentPathways: get('treatment_pathways'), knowledgeSources: get('knowledge_sources'),
    knowledgeDocuments: get('knowledge_documents'), knowledgeChunks: get('knowledge_chunks'), policyRules: get('policy_rules'), policyScenarios: get('policy_scenarios'),
    priceObservations: get('price_observations'), marketplaceSnapshot: get('marketplace_snapshot'), conversationScenarios: get('conversation_scenarios'), evalCases: get('assistant_eval_set'),
  };
  data.organizationIds = new Set(data.organizations.map((row) => row.id));
  data.processProfileIds = new Set(data.processProfiles.map((row) => row.id));
  data.buyerSpecificationIds = new Set(data.buyerSpecifications.map((row) => row.id));
  data.knowledgeSourceIds = new Set(data.knowledgeSources.map((row) => row.id));
  data.knowledgeDocumentIds = new Set(data.knowledgeDocuments.map((row) => row.id));
  data.policyRuleIds = new Set(data.policyRules.map((row) => row.id));
  for (const [key, count] of Object.entries(expectedCounts)) assertCollection(get(key), key, count);
  for (const [index, user] of data.users.entries()) assertRef(user.organization_id, data.organizationIds, `users[${index}].organization_id`);
  for (const [index, buyer] of data.buyerSpecifications.entries()) {
    assertRef(buyer.organization_id, data.organizationIds, `buyer_specification_examples[${index}].organization_id`);
    assertQuantity(buyer.quantity, `buyer_specification_examples[${index}].quantity`);
    assertMoney(buyer.price_limit, `buyer_specification_examples[${index}].price_limit`);
    assert(buyer.quality_constraints && buyer.quality_constraints.min_purity !== undefined, `buyer_specification_examples[${index}].quality_constraints is incomplete`);
  }
  checkProcessData(data);
  checkKnowledgeData(data);
  checkPolicyData(data);
  checkCommercialData(data);
  checkAssistantData(data);
  for (const name of expectedFiles.filter((file) => file !== 'manifest.json')) {
    const key = name.replace(/\.jsonl?$/, '');
    const checksum = hashText(loaded[key].text);
    assert(manifest.checksums?.[name] === checksum, `manifest checksum mismatch for ${name}`);
    assert(manifest.files?.[key]?.sha256 === checksum, `manifest file record mismatch for ${name}`);
    const expectedRecordCount = Array.isArray(loaded[key].value) ? loaded[key].value.length : 1;
    assert(manifest.files?.[key]?.records === expectedRecordCount, `manifest record count mismatch for ${name}`);
  }
  const summary = { files: expectedFiles.length, records: Object.values(expectedCounts).reduce((a, b) => a + b, 0), eval_cases: data.evalCases.length, fixture_clock: fixtureClock };
  if (!quiet) console.log(`CarbonBridge V2 fixtures valid: ${summary.records} records across ${summary.files} files; ${summary.eval_cases} eval cases.`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await validateAll(); } catch (error) { console.error(`Fixture validation failed: ${error.message}`); process.exitCode = 1; }
}

export { validateAll };
