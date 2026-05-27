import assert from 'node:assert/strict'
import test from 'node:test'

import { createObjectCommands } from '../../src/web/objectCommands.js'

test('object commands do not record history for rejected layer mutations', () => {
  const state = createCommandState()
  const before = JSON.stringify(state.layerTree)
  let historyCount = 0
  let renderCount = 0
  const commands = createObjectCommands({
    state,
    recordHistory: () => {
      historyCount += 1
    },
    renderAll: () => {
      renderCount += 1
    },
    selectObject: () => {},
    getSelected: () => undefined,
    getSelectedList: () => [],
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.moveLayerNodeIntoGroup({ type: 'group', id: 'grp_outer' }, 'grp_inner')
  commands.renameLayerGroup('grp_outer', '')

  assert.equal(historyCount, 0)
  assert.equal(renderCount, 0)
  assert.equal(JSON.stringify(state.layerTree), before)
})

test('object commands record history once for accepted layer mutations', () => {
  const state = createCommandState()
  let historyCount = 0
  let renderCount = 0
  const commands = createObjectCommands({
    state,
    recordHistory: () => {
      historyCount += 1
    },
    renderAll: () => {
      renderCount += 1
    },
    selectObject: () => {},
    getSelected: () => undefined,
    getSelectedList: () => [],
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.moveLayerNodeToRoot({ type: 'group', id: 'grp_inner' })

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.deepEqual(state.layerTree.map((node) => node.id), ['grp_outer', 'grp_inner'])
})

test('object commands record history when grouping selected objects', () => {
  const state = createCommandState()
  state.selectedIndex = 1
  state.selectedIndexes = [0, 1]
  let historyCount = 0
  let renderCount = 0
  const commands = createObjectCommands({
    state,
    recordHistory: () => {
      historyCount += 1
    },
    renderAll: () => {
      renderCount += 1
    },
    selectObject: () => {},
    getSelected: () => undefined,
    getSelectedList: () => [],
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.groupSelected()

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.equal(state.layerTree[0].type, 'group')
  assert.equal(state.selectedGroupId, state.layerTree[0].id)
})

test('object commands toggle layer flags for the full selection', () => {
  const state = createCommandState()
  state.selectedIndex = 1
  state.selectedIndexes = [0, 1]
  let historyCount = 0
  let renderCount = 0
  const commands = createObjectCommands({
    state,
    recordHistory: () => {
      historyCount += 1
    },
    renderAll: () => {
      renderCount += 1
    },
    selectObject: () => {},
    getSelected: () => state.board.objects[state.selectedIndex],
    getSelectedList: () => state.selectedIndexes.map((index) => state.board.objects[index]),
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.toggleSelectedLayerFlag('hidden')

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.equal(state.board.objects[0].hidden, true)
  assert.equal(state.board.objects[1].hidden, true)
})

test('object commands nudge the full selection with one constrained delta', () => {
  const state = createCommandState()
  state.selectedIndex = 1
  state.selectedIndexes = [0, 1]
  state.board.objects[0].x = 20
  state.board.objects[1].x = 480
  let historyCount = 0
  let renderCount = 0
  const commands = createObjectCommands({
    state,
    recordHistory: () => {
      historyCount += 1
    },
    renderAll: () => {
      renderCount += 1
    },
    selectObject: () => {},
    getSelected: () => state.board.objects[state.selectedIndex],
    getSelectedList: () => state.selectedIndexes.map((index) => state.board.objects[index]),
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.nudgeSelected('ArrowRight', 20)

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.equal(state.board.objects[0].x, 36)
  assert.equal(state.board.objects[1].x, 496)
})

function createCommandState() {
  return {
    board: {
      name: '',
      boardBackground: 'checkered',
      objects: [
        { type: 'tank', x: 1, y: 2, editorId: 'obj_a' },
        { type: 'healer', x: 3, y: 4, editorId: 'obj_b' },
      ],
    },
    selectedGroupId: '',
    selectedIndex: -1,
    selectedIndexes: [],
    iconConfigs: {},
    layerTree: [
      {
        type: 'group',
        id: 'grp_outer',
        name: 'Outer',
        children: [
          {
            type: 'group',
            id: 'grp_inner',
            name: 'Inner',
            children: [
              { type: 'object', id: 'obj_a' },
            ],
          },
          { type: 'object', id: 'obj_b' },
        ],
      },
    ],
  }
}
