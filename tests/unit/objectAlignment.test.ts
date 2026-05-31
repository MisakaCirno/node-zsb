import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorState } from '../../src/web/editorState.js'
import { getObjectBounds } from '../../src/web/objectAlignment.js'

const state = createEditorState()
state.iconConfigs = {
  enemy: {
    src: 'enemy',
    crop: { x: 0, y: 0, width: 32, height: 32 },
    size: 32,
  },
}

test('getObjectBounds accounts for rotated rectangular aoe dimensions', () => {
  const bounds = getObjectBounds({
    type: 'line_aoe',
    x: 100,
    y: 120,
    width: 120,
    height: 40,
    angle: 90,
  }, state)

  assert.deepEqual(roundBounds(bounds), {
    left: 80,
    right: 120,
    top: 60,
    bottom: 180,
  })
})

test('getObjectBounds accounts for rotated icon bounds', () => {
  const bounds = getObjectBounds({
    type: 'enemy',
    x: 200,
    y: 160,
    angle: 45,
  }, state)

  assert.equal(Math.round(bounds.right - bounds.left), 45)
  assert.equal(Math.round(bounds.bottom - bounds.top), 45)
  assert.equal(Math.round((bounds.left + bounds.right) / 2), 200)
  assert.equal(Math.round((bounds.top + bounds.bottom) / 2), 160)
})

test('getObjectBounds uses the visible fan sector instead of the full circle', () => {
  const bounds = getObjectBounds({
    type: 'fan_aoe',
    x: 256,
    y: 192,
    size: 100,
    arcAngle: 90,
  }, state)

  assert.deepEqual(roundBounds(bounds), {
    left: 128,
    right: 384,
    top: 64,
    bottom: 320,
  })
})

test('getObjectBounds expands line bounds by stroke width', () => {
  const bounds = getObjectBounds({
    type: 'line',
    x: 10,
    y: 20,
    endX: 110,
    endY: 20,
    height: 12,
  }, state)

  assert.deepEqual(roundBounds(bounds), {
    left: 4,
    right: 116,
    top: 14,
    bottom: 26,
  })
})

function roundBounds(bounds: { left: number, right: number, top: number, bottom: number }) {
  return {
    left: Math.round(bounds.left),
    right: Math.round(bounds.right),
    top: Math.round(bounds.top),
    bottom: Math.round(bounds.bottom),
  }
}
