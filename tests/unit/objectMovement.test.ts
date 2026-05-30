import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getConstrainedObjectsMoveDelta,
  getConstrainedMoveDelta,
  moveObjectBy,
  moveObjectsBy,
} from '../../src/web/objectMovement.js'
import type { EditorState } from '../../src/web/types.js'

const state = {
  iconConfigs: {
    tank: {
      src: 'tank',
      crop: { x: 0, y: 0, width: 32, height: 32 },
      size: 32,
    },
  },
} as unknown as EditorState

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

test('getConstrainedObjectsMoveDelta uses object bounds instead of only centers', () => {
  assert.deepEqual(
    getConstrainedObjectsMoveDelta([
      { type: 'tank', x: 500, y: 192, size: 100 },
    ], state, 20, 0),
    { dx: -4, dy: 0 },
  )
})

test('moveObjectsBy moves a selection with line endpoints in one batch', () => {
  const objects = [
    { type: 'tank', x: 100, y: 120 },
    { type: 'line', x: 20, y: 30, endX: 80, endY: 90 },
  ]

  moveObjectsBy(objects, 8, -4)

  assert.deepEqual(objects, [
    { type: 'tank', x: 108, y: 116 },
    { type: 'line', x: 28, y: 26, endX: 88, endY: 86 },
  ])
})
