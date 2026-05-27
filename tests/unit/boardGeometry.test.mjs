import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateCircleOffset,
  calculateDonutOffset,
  flippedScale,
} from '../../src/shared/boardGeometry.js'

test('calculateCircleOffset follows strategy board sector crop center', () => {
  assert.deepEqual(calculateCircleOffset(90), { offsetX: 768, offsetY: 256 })
  assert.equal(calculateCircleOffset(100).offsetX, 768)
  assert.equal(Math.round(calculateCircleOffset(100).offsetY), 300)
})

test('calculateDonutOffset returns crop center relative to the donut origin', () => {
  assert.deepEqual(calculateDonutOffset({
    arcAngle: 360,
    outerRadius: 512,
    innerRadius: 160,
  }), { offsetX: 0, offsetY: 0 })
  assert.deepEqual(calculateDonutOffset({
    arcAngle: 90,
    outerRadius: 512,
    innerRadius: 160,
  }), { offsetX: 256, offsetY: -256 })
})

test('flippedScale mirrors a rendered object without changing its stored size', () => {
  assert.equal(flippedScale(1.5, false), 1.5)
  assert.equal(flippedScale(1.5, true), -1.5)
})
