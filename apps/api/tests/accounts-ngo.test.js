const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Store } = require('../src/infra/store');
const { createApp } = require('../src/app');

let server;
let baseUrl;
let store;

test.before(async () => {
  store = new Store();
  server = http.createServer(createApp({ store }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, { method = 'GET', body, user, organization, token, expectedStatus, headers: extraHeaders = {} } = {}) {
  const headers = {};
  if (user) headers['x-demo-user'] = user;
  if (organization) headers['x-demo-organization'] = organization;
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  Object.assign(headers, extraHeaders);
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, JSON.stringify(payload));
  else assert.ok(response.ok, JSON.stringify(payload));
  return { data: payload.data, status: response.status, headers: response.headers };
}

test('register supplier, login, and read me via Bearer token', async () => {
  const registered = await request('/api/v1/auth/register', {
    method: 'POST',
    body: {
      displayName: 'New Kiln Operator',
      email: 'kiln@example.com',
      password: 'secure-pass-2026',
      organizationName: 'Kiln House',
      organizationKind: 'supplier',
      city: 'Ahmedabad'
    },
    expectedStatus: 201
  });
  assert.equal(registered.data.organization.kind, 'supplier');
  assert.ok(registered.data.membership.roles.includes('supplier_editor'));
  assert.ok(registered.data.session.token);
  assert.match(registered.headers.get('set-cookie') || '', /carbonbridge_session=/);

  const duplicate = await request('/api/v1/auth/register', {
    method: 'POST',
    body: {
      displayName: 'Copy',
      email: 'KILN@example.com',
      password: 'secure-pass-2026',
      organizationName: 'Copy House',
      organizationKind: 'buyer'
    },
    expectedStatus: 409
  });
  assert.equal(duplicate.data.error.code, 'CONFLICT');

  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'kiln@example.com', password: 'secure-pass-2026' },
    expectedStatus: 200
  });
  const me = await request('/api/v1/me', { token: login.data.session.token });
  assert.equal(me.data.user.email, 'kiln@example.com');
  assert.equal(me.data.organizationKind, 'supplier');
  assert.equal(me.data.session.authenticated, true);
  assert.equal(me.data.session.method, 'session');
});

test('public buyer demand lets a seller offer privately and either party can pause the thread', async () => {
  const demands = await request('/api/v1/marketplace/demands', { user: 'user-seller' });
  const demand = demands.data.items.find((item) => item.id === 'requirement-demo');
  assert.equal(demand.buyer.name, 'GreenBuild Concrete');
  assert.equal(demand.buyer.details.contactEmail, undefined);

  const organization = await request('/api/v1/marketplace/organizations/org-greenbuild', { user: 'user-seller' });
  assert.equal(organization.data.details.deliveryLocation, 'Rajkot curing facility');
  assert.equal(organization.data.details.contactPhone, undefined);

  const offer = await request('/api/v1/marketplace/demands/requirement-demo/offers', {
    method: 'POST', user: 'user-seller',
    body: { quantity: '75', purity: '98%', priceBasis: '₹2,100/t delivered', delivery: 'Road tanker', message: 'October capacity is available.' }, expectedStatus: 201
  });
  const buyerThreads = await request('/api/v1/negotiations', { user: 'user-buyer' });
  assert.ok(buyerThreads.data.items.some((item) => item.id === offer.data.id));
  const ngoThreads = await request('/api/v1/negotiations', { user: 'user-reviewer' });
  assert.equal(ngoThreads.data.items.some((item) => item.id === offer.data.id), false);

  const paused = await request(`/api/v1/negotiations/${offer.data.id}/pause`, { method: 'POST', user: 'user-buyer' });
  assert.equal(paused.data.status, 'paused');
  const message = await request(`/api/v1/negotiations/${offer.data.id}/messages`, { method: 'POST', user: 'user-seller', body: { message: 'This should not be sent.' }, expectedStatus: 409 });
  assert.equal(message.data.error.code, 'CONFLICT');
});

