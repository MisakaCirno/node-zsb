import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBoardController,
  type BoardControllerDependencies,
} from '../../src/server/controllers/imageController.ts'

const code = '[stgy:test]'
const hash = 'a'.repeat(64)

test('versioned board images use immutable browser caching and stable etags', async () => {
  const app = createBoardController(createDependencies())
  const response = await app.handle(requestFor(`/board/${encodeURIComponent(code)}?rv=2`))

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.equal(response.headers.get('etag'), `"${hash}"`)
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'webp')
})

test('unversioned board images remain compatible and revalidate with etags', async () => {
  let renderCount = 0
  const app = createBoardController(createDependencies({
    render: async () => {
      renderCount += 1
      return { hash, data: Buffer.from('webp') }
    },
  }))
  const first = await app.handle(requestFor(`/board/${encodeURIComponent(code)}`))
  const second = await app.handle(requestFor(`/board/${encodeURIComponent(code)}`, {
    headers: { 'if-none-match': `W/"${hash}"` },
  }))

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('cache-control'), 'public, no-cache')
  assert.equal(second.status, 304)
  assert.equal(second.headers.get('cache-control'), 'public, no-cache')
  assert.equal(second.headers.get('etag'), `"${hash}"`)
  assert.equal(await second.text(), '')
  assert.equal(renderCount, 2)
})

test('mismatched render versions redirect without rendering or losing query parameters', async () => {
  let renderCount = 0
  let validatedCode = ''
  const app = createBoardController(createDependencies({
    render: async () => {
      renderCount += 1
      return { hash, data: Buffer.from('webp') }
    },
    validate: (value) => {
      validatedCode = value ?? ''
    },
  }))
  const response = await app.handle(requestFor(
    `/board/${encodeURIComponent(code)}?size=large&rv=old`,
  ))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('location'), '?size=large&rv=2')
  assert.equal(validatedCode, code)
  assert.equal(renderCount, 0)
})

test('preview hashes are immutable, conditional, and missing files are not cached', async () => {
  const app = createBoardController(createDependencies())
  const first = await app.handle(requestFor(`/preview/${hash}.webp`))
  const conditional = await app.handle(requestFor(`/preview/${hash}.webp`, {
    headers: { 'if-none-match': `"other", "${hash}"` },
  }))

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal(first.headers.get('etag'), `"${hash}"`)
  assert.equal(conditional.status, 304)

  const missingApp = createBoardController(createDependencies({
    readCached: async () => null,
  }))
  const missing = await missingApp.handle(requestFor(`/preview/${hash}.webp`))
  assert.equal(missing.status, 404)
  assert.equal(missing.headers.get('cache-control'), 'no-store')
})

test('offline render metadata is never stored by browsers', async () => {
  const app = createBoardController(createDependencies())
  const response = await app.handle(requestFor('/board/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  }))

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

function createDependencies(
  overrides: Partial<BoardControllerDependencies> = {},
): BoardControllerDependencies {
  return {
    renderVersion: '2',
    render: async () => ({ hash, data: Buffer.from('webp') }),
    renderOffline: async () => ({ hash, thumbhash: 'thumb' }),
    readCached: async () => Buffer.from('webp'),
    validate: () => undefined,
    ...overrides,
  }
}

function requestFor(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init)
}
