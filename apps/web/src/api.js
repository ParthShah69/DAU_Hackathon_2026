// The preview intentionally runs without a backend. To exercise the live
// prototype, set either the global before main.js loads or use ?api=/api/v1:
// window.__CARBONBRIDGE_CONFIG__ = {
//   apiBaseUrl: '/api/v1',
//   demoUser: 'user-seller',
//   demoOrganization: 'org-carbonstone',
// }
const runtimeConfig = globalThis.__CARBONBRIDGE_CONFIG__ || {}
const queryConfig = typeof globalThis.location === 'undefined' ? new URLSearchParams() : new URLSearchParams(globalThis.location.search)

export const SESSION_STORAGE_KEY = 'carbonbridge.session'
export const DEMO_USER_STORAGE_KEY = 'carbonbridge.demoUser'
export const DEMO_ORG_STORAGE_KEY = 'carbonbridge.demoOrganization'

export const apiBaseUrl = String(runtimeConfig.apiBaseUrl || queryConfig.get('api') || '').replace(/\/$/, '')
export const isDemoMode = runtimeConfig.mode === 'demo' || apiBaseUrl.length === 0

function readStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStorage(key, value) {
  try {
    if (value) globalThis.localStorage?.setItem(key, value)
    else globalThis.localStorage?.removeItem(key)
  } catch {
    /* private mode */
  }
}

export function readSessionRecord() {
  const raw = readStorage(SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    return { token: raw }
  }
  return { token: raw }
}

export function getSessionToken() {
  const record = readSessionRecord()
  return String(record?.token || record?.session?.token || '')
}

export function persistSession(payload) {
  if (!payload) {
    writeStorage(SESSION_STORAGE_KEY, '')
    return
  }
  if (typeof payload === 'string') {
    writeStorage(SESSION_STORAGE_KEY, payload)
    return
  }
  const token = payload.token || payload.session?.token || ''
  writeStorage(SESSION_STORAGE_KEY, JSON.stringify({ token, session: payload.session || null, user: payload.user || null }))
}

export function clearSession() {
  persistSession(null)
}

function queryDemoUser() {
  return String(queryConfig.get('user') || '')
}

function queryDemoOrganization() {
  return String(runtimeConfig.demoOrganization || queryConfig.get('organization') || '')
}

let selectedDemoUser = queryDemoUser() || readStorage(DEMO_USER_STORAGE_KEY)
let selectedDemoOrganization = queryDemoOrganization() || readStorage(DEMO_ORG_STORAGE_KEY)

export function getDemoUser() {
  return selectedDemoUser
}

export function getDemoOrganization() {
  return selectedDemoOrganization
}

export function persistDemoActor(userId, organizationId = '') {
  selectedDemoUser = String(userId || '')
  selectedDemoOrganization = String(organizationId || '')
  writeStorage(DEMO_USER_STORAGE_KEY, selectedDemoUser)
  writeStorage(DEMO_ORG_STORAGE_KEY, selectedDemoOrganization)
}

export function clearDemoActor() {
  selectedDemoUser = ''
  selectedDemoOrganization = ''
  writeStorage(DEMO_USER_STORAGE_KEY, '')
  writeStorage(DEMO_ORG_STORAGE_KEY, '')
}

export function hasChosenDemoActor() {
  return Boolean(queryDemoUser() || readStorage(DEMO_USER_STORAGE_KEY))
}

export function hasActiveSession() {
  return Boolean(getSessionToken())
}

/** Header default used by fetch; remains user-buyer only when no session and no chosen actor. */
export const demoUser = String(runtimeConfig.demoUser || queryConfig.get('user') || 'user-buyer')
export const demoOrganization = String(runtimeConfig.demoOrganization || queryConfig.get('organization') || '')

