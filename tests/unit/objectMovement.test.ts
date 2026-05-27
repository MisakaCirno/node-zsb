import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getConstrainedMoveDelta,
  moveObjectBy,
} from '../../src/web/objectMovement.js'

test('moveObjectBy keeps line endpoints in sync with the object origin', () => {
  const object = {
    type: 'line',
    x: 20,
    y: 30,
    endX: 80,
    endY: 90,
  }

  moveObjectBy(object, 12, -8)

  assert.deepEqual(object, {
    type: 'line',
    x: 32,
    y: 22,
    endX: 92,
    endY: 82,
  })
})

test('getConstrainedMoveDelta clamps a group delta to the board bounds', () => {
  assert.deepEqual(
    getConstrainedMoveDelta({
      left: 24,
      right: 500,
      top: 16,
      bottom: 360,
    }, 24, 40),
    { dx: 12, dy: 24 },
  )
})
