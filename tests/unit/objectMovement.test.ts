import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getConstrainedObjectsMoveDelta,
  getConstrainedMoveDelta,
  moveObjectBy,
  moveObjectsBy,
} from '../../src/web/objectMovement.js'
import { createEditorState } from '../../src/web/editorState.js'

const state = createEditorState()
state.iconConfigs = {
  tank: {
    src: 'tank',
    crop: { x: 0, y: 0, width: 32, height: 32 },
    size: 32,
  },
}

test('moveObjectBy keeps line endpoints in sync with the object origin', () => {
  const object = {
    type: 'line',
    x: 20.2,
    y: 30.3,
    endX: 80.4,
    endY: 90.5,
  }

  moveObjectBy(object, 12.26, -8.18)

  assert.deepEqual(object, {
    type: 'line',
    x: 32.5,
    y: 22.1,
    endX: 92.7,
    endY: 82.3,
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

test('getConstrainedObjectsMoveDelta clamps object centers instead of visual bounds', () => {
  assert.deepEqual(
    getConstrainedObjectsMoveDelta([
      { type: 'circle_aoe', x: 256, y: 128, size: 200 },
    ], state, -300, 300),
    { dx: -256, dy: 256 },
  )
})

test('getConstrainedObjectsMoveDelta also keeps line endpoints on the board', () => {
  assert.deepEqual(
    getConstrainedObjectsMoveDelta([
      { type: 'line', x: 500, y: 100, endX: 512, endY: 120 },
    ], state, 20, 0),
    { dx: 0, dy: 0 },
  )
})

test('moveObjectsBy moves a selection with line endpoints in one batch', () => {
  const objects = [
    { type: 'tank', x: 100.2, y: 120.3 },
    { type: 'line', x: 20.2, y: 30.3, endX: 80.4, endY: 90.5 },
  ]

  moveObjectsBy(objects, 8.25, -4.15)

  assert.deepEqual(objects, [
    { type: 'tank', x: 108.5, y: 116.2 },
    { type: 'line', x: 28.5, y: 26.2, endX: 88.7, endY: 86.4 },
  ])
})
