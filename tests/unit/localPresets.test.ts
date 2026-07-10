import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_BOARD_OBJECTS, MAX_LOCAL_PRESETS } from '../../src/web/constants.js'
import { createEditorState } from '../../src/web/editorState.js'
import {
  insertPresetIntoBoard,
  prependLocalPreset,
} from '../../src/web/localPresets.js'
import type {
  BoardObject,
  EditorState,
  LocalLayerPreset,
} from '../../src/web/types.js'

test('insertPresetIntoBoard keeps preset objects together when inserted near an edge', () => {
  const state = createState()
  const preset = createTwoObjectPreset()

  const result = insertPresetIntoBoard(state, preset, { point: { x: 0, y: 100 } })

  assert.equal(result?.objectCount, 2)
  assert.equal(state.board.objects.length, 2)
  assert.equal(state.board.objects[1]!.x - state.board.objects[0]!.x, 100)
  assert.equal(state.board.objects[0]!.x, 16)
  assert.equal(state.board.objects[1]!.x, 116)
  assert.deepEqual(state.selectedIndexes, [0, 1])
})

test('insertPresetIntoBoard applies inherited group flags and avoids selecting locked objects', () => {
  const state = createState()
  const preset = createTwoObjectPreset()
  preset.layers = [
    {
      type: 'group',
      id: 'source_group',
      name: 'Locked preset',
      hidden: true,
      locked: true,
      children: preset.layers,
    },
  ]

  const result = insertPresetIntoBoard(state, preset, { point: { x: 256, y: 192 } })

  assert.equal(result?.objectCount, 2)
  assert.deepEqual(result?.indexes, [0, 1])
  assert.equal(result?.groupId, '')
  assert.equal(state.board.objects[0]!.hidden, true)
  assert.equal(state.board.objects[0]!.locked, true)
  assert.equal(state.board.objects[1]!.hidden, true)
  assert.equal(state.board.objects[1]!.locked, true)
  assert.deepEqual(state.selectedIndexes, [])
  assert.equal(state.selectedIndex, -1)
  assert.equal(state.selectedGroupId, '')
})

test('insertPresetIntoBoard rejects presets that would exceed the board object limit', () => {
  const existingObjects = Array.from({ length: MAX_BOARD_OBJECTS - 1 }, (_, index) => ({
    editorId: `existing_${index}`,
    type: 'tank',
    x: 32,
    y: 32,
  }))
  const state = createState(existingObjects)
  state.layerTree = existingObjects.map((object) => ({ type: 'object', id: object.editorId }))

  const result = insertPresetIntoBoard(state, createTwoObjectPreset(), { point: { x: 256, y: 192 } })

  assert.equal(result, null)
  assert.equal(state.board.objects.length, MAX_BOARD_OBJECTS - 1)
})

test('insertPresetIntoBoard sanitizes stale preset objects before insertion', () => {
  const state = createState()
  const preset: LocalLayerPreset = {
    id: 'preset_dirty',
    name: 'dirty',
    objects: {
      text_a: {
        type: 'text',
        x: 40,
        y: 50,
        size: 200,
        angle: 45,
        text: 'label',
      },
      tank_a: {
        type: 'tank',
        x: 80,
        y: 50,
        size: 20,
        color: '#ff0000',
      },
      line_aoe_a: {
        type: 'line_aoe',
        x: 120,
        y: 50,
        width: 999,
        height: 1,
        transparency: 120,
      },
    },
    layers: [
      { type: 'object', id: 'text_a' },
      { type: 'object', id: 'tank_a' },
      { type: 'object', id: 'line_aoe_a' },
    ],
    objectCount: 3,
    contentHash: 'hash',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  insertPresetIntoBoard(state, preset, { point: { x: 256, y: 192 } })

  const text = state.board.objects[0]!
  const tank = state.board.objects[1]!
  const lineAoe = state.board.objects[2]!
  assert.equal(text.type, 'text')
  assert.equal(text.size, undefined)
  assert.equal(text.angle, undefined)
  assert.equal(tank.size, 50)
  assert.equal(tank.color, undefined)
  assert.equal(lineAoe.width, 512)
  assert.equal(lineAoe.height, 16)
  assert.equal(lineAoe.transparency, 100)
})

test('prependLocalPreset rejects new presets at the limit without dropping old data', () => {
  const presets = Array.from({ length: MAX_LOCAL_PRESETS }, (_, index) => ({
    ...createTwoObjectPreset(),
    id: `preset_${index}`,
    name: `预设 ${index}`,
  }))
  const nextPreset = {
    ...createTwoObjectPreset(),
    id: 'preset_new',
    name: '新预设',
  }

  assert.equal(prependLocalPreset(presets, nextPreset), null)
  assert.equal(presets.length, MAX_LOCAL_PRESETS)
  assert.equal(presets[0]?.id, 'preset_0')
  assert.equal(presets.at(-1)?.id, `preset_${MAX_LOCAL_PRESETS - 1}`)
})

test('prependLocalPreset still allows replacing an existing preset at the limit', () => {
  const presets = Array.from({ length: MAX_LOCAL_PRESETS }, (_, index) => ({
    ...createTwoObjectPreset(),
    id: `preset_${index}`,
    name: `预设 ${index}`,
  }))
  const replacement = {
    ...presets[10]!,
    name: '已更新预设',
  }

  const result = prependLocalPreset(presets, replacement)

  assert.equal(result?.length, MAX_LOCAL_PRESETS)
  assert.equal(result?.[0]?.name, '已更新预设')
  assert.equal(result?.filter((preset) => preset.id === replacement.id).length, 1)
})

function createState(objects: BoardObject[] = []): EditorState {
  const state = createEditorState()
  state.board.objects = objects
  return state
}

function createTwoObjectPreset(): LocalLayerPreset {
  return {
    id: 'preset_1',
    name: '边缘测试',
    objects: {
      source_a: {
        type: 'tank',
        x: 10,
        y: 100,
      },
      source_b: {
        type: 'tank',
        x: 110,
        y: 100,
      },
    },
    layers: [
      { type: 'object', id: 'source_a' },
      { type: 'object', id: 'source_b' },
    ],
    objectCount: 2,
    contentHash: 'hash',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
