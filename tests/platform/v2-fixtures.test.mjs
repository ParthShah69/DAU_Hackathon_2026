import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uuidv5 } from '../../scripts/generate-v2-fixtures.mjs';
import { validateAll } from '../../scripts/validate-v2-fixtures.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureDir = path.join(repoRoot, 'data', 'fixtures', 'v2');

async function json(name) {
  return JSON.parse(await readFile(path.join(fixtureDir, name), 'utf8'));
}

async function jsonl(name) {
  const text = await readFile(path.join(fixtureDir, name), 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test('the committed fixture package passes cross-file validation', async () => {
  const summary = await validateAll({ quiet: true });
  assert.equal(summary.files, 16);
  assert.equal(summary.records, 222);
  assert.equal(summary.eval_cases, 60);
});

test('fixture IDs are stable UUIDv5 values', async () => {
  const organizations = await json('organizations.json');
  const northstar = organizations.find((row) => row.slug === 'northstar-bioenergy');
  assert.ok(northstar);
  assert.equal(northstar.id, uuidv5('carbonbridge:organization:northstar-bioenergy'));
  const profiles = await json('process_profiles.json');
  const mineral = profiles.find((row) => row.slug === 'mineral-carbonation');
  assert.equal(mineral.id, uuidv5('carbonbridge:process_profile:mineral-carbonation'));
});

test('process discovery keeps uncertainty and evidence boundaries visible', async () => {
  const profiles = await json('process_profiles.json');
  const food = profiles.find((row) => row.slug === 'food-fermentation');
  assert.ok(food.possible_outputs.some((output) => output.material === 'captured CO2' && output.tradability_status === 'hypothesis'));
  const scenarios = await json('process_scenarios.json');
  const unsafe = scenarios.find((row) => row.contains_prompt_injection === true);
  assert.equal(unsafe.expected_discovery_status, 'rejected');
  assert.ok(unsafe.expected_missing_fields.includes('independent quality evidence'));
  const listings = (await json('marketplace_snapshot.json')).listings;
  const unverified = listings.find((listing) => listing.status === 'draft');
  assert.equal(unverified.public, false);
  assert.equal(unverified.quality.evidence_state, 'missing');
});

test('market prices are observations, never guaranteed quotes', async () => {
  const observations = await json('price_observations.json');
  assert.equal(observations.filter((row) => row.freshness === 'stale').length, 2);
  assert.ok(observations.every((row) => row.is_guaranteed_quote === false));
  assert.ok(observations.every((row) => Number.isInteger(row.amount_minor_per_tonne)));
});

test('evaluation categories and safety constraints are complete', async () => {
  const cases = await jsonl('assistant_eval_set.jsonl');
  const counts = cases.reduce((accumulator, row) => {
    accumulator[row.category] = (accumulator[row.category] ?? 0) + 1;
    return accumulator;
  }, {});
  assert.deepEqual(counts, {
    intent_entity: 10, marketplace_read: 10, process_quality_grounding: 8, environment_policy: 10,
    mutation_confirmation: 8, authorization_privacy: 6, prompt_injection: 5, reliability: 3,
  });
  assert.ok(cases.every((row) => row.forbidden_tools.includes('raw_sql')));
  assert.ok(cases.filter((row) => row.category === 'mutation_confirmation').every((row) => row.must_confirm && row.expected_action_state === 'needs_approval'));
  assert.ok(cases.filter((row) => row.category === 'prompt_injection').every((row) => row.expected_action_state === 'rejected'));
});

test('source access scopes are explicit', async () => {
  const sources = await json('knowledge_sources.json');
  assert.ok(sources.some((row) => row.access_scope === 'public'));
  assert.ok(sources.some((row) => row.access_scope === 'tenant:northstar-bioenergy'));
  const documents = await jsonl('knowledge_documents.jsonl');
  assert.ok(documents.every((row) => row.access_scope && row.review_state === 'approved'));
});

test('public JSON schemas and capability example are parseable', async () => {
  const schemaDir = path.join(repoRoot, 'contracts', 'v2');
  const schemaFiles = (await readdir(schemaDir)).filter((name) => name.endsWith('.schema.json'));
  assert.ok(schemaFiles.length >= 5);
  for (const name of schemaFiles) {
    const schema = JSON.parse(await readFile(path.join(schemaDir, name), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.ok(schema.$id.startsWith('https://carbonbridge.example/contracts/v2/'));
  }
  const capabilityExample = JSON.parse(await readFile(path.join(schemaDir, 'capability-manifest.json.example'), 'utf8'));
  assert.equal(capabilityExample.schema_version, '2.0');
  assert.ok(capabilityExample.capabilities.every((capability) => capability.manual_fallback === true));
});
