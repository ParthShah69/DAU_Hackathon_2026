const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Store } = require('../src/infra/store');
const { createApp } = require('../src/app');

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(createApp({ store: new Store() }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, { method = 'GET', body, user = 'user-buyer', organization, expectedStatus } = {}) {
  const headers = { 'x-demo-user': user };
  if (organization) headers['x-demo-organization'] = organization;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, JSON.stringify(payload));
  else assert.ok(response.ok, JSON.stringify(payload));
  return payload.data;
}

test('health and seed endpoints expose a clearly fictional demo', async () => {
  const health = await request('/healthz', { user: 'user-buyer' });
  assert.equal(health.status, 'ok');
  assert.equal(health.seed.kind, 'synthetic_demo');
  const seeded = await request('/api/v1/demo/seed', { method: 'POST', user: 'user-buyer' });
  assert.equal(seeded.status, 'seeded');
  assert.equal(seeded.source.kind, 'synthetic_demo');
});

test('marketplace lists and deterministic match groups are available', async () => {
  const listings = await request('/api/v1/marketplace/listings');
  assert.equal(listings.count, 4);
  assert.ok(listings.items.every((item) => item.synthetic === true));

  const match = await request('/api/v1/matches/run', { method: 'POST', body: { requirementId: 'requirement-demo' } });
  assert.equal(match.groups.compatible.length, 2);
  assert.equal(match.groups.needsEvidence.length, 1);
  assert.equal(match.groups.incompatible.length, 1);
  assert.equal(match.groups.compatible[0].streamId, 'stream-a');
  assert.equal(match.groups.compatible[0].economics.deliveredPaisePerTonne, 212000);
  assert.equal(match.groups.compatible[1].economics.deliveredPaisePerTonne, 224000);
  assert.ok(match.results.every((item) => item.checks.length > 0));
  const stored = await request(`/api/v1/matches/${match.run.id}`);
  assert.equal(stored.results.length, 4);
});

test('process discovery returns candidate opportunities without inventing inventory', async () => {
  const discovered = await request('/api/v1/processes/discover', {
    method: 'POST',
    user: 'user-seller',
    body: {
      description: 'Our cement kiln uses amine capture on flue gas, and we operate the process every day with a storage area for outputs.',
      structured: { inputs: ['limestone', 'fuel'], steps: ['kiln', 'capture'], outputs: ['captured carbon dioxide'] }
    }
  });
  assert.equal(discovered.analysis.canPrepareListing, false);
  assert.ok(discovered.candidates.some((item) => item.material === 'captured_co2'));
  assert.ok(discovered.candidates.every((item) => item.canPublish === false));
  assert.ok(discovered.candidates.every((item) => item.quantity === null && item.price === null));
  const detail = await request(`/api/v1/processes/${discovered.process.id}`, { user: 'user-seller' });
  assert.equal(detail.process.id, discovered.process.id);
  const forbidden = await request(`/api/v1/processes/${discovered.process.id}`, { user: 'user-buyer', expectedStatus: 404 });
  assert.equal(forbidden.error.code, 'NOT_FOUND');

  const conversation = await request('/api/v1/conversations', { method: 'POST', user: 'user-seller', body: { title: 'Seller listing draft' } });
  const processInChat = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', user: 'user-seller', body: { message: 'Our cement process uses carbon capture on flue gas and stores captured carbon dioxide.' } });
  assert.equal(processInChat.intent.name, 'discover_process_outputs');
  const listingPreview = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', user: 'user-seller', body: { message: 'Prepare a listing draft for this process output' } });
  assert.equal(listingPreview.state, 'waiting_for_approval');
  const listingAction = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', user: 'user-seller', body: { message: 'confirm' } });
  const draft = listingAction.response.receipt;
  assert.equal(draft.state, 'draft');
  const drafts = await request('/api/v1/listing-drafts', { user: 'user-seller' });
  assert.ok(drafts.items.some((item) => item.id === draft.id));
  const updatedDraft = await request(`/api/v1/listing-drafts/${draft.id}`, {
    method: 'PATCH',
    user: 'user-seller',
    body: { version: draft.version, quantityTonnes: 80, quality: { purityMolPct: 98, basis: 'dry', analytes: [] }, evidenceStatus: 'reviewed' }
  });
  assert.equal(updatedDraft.canPublish, true);
  assert.deepEqual(updatedDraft.publishBlockers, []);
});

