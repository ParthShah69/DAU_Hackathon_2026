import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT || 4173)
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

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname
    const file = safePath(pathname)
    if (!file) {
      response.writeHead(403).end('Forbidden')
      return
    }
    const fileStat = await stat(file)
    if (!fileStat.isFile()) throw new Error('Not a file')
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    response.end(await readFile(file))
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`CarbonBridge web preview running at http://127.0.0.1:${port}`)
})
