import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const html = await readFile(join(appRoot, 'index.html'), 'utf8')
const js = await readFile(join(appRoot, 'src', 'main.js'), 'utf8')
const api = await readFile(join(appRoot, 'src', 'api.js'), 'utf8')
const css = await readFile(join(appRoot, 'src', 'styles.css'), 'utf8')
const required = [
  ['index.html', html, '<div id="root">'],
  ['main.js', js, 'CarbonBridge'],
  ['api.js', api, 'apiBaseUrl'],
  ['styles.css', css, '.assistant-panel'],
]
for (const [name, source, marker] of required) {
  if (!source.includes(marker)) throw new Error(`${name} is missing ${marker}`)
}
if (!js.includes("addEventListener('click'")) throw new Error('main.js has no interaction wiring')
if (!js.includes('Describe my process')) throw new Error('process-first entry point is missing')
if (!js.includes('Evidence needed')) throw new Error('evidence state is missing')
if (!js.includes('isDemoMode')) throw new Error('demo/live runtime label is missing')
for (const marker of ['loadWorkspace', 'sendConversationMessage', 'discoverProcess', 'approveAction', 'hydrate()', 'analyzeProcess()']) {
  if (!js.includes(marker)) throw new Error(`main.js is missing live workflow integration: ${marker}`)
}
const combined = `${js}\n${api}`
for (const marker of ['auth/register', 'loadWorkspace', 'carbonbridge.session', 'offset', 'Balance', 'demo-actors']) {
  if (!combined.includes(marker)) throw new Error(`web preview is missing integration marker: ${marker}`)
}
if (!js.includes('currentOrganization') && !js.includes('displayName')) throw new Error('identity from /me is missing (currentOrganization or displayName)')
if (!html.includes('/src/styles.css')) throw new Error('index.html must load the active stylesheet')
if (!html.includes('apiBaseUrl')) throw new Error('index.html must configure the same-origin API proxy')
if (/<(?:div|span|button|section|article|aside|svg|path)[^>]*\s\/>/.test(js)) throw new Error('main.js contains invalid self-closing non-void HTML')
console.log('CarbonBridge web checks passed')
