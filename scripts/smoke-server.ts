import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { RENDER_CACHE_VERSION } from '../src/server/utils/renderCache.ts'

const origin = process.env.NODE_ZSB_SMOKE_ORIGIN ?? 'http://localhost:3000'
const builtEntry = 'dist/web/app.js'
let serverProcess: ChildProcess | null = null

interface EditorDataPayload {
  assetVersions?: Record<string, unknown>
  defaultCode?: unknown
}

interface RenderPayload {
  ok?: unknown
  data?: {
    hash?: unknown
    thumbhash?: unknown
  }
}

interface AssetManifest {
  webVersion: string
  stylesVersion: string
  vendorVersion: string
  assets: Record<string, string>
}

async function main() {
  if (!existsSync(builtEntry)) {
    throw new Error(`Missing ${builtEntry}; run bun run build before the smoke test`)
  }
  const assetManifest = JSON.parse(
    readFileSync('dist/asset-manifest.json', 'utf8'),
  ) as AssetManifest

  const hadServer = await isServerReady()
  if (!hadServer) {
    serverProcess = spawn('bun', ['index.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NODE_ZSB_SERVE_DIST: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    serverProcess.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk))
    serverProcess.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk))
    await waitForServer()
  }

  const health = await expectJson<{ status?: unknown }>('/health/live')
  if (health.status !== 'ok') {
    throw new Error('Health endpoint did not report an ok status')
  }
  const editor = await expectResponse('/editor', 'text/html')
  const editorHtml = await editor.text()
  for (const versionedReference of [
    `./editor/styles.css?v=${assetManifest.stylesVersion}`,
    `./vendor/konva.min.js?v=${assetManifest.vendorVersion}`,
    `./editor/app.js?v=${assetManifest.webVersion}`,
  ]) {
    if (!editorHtml.includes(versionedReference)) {
      throw new Error(`Editor HTML did not reference ${versionedReference}`)
    }
  }
  const appScript = await expectResponse(
    `/editor/app.js?v=${assetManifest.webVersion}`,
    'javascript',
  )
  expectHeader(appScript, 'cache-control', 'public, max-age=31536000, immutable')
  const styles = await expectResponse(
    `/editor/styles.css?v=${assetManifest.stylesVersion}`,
    'text/css',
  )
  expectHeader(styles, 'cache-control', 'public, max-age=31536000, immutable')
  const vendor = await expectResponse(
    `/vendor/konva.min.js?v=${assetManifest.vendorVersion}`,
    'javascript',
  )
  expectHeader(vendor, 'cache-control', 'public, max-age=31536000, immutable')
  const backgroundVersion = assetManifest.assets['/assets/background/1.webp']
  const background = await expectResponse(
    `/assets/background/1.webp?v=${backgroundVersion}`,
    'image/webp',
    { requireBody: true },
  )
  expectHeader(background, 'cache-control', 'public, max-age=31536000, immutable')
  const unversionedBackground = await expectResponse('/assets/background/1.webp', 'image/webp')
  expectHeader(unversionedBackground, 'cache-control', 'no-store')
  const fontPath = '/assets/fonts/MiSans-Semibold.woff2'
  const font = await expectResponse(
    `${fontPath}?v=${assetManifest.assets[fontPath]}`,
    'font/woff2',
    { requireBody: true },
  )
  expectHeader(font, 'cache-control', 'public, max-age=31536000, immutable')
  const compatibleBoard = await expectResponse('/board', 'image/webp', { requireBody: true })
  expectHeader(compatibleBoard, 'cache-control', 'public, no-cache')
  const versionedBoard = await expectResponse(
    `/board?rv=${encodeURIComponent(RENDER_CACHE_VERSION)}`,
    'image/webp',
    { requireBody: true },
  )
  expectHeader(versionedBoard, 'cache-control', 'public, max-age=31536000, immutable')
  await expectNotModified(
    `/board?rv=${encodeURIComponent(RENDER_CACHE_VERSION)}`,
    versionedBoard.headers.get('etag'),
  )

  const editorData = await expectJson<EditorDataPayload>('/editor-data')
  if (typeof editorData.defaultCode !== 'string' || !editorData.defaultCode) {
    throw new Error('Editor metadata did not include a default board code')
  }
  if (editorData.assetVersions?.['/assets/background/1.webp'] !== backgroundVersion) {
    throw new Error('Editor metadata did not include the current background version')
  }

  const render = await expectJson<RenderPayload>('/board/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: editorData.defaultCode }),
  })
  const hash = render.data?.hash
  if (render.ok !== true || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error('Render endpoint did not return a valid preview hash')
  }
  if (typeof render.data?.thumbhash !== 'string' || !render.data.thumbhash) {
    throw new Error('Render endpoint did not return a thumbhash')
  }
  const preview = await expectResponse(`/preview/${hash}.webp`, 'image/webp', {
    requireBody: true,
  })
  expectHeader(preview, 'cache-control', 'public, max-age=31536000, immutable')
  await expectNotModified(`/preview/${hash}.webp`, preview.headers.get('etag'))

  console.log('Bun server smoke test passed')
}

async function expectJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${origin}${path}`, init)
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function expectResponse(
  path: string,
  expectedContentType: string,
  { requireBody = false }: { requireBody?: boolean } = {},
) {
  const response = await fetch(`${origin}${path}`)
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes(expectedContentType.toLowerCase())) {
    throw new Error(`${path} returned unexpected content type ${contentType || '(empty)'}`)
  }
  if (requireBody && (await response.arrayBuffer()).byteLength === 0) {
    throw new Error(`${path} returned an empty body`)
  }
  return response
}

function expectHeader(response: Response, name: string, expected: string) {
  const actual = response.headers.get(name)
  if (actual !== expected) {
    throw new Error(`${name} was ${actual || '(empty)'} instead of ${expected}`)
  }
}

async function expectNotModified(path: string, etag: string | null) {
  if (!etag) throw new Error(`${path} did not return an etag`)
  const response = await fetch(`${origin}${path}`, {
    headers: { 'if-none-match': etag },
  })
  if (response.status !== 304) {
    throw new Error(`${path} returned HTTP ${response.status} instead of 304`)
  }
}

async function waitForServer() {
  const started = Date.now()
  while (Date.now() - started < 30_000) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(`Bun server exited before it became ready with code ${serverProcess?.exitCode}`)
    }
    if (await isServerReady()) return
    await delay(250)
  }
  throw new Error(`Bun server did not become ready at ${origin}`)
}

async function isServerReady() {
  try {
    const response = await fetch(`${origin}/editor`)
    return response.ok
  } catch {
    return false
  }
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return
  serverProcess.kill('SIGTERM')
  const exited = await waitForExit(serverProcess, 2_000)
  if (!exited && serverProcess.exitCode === null) {
    serverProcess.kill('SIGKILL')
    await waitForExit(serverProcess, 2_000)
  }
}

function waitForExit(child: ChildProcess, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(stopServer)
