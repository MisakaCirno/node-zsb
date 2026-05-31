import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorContext } from '../../src/web/editorContext.js'

test('createEditorContext selects, deselects, and reads the current object', () => {
  const state = {
    board: {
      objects: [
        { type: 'tank', x: 1, y: 2 },
        { type: 'text', x: 3, y: 4 },
      ],
    },
    selectedIndex: -1,
    selectedGroupId: 'grp_1',
    revealSelectedLayer: true,
    snapToGrid: false,
    gridSize: 16,
  }
  const statuses = []
  let renderCount = 0
  const context = createEditorContext({
    state: state as any,
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
  const state = {
    board: { objects: [] },
    selectedIndex: -1,
    snapToGrid: false,
    gridSize: 16,
  }
  const context = createEditorContext({
    state: state as any,
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
  const state = {
    board: {
      objects: [
        { type: 'tank' },
        { type: 'healer' },
        { type: 'dps' },
        { type: 'text' },
      ],
    },
    selectedIndex: -1,
    selectedIndexes: [],
    snapToGrid: false,
    gridSize: 16,
  }
  const context = createEditorContext({
    state: state as any,
    renderAll: () => {},
    showStatus: () => {},
  })

  context.selectObject(1)
  context.selectObject(3, { range: true })

  assert.deepEqual(state.selectedIndexes, [1, 2, 3])
  assert.equal(state.selectedIndex, 3)
})
