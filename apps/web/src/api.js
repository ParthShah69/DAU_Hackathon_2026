// The preview intentionally runs without a backend. Set
// window.__CARBONBRIDGE_CONFIG__ = { apiBaseUrl: 'https://your-api.example/api/v1' }
// before main.js loads to use the same UI against an authenticated API.
const runtimeConfig = globalThis.__CARBONBRIDGE_CONFIG__ || {}

export const apiBaseUrl = String(runtimeConfig.apiBaseUrl || '').replace(/\/$/, '')
export const isDemoMode = apiBaseUrl.length === 0

export async function apiRequest(path, options = {}) {
  if (isDemoMode) return null
  const response = await fetch(`${apiBaseUrl}/${String(path).replace(/^\//, '')}`, {
    ...options,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  })
  if (!response.ok) throw new Error(`CarbonBridge API request failed (${response.status})`)
  if (response.status === 204) return null
  return response.json()
}
