import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAnchoredScrollPosition,
  getPannedScrollPosition,
  getWheelZoom,
} from '../../src/web/viewportNavigation.js'

test('wheel zoom changes smoothly and respects editor zoom limits', () => {
  assert.ok(getWheelZoom(1, -100) > 1)
  assert.ok(getWheelZoom(1, 100) < 1)
  assert.equal(getWheelZoom(2, -10_000), 2)
  assert.equal(getWheelZoom(0.25, 10_000), 0.25)
})

test('anchored zoom keeps the same canvas point under the pointer', () => {
  const scroll = getAnchoredScrollPosition({
    before: { left: 100, top: 80, width: 500, height: 400 },
    after: { left: 50, top: 30, width: 1_000, height: 800 },
    pointer: { x: 350, y: 280 },
    scrollLeft: 20,
    scrollTop: 10,
  })

  assert.deepEqual(scroll, { left: 220, top: 160 })
})

test('drag panning moves scroll position opposite to pointer movement', () => {
  assert.deepEqual(getPannedScrollPosition({
    startPointer: { x: 300, y: 200 },
    currentPointer: { x: 250, y: 150 },
    startScrollLeft: 120,
    startScrollTop: 80,
  }), {
    left: 170,
    top: 130,
  })
})
