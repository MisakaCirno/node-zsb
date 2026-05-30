import { spawn } from 'node:child_process'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000/editor'
const args = process.argv.slice(2)
let serverProcess = null

async function main() {
  const hadServer = await isServerReady()
  if (!hadServer) {
    serverProcess = spawn('bun', ['index.ts'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    serverProcess.stdout?.on('data', (chunk) => process.stdout.write(chunk))
    serverProcess.stderr?.on('data', (chunk) => process.stderr.write(chunk))
    await waitForServer()
  }

  const exitCode = await runPlaywright()
  await stopServer()
  process.exit(exitCode)
}

async function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', ...args],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PLAYWRIGHT_SKIP_WEB_SERVER: '1',
        },
        stdio: 'inherit',
        windowsHide: true,
      },
    )
    child.on('exit', (code, signal) => {
      if (typeof code === 'number') {
        resolve(code)
        return
      }
      console.error(`Playwright exited from signal ${signal ?? 'unknown'}`)
      resolve(1)
    })
  })
}

async function waitForServer() {
  const started = Date.now()
  while (Date.now() - started < 30_000) {
    if (await isServerReady()) return
    await delay(500)
  }
  throw new Error(`Server did not become ready at ${baseUrl}`)
}

async function isServerReady() {
  try {
    const response = await fetch(baseUrl)
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

function waitForExit(child, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch(async (error) => {
  console.error(error)
  await stopServer()
  process.exit(1)
})