test('facility assessment separates operational emissions from buyer demand and returns ranked actions', async () => {
  const assessment = await request('/api/v1/emissions-assessment', { user: 'user-seller' });
  assert.equal(assessment.data.role, 'supplier');
  assert.equal(assessment.data.emissions.scope1ProcessTonnes, 12400);
  assert.equal(assessment.data.emissions.scope2ElectricityTonnes, 2240);
  assert.ok(assessment.data.emissions.intensityTonnesPerProduct > 0);
  assert.ok(assessment.data.marketContext.excessCapturedTonnes > 0);
  assert.ok(assessment.data.actions.some((action) => /electricity/i.test(action.title)));
  assert.ok(assessment.data.actions.some((action) => /exceeds current marketplace demand/i.test(action.rationale)));

  const buyer = await request('/api/v1/emissions-assessment', { user: 'user-buyer' });
  assert.equal(buyer.data.role, 'buyer');
  assert.match(buyer.data.actions[0].rationale, /electricity/i);
});

test('document metadata is private to the applicant and platform admins can review it with comments', async () => {
  const registered = await request('/api/v1/auth/register', {
    method: 'POST',
    body: {
      displayName: 'Documented Producer', email: 'documents@kiln.example', password: 'secure-pass-2026',
      organizationName: 'Document Kiln', organizationKind: 'supplier', city: 'Surat'
    },
    expectedStatus: 201
  });
  const token = registered.data.session.token;
  const ownBefore = await request('/api/v1/organization-documents', { token });
  assert.deepEqual(ownBefore.data.items, []);
  const document = await request('/api/v1/organization-documents', {
    method: 'POST', token,
    body: { documentType: 'business_registration', fileName: 'document-kiln-registration.pdf', mimeType: 'application/pdf', sizeBytes: 342000, description: 'Certificate of incorporation.' },
    expectedStatus: 201
  });
  assert.equal(document.data.storage.kind, 'metadata_only_demo');
  assert.equal(document.data.status, 'pending_review');

  const otherOrgDocuments = await request('/api/v1/organization-documents', { user: 'user-buyer' });
  assert.equal(otherOrgDocuments.data.items.some((item) => item.id === document.data.id), false);
  const ngoQueue = await request('/api/v1/admin/verification-queue', { user: 'user-reviewer', expectedStatus: 403 });
  assert.equal(ngoQueue.data.error.code, 'FORBIDDEN');

  const reviewerMembership = store.findOne('memberships', (item) => item.userId === 'user-reviewer');
  reviewerMembership.roles = [...reviewerMembership.roles, 'platform_admin'];
  const profile = await request('/api/v1/organization-profile', { token });
  await request('/api/v1/organization-profile', {
    method: 'PATCH', token,
    body: Object.fromEntries(profile.data.requiredFields.map((field) => [field, field === 'contactEmail' ? 'documents@kiln.example' : 'completed']))
  });
  const submitted = await request('/api/v1/organization-profile/submit', { method: 'POST', token, body: {} });
  const queue = await request('/api/v1/admin/verification-queue', { user: 'user-reviewer' });
  const item = queue.data.items.find((entry) => entry.id === submitted.data.submission.id);
  assert.ok(item);
  assert.equal(item.documents[0].id, document.data.id);
  const review = await request(`/api/v1/admin/verification-submissions/${item.id}/documents/${document.data.id}/review`, {
    method: 'POST', user: 'user-reviewer', body: { decision: 'rejected', comment: 'Please upload a current certificate.' }
  });
  assert.equal(review.data.status, 'rejected');
  assert.equal(review.data.reviewHistory[0].comment, 'Please upload a current certificate.');
  const applicationReview = await request(`/api/v1/admin/verification-submissions/${item.id}`, {
    method: 'POST', user: 'user-reviewer', body: { status: 'needs_changes', note: 'Please replace the expired registration certificate.' }
  });
  assert.equal(applicationReview.data.status, 'needs_changes');
  assert.equal(applicationReview.data.history.at(-1).note, 'Please replace the expired registration certificate.');
  const detail = await request(`/api/v1/admin/verification-submissions/${item.id}`, { user: 'user-reviewer' });
  assert.equal(detail.data.documents[0].reviewHistory.length, 1);
});

