import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decodeBoardCode,
  encodeBoardCode,
} from '../../src/web/api.js'

interface TestFetchInit {
  body: string
  headers?: Record<string, string>
  method?: string
}

interface TestResponse {
  ok: boolean
  text(): Promise<string>
}

type TestFetch = (url: string, init: TestFetchInit) => Promise<TestResponse>

test('decodeBoardCode parses JSON responses and sends the input code', async () => {
  const restoreFetch = withFetch(async (url, init) => {
    assert.equal(url, '/utils/code2json')
    assert.deepEqual(JSON.parse(init.body), { code: 'share-code' })
    return createResponse(true, JSON.stringify({ data: { objects: [] } }))
  })
  try {
    assert.deepEqual(await decodeBoardCode('share-code'), { objects: [] })
  } finally {
    restoreFetch()
  }
})

test('encodeBoardCode reports JSON API error messages', async () => {
  const restoreFetch = withFetch(async () =>
    createResponse(false, JSON.stringify({ ok: false, error: 'bad board' })))
  try {
    await assert.rejects(
      encodeBoardCode({ objects: [] }),
      /bad board/,
    )
  } finally {
    restoreFetch()
  }
})

test('encodeBoardCode reports plain text server errors', async () => {
  const restoreFetch = withFetch(async () => createResponse(false, 'Internal Server Error'))
  try {
    await assert.rejects(
      encodeBoardCode({ objects: [] }),
      /Internal Server Error/,
    )
  } finally {
    restoreFetch()
  }
})

function createResponse(ok: boolean, text: string): TestResponse {
  return {
    ok,
    async text() {
      return text
    },
  }
}

function withFetch(fetchImpl: TestFetch) {
  const globals = globalThis as { fetch?: unknown }
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchImpl,
  })
  return () => {
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', originalFetch)
    } else {
      delete globals.fetch
    }
  }
}
