import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll } from './validate-v2-fixtures.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'data', 'fixtures', 'v2');

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function fail(message) {
  console.error(`Demo seed refused: ${message}`);
  process.exitCode = 1;
}

const args = process.argv.slice(2);
const profile = readOption(args, '--profile', 'demo');
const seed = readOption(args, '--seed', '26');
const clock = readOption(args, '--clock', '2026-09-12T00:00:00Z');
const outputOption = readOption(args, '--output', null);
const apiUrl = readOption(args, '--api-url', null);
const apply = args.includes('--apply');

if (profile !== 'demo') {
  fail('only --profile demo is supported by this fixture adapter; real environments require an explicit database migration and review.');
} else {
  const manifest = JSON.parse(await readFile(path.join(fixtureDir, 'manifest.json'), 'utf8'));
  if (seed !== manifest.fixture_seed) fail(`seed ${seed} does not match the committed demo seed ${manifest.fixture_seed}.`);
  else if (clock !== manifest.fixture_clock) fail(`clock ${clock} does not match the committed demo clock ${manifest.fixture_clock}.`);
  else {
    const summary = await validateAll({ quiet: true });
    const plan = {
      schema_version: '2.0',
      profile,
      seed,
      clock,
      idempotency_key: `carbonbridge-demo:${seed}:${clock}`,
      mode: apply ? 'runtime_api_adapter' : 'dry_run_fixture_adapter',
      dependency_order: [
        'organizations', 'users', 'knowledge_sources', 'knowledge_documents', 'knowledge_chunks',
        'process_profiles', 'process_scenarios', 'buyer_specification_examples', 'treatment_pathways',
        'policy_rules', 'policy_scenarios', 'price_observations', 'marketplace_snapshot',
        'conversation_scenarios', 'assistant_eval_set',
      ],
      expected_counts: summary,
      guarantees: [
        'stable UUIDv5 identities make re-running the seed idempotent',
        'all values are synthetic_demo or source-backed metadata',
        'computed rankings, costs and analytics remain domain-service outputs',
        'unknown quantities and quality values remain null',
        'no network, provider credential or IoT device is required',
      ],
    };
    if (apply) {
      if (!apiUrl) {
        fail('--apply requires --api-url, for example http://127.0.0.1:8080. Refusing to guess a target.');
      } else {
        const endpoint = new URL('/api/v1/demo/seed', apiUrl).toString();
        let response;
        try {
          response = await fetch(endpoint, { method: 'POST', headers: { accept: 'application/json' } });
        } catch (error) {
          fail(`could not reach ${endpoint}: ${error.message}`);
          process.exit();
        }
        let body;
        try { body = await response.json(); } catch { fail(`${endpoint} did not return JSON`); process.exit(); }
        if (!response.ok || body?.data?.status !== 'seeded') {
          fail(`${endpoint} refused the demo seed (${response.status}): ${body?.data?.error?.message || body?.error?.message || 'unknown error'}`);
          process.exit();
        }
        plan.runtime = { endpoint, status: body.data.status, source: body.data.source, counts: body.data.counts };
        console.log(`Demo API seed applied at ${endpoint}.`);
      }
    }
    if (outputOption) {
      const outputPath = path.resolve(repoRoot, outputOption);
      await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
      console.log(`Demo seed plan written to ${path.relative(repoRoot, outputPath)}.`);
    } else {
      console.log(JSON.stringify(plan, null, 2));
    }
  }
}
