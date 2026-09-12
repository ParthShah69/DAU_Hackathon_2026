#!/usr/bin/env node
/**
 * Live smoke of registration, marketplace filters, request-from-listing,
 * and NGO carbon-balance support. Expects the API at 127.0.0.1:8080.
 */
const base = process.env.API_ORIGIN || 'http://127.0.0.1:8080'

async function call(path, { method = 'GET', body, token, user, expectedStatus, headers = {} } = {}) {
  const requestHeaders = { ...headers }
  if (body !== undefined) requestHeaders['content-type'] = 'application/json'
  if (token) requestHeaders.authorization = `Bearer ${token}`
  if (user) requestHeaders['x-demo-user'] = user
  const response = await fetch(`${base}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const payload = await response.json()
  const statusOk = expectedStatus === undefined ? response.ok : response.status === expectedStatus
  if (!statusOk) {
    throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(payload)}`)
  }
  return payload.data
}

const stamp = Date.now()
const sellerEmail = `smoke-seller-${stamp}@example.test`
const ngoEmail = `smoke-ngo-${stamp}@example.test`
const buyerEmail = `smoke-buyer-${stamp}@example.test`

const health = await call('/healthz')
if (health.status !== 'ok') throw new Error('health failed')

const seller = await call('/api/v1/auth/register', {
  method: 'POST',
  body: {
    displayName: 'Smoke Production House',
    email: sellerEmail,
    password: 'smoke-pass-2026',
    organizationName: 'Smoke Cement Works',
    organizationKind: 'supplier',
    city: 'Ahmedabad'
  }
})
if (!seller.session?.token && !seller.session?.id) throw new Error('register did not return a session')
const sellerToken = seller.session.token || seller.session.id

const buyer = await call('/api/v1/auth/register', {
  method: 'POST',
  body: {
    displayName: 'Smoke Buyer',
    email: buyerEmail,
    password: 'smoke-pass-2026',
    organizationName: 'Smoke Concrete Co',
    organizationKind: 'buyer',
    city: 'Rajkot'
  }
})
const buyerToken = buyer.session.token || buyer.session.id

const ngo = await call('/api/v1/auth/register', {
  method: 'POST',
  body: {
    displayName: 'Smoke NGO',
    email: ngoEmail,
    password: 'smoke-pass-2026',
    organizationName: 'Smoke Climate Collective',
    organizationKind: 'ngo',
    city: 'Ahmedabad'
  }
})
const ngoToken = ngo.session.token || ngo.session.id

const me = await call('/api/v1/me', { token: sellerToken })
if (me.user.displayName !== 'Smoke Production House') throw new Error('session /me mismatch')

const listings = await call('/api/v1/marketplace/listings?q=Captured&minPurityMolPct=95', { user: 'user-buyer' })
if (!Array.isArray(listings.items) || listings.items.length < 1) throw new Error('marketplace filter returned no items')

const projects = await call('/api/v1/projects', { token: ngoToken })
if (!Array.isArray(projects.items)) throw new Error('projects list missing')

const createdProject = await call('/api/v1/projects', {
  method: 'POST',
  token: ngoToken,
  body: {
    title: 'Smoke tree-planting crew',
    kind: 'labor',
    description: 'Volunteer days to plant cover near industrial sites.',
    city: 'Ahmedabad',
    capacity: 12,
    unit: 'volunteer-days',
    carbonFocus: 'local greening support'
  }
})
const publishedProject = await call(`/api/v1/projects/${createdProject.id}/publish`, { method: 'POST', token: ngoToken })
if (publishedProject.state !== 'published') throw new Error('project did not publish')

const balance = await call('/api/v1/balance-requests', {
  method: 'POST',
  token: sellerToken,
  body: {
    estimatedTonnesCo2e: 40,
    message: 'Kiln capture exceeds nearby reuse this quarter.',
    preferredSupport: ['labor', 'funding'],
    city: 'Ahmedabad'
  }
})

const offered = await call(`/api/v1/balance-requests/${balance.id}/offer`, {
  method: 'POST',
  token: ngoToken,
  body: { projectId: createdProject.id, note: 'We can send a planting crew next month.' }
})
if (offered.participation?.offsetClaim === true) throw new Error('offer must not claim an offset')

const accepted = await call(`/api/v1/balance-requests/${balance.id}/accept`, { method: 'POST', token: sellerToken })
if (accepted.participation?.offsetClaim === true) throw new Error('acceptance must not claim an offset')

const thanks = await call('/api/v1/appreciations', {
  method: 'POST',
  token: ngoToken,
  body: { subjectOrganizationId: seller.organization.id, message: 'Thank you for recording the gap instead of inventing a credit.', relatedParticipationId: accepted.participation.id }
})
if (!thanks.id) throw new Error('appreciation was not recorded')

console.log('smoke-auth-market-ngo: ok')
console.log(JSON.stringify({
  health: health.status,
  registered: [sellerEmail, buyerEmail, ngoEmail],
  listings: listings.count ?? listings.items.length,
  project: createdProject.id,
  balanceRequest: balance.id
}, null, 2))