test('assistant routes through deterministic tools and requires confirmation for mutations', async () => {
  const conversation = await request('/api/v1/conversations', { method: 'POST', body: { title: 'Buyer demo flow' } });
  const matches = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', body: { message: 'Find the best supply options for my requirement' } });
  assert.equal(matches.intent.name, 'find_matches');
  assert.equal(matches.response.cards[0].type, 'match_results');
  const compare = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', body: { message: 'Compare the options' } });
  assert.equal(compare.intent.name, 'compare_options');
  assert.equal(compare.response.cards[0].type, 'comparison');
  const prepare = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', body: { message: 'Prepare a request for the best option' } });
  assert.equal(prepare.intent.name, 'prepare_request');
  assert.equal(prepare.state, 'waiting_for_approval');
  const actionId = prepare.response.cards[0].actionId;
  const action = await request(`/api/v1/actions/${actionId}`);
  assert.equal(action.status, 'awaiting_approval');
  const confirmed = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', body: { message: 'confirm' } });
  assert.equal(confirmed.response.cards[0].type, 'action_receipt');
  assert.equal(confirmed.response.cards[0].status, 'succeeded');
  const requestId = confirmed.response.receipt.id;
  const requests = await request('/api/v1/requests');
  assert.ok(requests.items.some((item) => item.id === requestId && item.status === 'pending_supplier'));
});

test('seller acceptance creates one reservation after a second exact confirmation', async () => {
  const requestsAsSeller = await request('/api/v1/requests', { user: 'user-seller' });
  const pending = requestsAsSeller.items.find((item) => item.status === 'pending_supplier');
  assert.ok(pending);
  const conversation = await request('/api/v1/conversations', { method: 'POST', user: 'user-seller', body: { title: 'Seller request flow' } });
  const preview = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', user: 'user-seller', body: { message: `accept request ${pending.id}` } });
  assert.equal(preview.state, 'waiting_for_approval');
  assert.equal(preview.response.cards[0].operation, 'accept_supply_request');
  const completed = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', user: 'user-seller', body: { message: 'yes' } });
  assert.equal(completed.response.cards[0].status, 'succeeded');
  const requestDetail = await request(`/api/v1/requests/${pending.id}`, { user: 'user-seller' });
  assert.equal(requestDetail.status, 'accepted');
  assert.equal(requestDetail.reservation.status, 'active');
});

test('assistant requirement creation asks for missing fields and then previews a typed action', async () => {
  const conversation = await request('/api/v1/conversations', { method: 'POST', body: { title: 'Requirement extraction' } });
  const missing = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', body: { message: 'Create a buyer requirement' } });
  assert.equal(missing.response.needsInput, true);
  assert.ok(missing.response.missingFields.includes('quantity in tonnes'));
  const preview = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', body: { message: 'Create a requirement for 50 tonnes in November 2026 with minimum purity 95%' } });
  assert.equal(preview.state, 'waiting_for_approval');
  assert.equal(preview.response.cards[0].operation, 'create_requirement');
  const confirmed = await request(`/api/v1/conversations/${conversation.id}/messages`, { method: 'POST', body: { message: 'confirm' } });
  assert.equal(confirmed.response.cards[0].status, 'succeeded');
  assert.equal(confirmed.response.receipt.name, 'Assistant-created buyer requirement');
});

test('unknown routes and malformed requests return structured errors', async () => {
  const missing = await request('/api/v1/does-not-exist', { expectedStatus: 404 });
  assert.equal(missing.error.code, 'NOT_FOUND');
  const badMatch = await request('/api/v1/matches/run', { method: 'POST', body: { requirementId: 'missing' }, expectedStatus: 404 });
  assert.equal(badMatch.error.code, 'NOT_FOUND');
});

test('assistant stream emits typed progress and result events', async () => {
  const conversation = await request('/api/v1/conversations', { method: 'POST', body: { title: 'Streaming demo' } });
  const response = await fetch(`${baseUrl}/api/v1/conversations/${conversation.id}/messages/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-demo-user': 'user-buyer' },
    body: JSON.stringify({ message: 'Find supply options' })
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const body = await response.text();
  assert.match(body, /event: workflow\.started/);
  assert.match(body, /event: assistant\.result/);
  assert.match(body, /event: workflow\.completed/);
});
