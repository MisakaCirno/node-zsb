import assert from 'node:assert/strict'
import test from 'node:test'

import { getAppBasePath, toAppUrl } from '../../src/web/appUrl.js'

test('application URLs remain root-relative for the direct editor entry', () => {
  assert.equal(getAppBasePath('/editor'), '')
  assert.equal(toAppUrl('/editor-data', '/editor'), '/editor-data')
  assert.equal(toAppUrl('/assets/background/1.webp', '/editor'), '/assets/background/1.webp')
})

test('application URLs inherit a reverse-proxy prefix from the editor entry', () => {
  assert.equal(getAppBasePath('/n/editor'), '/n')
  assert.equal(toAppUrl('/editor-data', '/n/editor'), '/n/editor-data')
  assert.equal(toAppUrl('/board/render', '/nested/n/editor'), '/nested/n/board/render')
})

test('application URL helpers tolerate query-independent trailing slashes and reject relative inputs', () => {
  assert.equal(getAppBasePath('/n/editor/'), '/n')
  assert.equal(getAppBasePath('/unrelated'), '')
  assert.throws(() => toAppUrl('editor-data', '/n/editor'), /must start with/)
})
