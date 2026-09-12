// The preview intentionally runs without a backend. To exercise the live
// prototype, set either the global before main.js loads or use ?api=/api/v1:
// window.__CARBONBRIDGE_CONFIG__ = {
//   apiBaseUrl: '/api/v1',
//   demoUser: 'user-seller',
//   demoOrganization: 'org-carbonstone',
// }
const runtimeConfig = globalThis.__CARBONBRIDGE_CONFIG__ || {}
const queryConfig = typeof globalThis.location === 'undefined' ? new URLSearchParams() : new URLSearchParams(globalThis.location.search)

export const apiBaseUrl = String(runtimeConfig.apiBaseUrl || queryConfig.get('api') || '').replace(/\/$/, '')
export const isDemoMode = runtimeConfig.mode === 'demo' || apiBaseUrl.length === 0
export const demoUser = String(runtimeConfig.demoUser || queryConfig.get('user') || 'user-buyer')
export const demoOrganization = String(runtimeConfig.demoOrganization || queryConfig.get('organization') || '')

function headersForRequest(headers = {}) {
  return {
    Accept: 'application/json',
    'x-demo-user': demoUser,
    ...(demoOrganization ? { 'x-demo-organization': demoOrganization } : {}),
    ...headers,
  }
}

function unwrapEnvelope(payload) {
  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
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

export async function health() {
  return apiRequest('/health')
}

export async function loadWorkspace() {
  const [listings, requirements, requests, capabilities, processes] = await Promise.all([
    apiRequest('/marketplace/listings'),
    apiRequest('/requirements'),
    apiRequest('/requests'),
    apiRequest('/assistant/capabilities'),
    apiRequest('/processes'),
  ])
  return { listings: listings?.items || [], requirements: requirements?.items || [], requests: requests?.items || [], capabilities, processes: processes?.items || [] }
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
