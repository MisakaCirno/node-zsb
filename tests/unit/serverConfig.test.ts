import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SERVER_HOST,
  DEFAULT_SERVER_PORT,
  formatServerOrigin,
  getServerInfo,
} from '../../src/server/serverConfig.ts'

test('server configuration uses the existing localhost port 3000 defaults', () => {
  assert.deepEqual(getServerInfo({}), {
    hostname: DEFAULT_SERVER_HOST,
    port: DEFAULT_SERVER_PORT,
  })
})

test('server configuration accepts an alternate loopback address and port', () => {
  assert.deepEqual(
    getServerInfo({
      NODE_ZSB_HOST: ' ::1 ',
      NODE_ZSB_PORT: '3001',
    }),
    {
      hostname: '::1',
      port: 3001,
    },
  )
})

test('server configuration rejects invalid ports before starting the server', () => {
  for (const port of ['0', '65536', '3000.5', 'not-a-port']) {
    assert.throws(
      () => getServerInfo({ NODE_ZSB_PORT: port }),
      /NODE_ZSB_PORT must be an integer between 1 and 65535/,
    )
  }
})

test('server configuration formats IPv4, hostnames, and IPv6 origins', () => {
  assert.equal(
    formatServerOrigin({ hostname: 'localhost', port: 3000 }),
    'http://localhost:3000',
  )
  assert.equal(
    formatServerOrigin({ hostname: '127.0.0.1', port: 3001 }),
    'http://127.0.0.1:3001',
  )
  assert.equal(
    formatServerOrigin({ hostname: '::1', port: 3000 }),
    'http://[::1]:3000',
  )
})
