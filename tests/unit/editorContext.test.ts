import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorContext } from '../../src/web/editorContext.js'
import { createEditorState } from '../../src/web/editorState.js'

test('createEditorContext selects, deselects, and reads the current object', () => {
  const state = createEditorState()
  state.board.objects = [
    { type: 'tank', x: 1, y: 2 },
    { type: 'text', x: 3, y: 4 },
  ]
  state.selectedGroupId = 'grp_1'
  state.revealSelectedLayer = true
  const statuses: string[] = []
  let renderCount = 0
  const context = createEditorContext({
    state,
    renderAll: () => {
      renderCount += 1
    },
    showStatus: (message) => statuses.push(message),
  })

  context.selectObject(1)
  assert.equal(state.selectedIndex, 1)
  assert.equal(context.getSelected(), state.board.objects[1])
  assert.equal(renderCount, 1)

  context.deselect()
  assert.equal(state.selectedIndex, -1)
  assert.equal(state.selectedGroupId, '')
  assert.equal(state.revealSelectedLayer, false)
  assert.equal(context.getSelected(), undefined)
  assert.equal(renderCount, 2)
  assert.deepEqual(statuses, ['已取消选择'])
})

test('createEditorContext normalizes coordinates with the snap toggle', () => {
  const state = createEditorState()
  const context = createEditorContext({
    state,
    renderAll: () => {},
    showStatus: () => {},
  })

  assert.deepEqual(context.normalizePoint(263, 199), { x: 263, y: 199 })
  assert.equal(context.normalizeCoordinate(263, 0, 512), 263)

  state.snapToGrid = true
  assert.deepEqual(context.normalizePoint(263, 199), { x: 256, y: 192 })
  assert.equal(context.normalizeCoordinate(263, 0, 512), 256)

  state.gridSize = 8
  assert.deepEqual(context.normalizePoint(263, 199), { x: 264, y: 200 })
  assert.equal(context.normalizeCoordinate(263, 0, 512), 264)
})

test('createEditorContext range-selects objects from the primary selection', () => {
  const state = createEditorState()
  state.board.objects = [
    { type: 'tank', x: 0, y: 0 },
    { type: 'healer', x: 0, y: 0 },
    { type: 'dps', x: 0, y: 0 },
    { type: 'text', x: 0, y: 0 },
  ]
  const context = createEditorContext({
    state,
    renderAll: () => {},
    showStatus: () => {},
  })

  context.selectObject(1)
  context.selectObject(3, { range: true })

  assert.deepEqual(state.selectedIndexes, [1, 2, 3])
  assert.equal(state.selectedIndex, 3)
})

test('createEditorContext skips locked objects when selecting', () => {
  const state = createEditorState()
  state.board.objects = [
    { type: 'tank', x: 0, y: 0 },
    { type: 'healer', x: 0, y: 0, locked: true },
    { type: 'dps', x: 0, y: 0 },
  ]
  const context = createEditorContext({
    state,
    renderAll: () => {},
    showStatus: () => {},
  })

  context.selectObject(1)
  assert.deepEqual(state.selectedIndexes, [])
  assert.equal(state.selectedIndex, -1)

  context.selectObject(0)
  context.selectObject(2, { range: true })
  assert.deepEqual(state.selectedIndexes, [0, 2])
  assert.equal(state.selectedIndex, 2)
})
