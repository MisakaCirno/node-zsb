import assert from 'node:assert/strict'
import test from 'node:test'

import {
  constrainObjectScale,
  constrainTransformBox,
  getObjectScaleLimits,
  getSelectionScaleLimits,
} from '../../src/web/transformGeometry.js'

test('constrainTransformBox keeps fixed-ratio side handles anchored on the opposite midpoint', () => {
  const box = constrainTransformBox({
    activeAnchor: 'middle-right',
    baseBox: { x: 100, y: 80, width: 40, height: 20 },
    limits: { minX: 0.5, maxX: 3, minY: 0.5, maxY: 3, keepRatio: true },
    newBox: { x: 100, y: 80, width: 80, height: 20 },
    oldBox: { x: 100, y: 80, width: 40, height: 20 },
  })

  assert.deepEqual(box, {
    x: 100,
    y: 70,
    width: 80,
    height: 40,
    rotation: undefined,
  })
})

test('constrainTransformBox rejects fixed-ratio scaling outside the selected limits', () => {
  const oldBox = { x: 100, y: 80, width: 40, height: 20 }
  const box = constrainTransformBox({
    activeAnchor: 'bottom-right',
    baseBox: oldBox,
    limits: { minX: 0.5, maxX: 1.5, minY: 0.5, maxY: 1.5, keepRatio: true },
    newBox: { x: 100, y: 80, width: 100, height: 50 },
    oldBox,
  })

  assert.equal(box, oldBox)
})

test('constrainObjectScale applies line AOE width and height limits independently', () => {
  assert.deepEqual(
    constrainObjectScale({ type: 'line_aoe', x: 0, y: 0, width: 128, height: 128 }, 8, 0.05),
    { scaleX: 4, scaleY: 0.125 },
  )
})

test('constrainObjectScale clamps normal object rendered scale as an absolute display scale', () => {
  assert.deepEqual(
    constrainObjectScale({ type: 'tank', x: 0, y: 0, size: 200 }, 2.4, 0.1),
    { scaleX: 2, scaleY: 0.5 },
  )
})

test('getSelectionScaleLimits intersects limits from selected transformable objects', () => {
  assert.deepEqual(
    getSelectionScaleLimits([
      { type: 'tank', x: 0, y: 0, size: 100 },
      { type: 'circle_aoe', x: 0, y: 0, size: 20 },
    ]),
    {
      minX: 0.5,
      maxX: 2,
      minY: 0.5,
      maxY: 2,
      keepRatio: true,
    },
  )
})

test('getObjectScaleLimits treats text and line objects as non-transformable only at selection level', () => {
  assert.deepEqual(getSelectionScaleLimits([
    { type: 'text', x: 0, y: 0 },
    { type: 'line', x: 0, y: 0, endX: 10, endY: 10 },
  ]), null)
  assert.deepEqual(getObjectScaleLimits({ type: 'tank', x: 0, y: 0, size: 200 }), {
    minX: 0.25,
    maxX: 1,
    minY: 0.25,
    maxY: 1,
    keepRatio: true,
  })
})
