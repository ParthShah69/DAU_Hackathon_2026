import { createServer, request as proxyRequest } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT || 4173)
const apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:8080'
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const safePath = (pathname) => {
  const candidate = normalize(join(root, pathname === '/' ? 'index.html' : pathname))
  return candidate.startsWith(root) ? candidate : null
}

function forwardApi(request, response) {
  const target = new URL(request.url || '/', apiOrigin)
  const { origin: _origin, ...forwardHeaders } = request.headers
  const upstream = proxyRequest(target, {
    method: request.method,
    hostname: target.hostname,
    port: target.port || undefined,
    path: `${target.pathname}${target.search}`,
    headers: { ...forwardHeaders, host: target.host },
  }, (upstreamResponse) => {
    const headers = { ...upstreamResponse.headers }
    delete headers['access-control-allow-origin']
    delete headers['access-control-allow-credentials']
    response.writeHead(upstreamResponse.statusCode || 502, headers)
    upstreamResponse.pipe(response)
  })
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: { code: 'API_UNAVAILABLE', message: `CarbonBridge API is unavailable at ${apiOrigin}` } }))
  })
  request.pipe(upstream)
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      forwardApi(request, response)
      return
    }
    const file = safePath(pathname)
    if (!file) {
      response.writeHead(403).end('Forbidden')
      return
    }
    let fileStat
    try { fileStat = await stat(file) } catch { fileStat = null }
    // Client-side routes are served by the same shell so /marketplace,
    // /processes and /requirements/new work when opened or refreshed directly.
    const requestedExtension = extname(pathname)
    if (!fileStat || !fileStat.isFile()) {
      if (requestedExtension) throw new Error('Not a file')
      response.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-cache' })
      response.end(await readFile(join(root, 'index.html')))
      return
    }
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    response.end(await readFile(file))
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`CarbonBridge web preview running at http://127.0.0.1:${port}`)
})