test('role-based onboarding gates publication and supports a multi-capability contributor', async () => {
  const registered = await request('/api/v1/auth/register', {
    method: 'POST',
    body: { displayName: 'Mira Patel', email: 'mira@impact.example', password: 'secure-pass-2026', organizationName: 'Impact Foundry', organizationKind: 'contributor', capabilities: ['supplier'], city: 'Pune' },
    expectedStatus: 201
  });
  assert.deepEqual(registered.data.organization.capabilities.sort(), ['contributor', 'supplier']);
  assert.ok(registered.data.membership.roles.includes('contributor_editor'));
  assert.ok(registered.data.membership.roles.includes('supplier_editor'));
  const token = registered.data.session.token;
  const profile = await request('/api/v1/organization-profile', { token });
  assert.equal(profile.data.ready, false);
  const saved = await request('/api/v1/organization-profile', { method: 'PATCH', token, body: {
    organizationName: 'Impact Foundry', contactEmail: 'mira@impact.example', legalEntityType: 'Private limited', industry: 'Construction', facilityLocation: 'Pune', annualProductionTonnes: '6000', annualProcessCo2Tonnes: '1200', annualFuelCo2Tonnes: '200', annualElectricityKwh: '500000', annualCaptureEstimate: '400', availableQuantity: '30', supplyFrequency: 'monthly', sourceProcess: 'cement capture', purity: '99.5', form: 'liquid', annualEmissions: '1400', emissionsGap: '380', sustainabilityBudget: '900000', contributionType: 'mixed'
  } });
  assert.equal(saved.data.ready, true);
  const submitted = await request('/api/v1/organization-profile/submit', { method: 'POST', token, body: {} });
  assert.equal(submitted.data.verificationStatus, 'submitted_for_review');
  const queue = await request('/api/v1/verification-queue', { user: 'user-reviewer' });
  const review = await request(`/api/v1/verification-queue/${queue.data.items.find((item) => item.organizationId === registered.data.organization.id).id}/review`, { method: 'POST', user: 'user-reviewer', body: { status: 'verified', note: 'Demo documents reviewed.' } });
  assert.equal(review.data.status, 'verified');
});

test('marketplace filter by q and minPurity, and buyer request-from-listing', async () => {
  const filtered = await request('/api/v1/marketplace/listings?q=Ahmedabad&minPurityMolPct=97', { user: 'user-buyer' });
  assert.ok(filtered.data.items.some((item) => item.id === 'stream-a'));
  assert.ok(filtered.data.items.every((item) => item.id === 'stream-a' || Number(item.quality?.purityMolPct) >= 97));
  assert.equal(filtered.data.items.some((item) => item.id === 'stream-d' || item.id === 'stream-f'), false);

  const queryName = await request('/api/v1/listings?q=Captured%20CO2%20A', { user: 'user-buyer' });
  assert.ok(queryName.data.items.some((item) => item.id === 'stream-a'));

  const created = await request('/api/v1/listings/stream-a/request', {
    method: 'POST',
    user: 'user-buyer',
    body: { requirementId: 'requirement-demo' },
    expectedStatus: 201
  });
  assert.equal(created.data.streamId, 'stream-a');
  assert.equal(created.data.status, 'pending_supplier');
  assert.equal(created.data.requirementId, 'requirement-demo');

  const blocked = await request('/api/v1/listings/stream-unknown/request', {
    method: 'POST',
    user: 'user-buyer',
    body: { requirementId: 'requirement-demo' },
    expectedStatus: 422
  });
  assert.equal(blocked.data.error.code, 'MATCH_NOT_COMPATIBLE');
  assert.ok(blocked.data.error.details.checks.length > 0);
  assert.ok(['needs_evidence', 'incompatible'].includes(blocked.data.error.details.status));
});

