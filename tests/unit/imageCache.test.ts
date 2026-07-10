import assert from 'node:assert/strict'
import test from 'node:test'

import { loadCachedBrowserImage } from '../../src/web/imageCache.ts'

test('failed browser image promises are removed so the next load can retry', async () => {
  const cache = new Map<string, Promise<HTMLImageElement>>()
  const created: HTMLImageElement[] = []
  const createImage = () => {
    const image = { onerror: null, onload: null, src: '' } as unknown as HTMLImageElement
    created.push(image)
    return image
  }

  const first = loadCachedBrowserImage(cache, '/retry.webp', createImage)
  assert.equal(loadCachedBrowserImage(cache, '/retry.webp', createImage), first)
  assert.equal(created.length, 1)
  created[0]?.onerror?.(new Event('error'), '', 0, 0, new Error('failed'))
  await assert.rejects(first)
  assert.equal(cache.has('/retry.webp'), false)

  const second = loadCachedBrowserImage(cache, '/retry.webp', createImage)
  assert.notEqual(second, first)
  assert.equal(created.length, 2)
  created[1]?.onload?.(new Event('load'))
  assert.equal(await second, created[1])
  assert.equal(cache.get('/retry.webp'), second)
})
