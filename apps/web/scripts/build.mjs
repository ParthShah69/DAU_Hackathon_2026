import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const dist = join(appRoot, 'dist')
await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(join(appRoot, 'index.html'), join(dist, 'index.html'))
await mkdir(join(dist, 'src'), { recursive: true })
await cp(join(appRoot, 'src', 'main.js'), join(dist, 'src', 'main.js'))
await cp(join(appRoot, 'src', 'api.js'), join(dist, 'src', 'api.js'))
await cp(join(appRoot, 'src', 'styles.css'), join(dist, 'src', 'styles.css'))
const html = await readFile(join(dist, 'index.html'), 'utf8')
if (!html.includes('/src/main.js')) throw new Error('index.html does not reference src/main.js')
console.log('CarbonBridge web preview built in apps/web/dist')