test('NGO projects, balance request offer/accept, and appreciation without offset claims', async () => {
  const asReviewer = await request('/api/v1/projects', { user: 'user-reviewer' });
  assert.ok(asReviewer.data.items.some((item) => item.id === 'project-labor-trees' && item.kind === 'labor'));
  assert.ok(asReviewer.data.items.some((item) => item.id === 'project-funding-greening' && item.kind === 'funding'));
  assert.ok(asReviewer.data.items.every((item) => item.state === 'published'));

  const dashboard = await request('/api/v1/dashboard', { user: 'user-reviewer' });
  assert.ok(dashboard.data.counts.projects >= 3);
  assert.ok(dashboard.data.counts.openBalanceRequests >= 1);

  const balance = await request('/api/v1/balance-requests', {
    method: 'POST',
    user: 'user-seller',
    body: {
      estimatedTonnesCo2e: 80,
      message: 'Excess process CO2 looking for labor support, not a credit.',
      preferredSupport: ['labor', 'funding', 'greening'],
      city: 'Ahmedabad'
    },
    expectedStatus: 201
  });
  assert.equal(balance.data.offsetClaim, false);
  assert.match(balance.data.disclaimer, /does not retire, net, or certify emissions/i);

  const offered = await request(`/api/v1/balance-requests/${balance.data.id}/offer`, {
    method: 'POST',
    user: 'user-reviewer',
    body: { projectId: 'project-labor-trees', note: 'Weekend volunteer days near the plant' }
  });
  assert.equal(offered.data.balanceRequest.status, 'offered');
  assert.equal(offered.data.participation.status, 'offered');
  assert.equal(offered.data.participation.offsetClaim, false);

  const accepted = await request(`/api/v1/balance-requests/${balance.data.id}/accept`, {
    method: 'POST',
    user: 'user-seller'
  });
  assert.equal(accepted.data.balanceRequest.status, 'supported');
  assert.equal(accepted.data.participation.status, 'active');
  assert.equal(accepted.data.participation.offsetClaim, false);

  const appreciation = await request('/api/v1/appreciations', {
    method: 'POST',
    user: 'user-buyer',
    body: {
      subjectOrganizationId: 'org-carbonstone',
      message: 'Thanks for joining the tree-planting support activity.',
      relatedParticipationId: accepted.data.participation.id
    },
    expectedStatus: 201
  });
  assert.equal(appreciation.data.offsetClaim, false);
  assert.match(appreciation.data.disclaimer, /Support activity only/);

  const listed = await request('/api/v1/appreciations?organizationId=org-carbonstone', { user: 'user-buyer' });
  assert.ok(listed.data.items.some((item) => item.id === appreciation.data.id));
});

test('registered production house can create a listing with city instead of siteId', async () => {
  const registered = await request('/api/v1/auth/register', {
    method: 'POST',
    body: {
      displayName: 'City Lister',
      email: 'city-lister@example.com',
      password: 'secure-pass-2026',
      organizationName: 'City Cement',
      organizationKind: 'supplier',
      city: 'Surat'
    },
    expectedStatus: 201
  });
  const created = await request('/api/v1/listings', {
    method: 'POST',
    token: registered.data.session.token,
    body: {
      name: 'City capture stream',
      city: 'Surat',
      sourceIndustry: 'cement',
      physicalForm: 'gas',
      quality: { purityMolPct: 97, basis: 'dry', evidenceStatus: 'self_reported', analytes: [] },
      supplyPeriods: [{ start: '2026-11-01', end: '2026-11-30', totalTonnes: 40, minimumOrderTonnes: 5, listedPricePaisePerTonne: 180000, currency: 'INR' }]
    },
    expectedStatus: 201
  });
  assert.equal(created.data.state, 'draft');
  const me = await request('/api/v1/me', { token: registered.data.session.token });
  assert.ok(me.data.sites.some((site) => site.city === 'Surat'));
});

test('reviewer demo-header still works for GET projects', async () => {
  const actors = await request('/api/v1/auth/demo-actors');
  assert.ok(actors.data.items.some((item) => item.email === 'reviewer@demo.carbonbridge.local' && item.kind === 'ngo'));
  const projects = await request('/api/v1/projects?kind=labor', { user: 'user-reviewer' });
  assert.ok(projects.data.items.length >= 1);
  assert.ok(projects.data.items.every((item) => item.kind === 'labor'));
  const me = await request('/api/v1/me', { user: 'user-reviewer' });
  assert.equal(me.data.session.method, 'demo-header');
  assert.equal(me.data.organizationKind, 'ngo');
});
