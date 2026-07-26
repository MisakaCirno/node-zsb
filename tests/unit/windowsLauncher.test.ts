import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const batchSource = readFileSync('start_node_zsb.bat', 'utf8')
const launcherSource = readFileSync('ops/windows/Start-NodeZsb.ps1', 'utf8')

test('Windows launcher delegates to the tracked PowerShell implementation', () => {
  assert.match(batchSource, /Start-NodeZsb\.ps1/)
  assert.doesNotMatch(batchSource, /\bnode\s+index\.ts\b/i)
})

test('Windows launcher only fast-forwards clean tracked checkouts', () => {
  assert.match(launcherSource, /status --porcelain --untracked-files=no/)
  assert.match(launcherSource, /fetch --prune/)
  assert.match(launcherSource, /'merge', '--ff-only', '@\{u\}'/)
  assert.doesNotMatch(launcherSource, /reset\s+--hard/i)
  assert.doesNotMatch(launcherSource, /gitCommand clean/)
})

test('Windows launcher prepares and smoke-tests changed commits', () => {
  assert.match(launcherSource, /'install', '--frozen-lockfile'/)
  assert.match(launcherSource, /'run', 'build'/)
  assert.match(launcherSource, /'run', 'test:smoke'/)
  assert.match(launcherSource, /\.node-zsb-runtime/)
  assert.match(launcherSource, /\[switch\]\$ForcePrepare/)
  assert.match(launcherSource, /prepared-state/)
})

test('Windows launcher starts built assets with configurable listener values', () => {
  assert.match(launcherSource, /\$env:NODE_ZSB_HOST = \$listenHostname/)
  assert.match(launcherSource, /\$env:NODE_ZSB_PORT = \[string\]\$listenPort/)
  assert.match(launcherSource, /\$env:NODE_ENV = 'production'/)
  assert.match(launcherSource, /\$env:NODE_ZSB_SERVE_DIST = '1'/)
  assert.match(launcherSource, /Assert-PortAvailable/)
})
