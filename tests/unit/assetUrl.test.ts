import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configureAssetVersions,
  toAssetUrl,
} from '../../src/web/assetUrl.ts'

test('asset URLs combine reverse-proxy prefixes with per-file content versions', () => {
  const versions = {
    '/assets/objects/tab1.webp': 'content-hash',
  }

  assert.equal(
    toAssetUrl('/assets/objects/tab1.webp', '/n/editor', versions),
    '/n/assets/objects/tab1.webp?v=content-hash',
  )
  assert.equal(
    toAssetUrl('/assets/objects/tab2.webp', '/n/editor', versions),
    '/n/assets/objects/tab2.webp',
  )
})

test('asset URL configuration is applied after editor metadata loads', () => {
  configureAssetVersions({ '/assets/background/1.webp': 'background-hash' })
  assert.equal(
    toAssetUrl('/assets/background/1.webp', '/editor'),
    '/assets/background/1.webp?v=background-hash',
  )
  configureAssetVersions({})
})
