import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

const origin = process.env.NODE_ZSB_SMOKE_ORIGIN ?? 'http://localhost:3000'
const builtEntry = 'dist/web/app.js'
let serverProcess: ChildProcess | null = null

interface EditorDataPayload {
  defaultCode?: unknown
}

interface RenderPayload {
  ok?: unknown
  data?: {
    hash?: unknown
    thumbhash?: unknown
  }
}

async function main() {
  if (!existsSync(builtEntry)) {
    throw new Error(`Missing ${builtEntry}; run bun run build before the smoke test`)
  }

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
  await expectResponse('/editor', 'text/html')
  await expectResponse('/editor/app.js', 'javascript')
  await expectResponse('/board', 'image/webp', { requireBody: true })

  const editorData = await expectJson<EditorDataPayload>('/editor-data')
  if (typeof editorData.defaultCode !== 'string' || !editorData.defaultCode) {
    throw new Error('Editor metadata did not include a default board code')
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
  await expectResponse(`/preview/${hash}.webp`, 'image/webp', { requireBody: true })

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