function headersForRequest(headers = {}) {
  const token = getSessionToken()
  const actor = getDemoUser() || (token ? '' : demoUser)
  const organization = getDemoOrganization() || (token ? '' : demoOrganization)
  return {
    Accept: 'application/json',
    ...(actor ? { 'x-demo-user': actor } : {}),
    ...(organization ? { 'x-demo-organization': organization } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
}

function unwrapEnvelope(payload) {
  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
}

export function asItems(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  return []
}

function queryString(params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export async function apiRequest(path, options = {}) {
  if (isDemoMode) return null
  const { body, headers, ...requestOptions } = options
  const response = await fetch(`${apiBaseUrl}/${String(path).replace(/^\//, '')}`, {
    ...requestOptions,
    credentials: 'include',
    headers: headersForRequest({ ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = { error: { message: text || 'Unexpected API response' } } }
  if (!response.ok) {
    const message = payload?.data?.error?.message || payload?.error?.message || `CarbonBridge API request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return unwrapEnvelope(payload)
}

async function optionalRequest(path, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (error.status === 403 || error.status === 404) return null
    throw error
  }
}

export async function health() {
  return apiRequest('/health')
}

export async function registerAccount(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: payload })
}

export async function loginAccount(payload) {
  return apiRequest('/auth/login', { method: 'POST', body: payload })
}

export async function logoutAccount() {
  try {
    return await apiRequest('/auth/logout', { method: 'POST', body: {} })
  } finally {
    clearSession()
  }
}

export async function listDemoActors() {
  return apiRequest('/auth/demo-actors')
}

export async function getMe() {
  return apiRequest('/me')
}

export async function getCurrentIdentity() {
  return getMe()
}

export async function getDashboard() {
  return apiRequest('/dashboard')
}

export async function getActivity() {
  return apiRequest('/activity')
}

export async function listMarketplaceListings(filters = {}) {
  return apiRequest(`/marketplace/listings${queryString({ state: 'published', ...filters })}`)
}

export async function getListing(listingId) {
  return apiRequest(`/listings/${encodeURIComponent(listingId)}`)
}

export async function createListing(payload) {
  return apiRequest('/listings', { method: 'POST', body: payload })
}

export async function publishListing(listingId, version) {
  return apiRequest(`/listings/${encodeURIComponent(listingId)}/publish`, { method: 'POST', body: { version } })
}

export async function requestListing(listingId, payload) {
  return apiRequest(`/listings/${encodeURIComponent(listingId)}/request`, { method: 'POST', body: payload })
}

export async function listProjects() {
  return apiRequest('/projects')
}

export async function createProject(payload) {
  return apiRequest('/projects', { method: 'POST', body: payload })
}

export async function getProject(projectId) {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}`)
}

export async function publishProject(projectId) {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/publish`, { method: 'POST', body: {} })
}

export async function listBalanceRequests() {
  return apiRequest('/balance-requests')
}

export async function createBalanceRequest(payload) {
  return apiRequest('/balance-requests', { method: 'POST', body: payload })
}

export async function offerBalanceRequest(requestId, payload) {
  return apiRequest(`/balance-requests/${encodeURIComponent(requestId)}/offer`, { method: 'POST', body: payload })
}

export async function acceptBalanceRequest(requestId) {
  return apiRequest(`/balance-requests/${encodeURIComponent(requestId)}/accept`, { method: 'POST', body: {} })
}

export async function declineBalanceRequest(requestId) {
  return apiRequest(`/balance-requests/${encodeURIComponent(requestId)}/decline`, { method: 'POST', body: {} })
}

export async function listParticipations() {
  return apiRequest('/participations')
}

export async function createParticipation(payload) {
  return apiRequest('/participations', { method: 'POST', body: payload })
}

export async function listAppreciations() {
  return apiRequest('/appreciations')
}

export async function createAppreciation(payload) {
  return apiRequest('/appreciations', { method: 'POST', body: payload })
}

export async function loadWorkspace(listingFilters = {}) {
  const empty = []
  const [listings, requirements, requests, capabilities, processes, me, dashboard, activity, projects, balanceRequests, participations, appreciations] = await Promise.all([
    optionalRequest(`/marketplace/listings${queryString({ state: 'published', ...listingFilters })}`),
    optionalRequest('/requirements'),
    optionalRequest('/requests'),
    optionalRequest('/assistant/capabilities'),
    optionalRequest('/processes'),
    optionalRequest('/me'),
    optionalRequest('/dashboard'),
    optionalRequest('/activity'),
    optionalRequest('/projects'),
    optionalRequest('/balance-requests'),
    optionalRequest('/participations'),
    optionalRequest('/appreciations'),
  ])
  return {
    listings: asItems(listings),
    requirements: asItems(requirements),
    requests: asItems(requests),
    capabilities,
    processes: asItems(processes),
    me: me || null,
    dashboard: dashboard || null,
    activity: asItems(activity),
    projects: asItems(projects),
    balanceRequests: asItems(balanceRequests),
    participations: asItems(participations),
    appreciations: asItems(appreciations),
    empty,
  }
}

export async function createConversation(title = 'CarbonBridge assistant') {
  return apiRequest('/conversations', { method: 'POST', body: { title } })
}

export async function getConversation(conversationId) {
  return apiRequest(`/conversations/${encodeURIComponent(conversationId)}`)
}

export async function sendConversationMessage(conversationId, message) {
  return apiRequest(`/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: { message } })
}

export async function discoverProcess(description, structured = {}) {
  return apiRequest('/processes/discover', { method: 'POST', body: { description, structured } })
}

export async function runMatches(requirementId) {
  return apiRequest('/matches/run', { method: 'POST', body: { requirementId } })
}

export async function approveAction(actionId) {
  return apiRequest(`/actions/${encodeURIComponent(actionId)}/approve`, { method: 'POST', body: {} })
}

export async function createRequirement(payload) {
  return apiRequest('/requirements', { method: 'POST', body: payload })
}

export async function requestAction(requestId, action, version) {
  return apiRequest(`/requests/${encodeURIComponent(requestId)}/${action}`, {
    method: 'POST',
    body: { version },
    headers: { 'Idempotency-Key': `web-${action}-${requestId}-${version}` },
  })
}

export async function patchListing(listingId, payload) {
  return apiRequest(`/listings/${encodeURIComponent(listingId)}`, { method: 'PATCH', body: payload })
}

export async function createSupplyRequest(payload) {
  return apiRequest('/requests', { method: 'POST', body: payload, headers: { 'Idempotency-Key': `web-request-${crypto.randomUUID()}` } })
}

export async function getMatchReceipt(matchId) {
  return apiRequest(`/matches/${encodeURIComponent(matchId)}/receipt`)
}

export async function createMatchScenario(matchId, overrides) {
  return apiRequest(`/matches/${encodeURIComponent(matchId)}/scenarios`, { method: 'POST', body: { overrides } })
}
