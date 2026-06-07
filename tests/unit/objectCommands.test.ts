import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_BOARD_OBJECTS } from '../../src/web/constants.js'
import { createEditorState } from '../../src/web/editorState.js'
import { createObjectCommands } from '../../src/web/objectCommands.js'
import type { BoardObject, EditorState } from '../../src/web/types.js'

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
  assert.equal(state.layerTree[0]!.type, 'group')
  assert.equal(state.selectedGroupId, state.layerTree[0]!.id)
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
    getSelectedList: () => getSelectedObjects(state),
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.toggleSelectedLayerFlag('hidden')

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.equal(state.board.objects[0]!.hidden, true)
  assert.equal(state.board.objects[1]!.hidden, true)
})

test('object commands clear selection when locking and never delete locked objects', () => {
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
    getSelectedList: () => getSelectedObjects(state),
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.toggleSelectedLayerFlag('locked')

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.equal(state.board.objects[0]!.locked, true)
  assert.equal(state.board.objects[1]!.locked, true)
  assert.deepEqual(state.selectedIndexes, [])
  assert.equal(state.selectedIndex, -1)

  state.selectedIndex = 1
  state.selectedIndexes = [0, 1]
  commands.deleteSelected()

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.equal(state.board.objects.length, 2)
})

test('object commands do not reselect locked layers when toggling visibility', () => {
  const state = createCommandState()
  state.board.objects[1]!.locked = true
  state.selectedIndex = 0
  state.selectedIndexes = [0]
  let renderCount = 0
  const commands = createObjectCommands({
    state,
    recordHistory: () => {},
    renderAll: () => {
      renderCount += 1
    },
    selectObject: () => {},
    getSelected: () => state.board.objects[state.selectedIndex],
    getSelectedList: () => getSelectedObjects(state),
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.toggleLayerFlag(1, 'hidden')

  assert.equal(renderCount, 1)
  assert.equal(state.board.objects[1]!.hidden, true)
  assert.deepEqual(state.selectedIndexes, [0])
  assert.equal(state.selectedIndex, 0)
  assert.equal(state.selectedGroupId, '')
})

test('object commands reject layer moves for locked nodes and locked target groups', () => {
  const state = createCommandState()
  state.board.objects[0]!.locked = true
  const outerGroup = state.layerTree[0]
  if (outerGroup?.type !== 'group') throw new Error('Expected outer group')
  outerGroup.locked = true
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

  commands.moveLayerNodeToRoot({ type: 'object', id: 'obj_a' })
  commands.moveLayerNodeToRoot({ type: 'group', id: 'grp_inner' })
  commands.moveLayerNodeIntoGroup({ type: 'object', id: 'obj_b' }, 'grp_inner')

  assert.equal(historyCount, 0)
  assert.equal(renderCount, 0)
  assert.equal(JSON.stringify(state.layerTree), before)
})

test('object commands nudge the full selection with one center-constrained delta', () => {
  const state = createCommandState()
  state.selectedIndex = 1
  state.selectedIndexes = [0, 1]
  state.board.objects[0]!.x = 20
  state.board.objects[1]!.x = 480
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
    getSelectedList: () => getSelectedObjects(state),
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.nudgeSelected('ArrowRight', 20)

  assert.equal(historyCount, 1)
  assert.equal(renderCount, 1)
  assert.equal(state.board.objects[0]!.x, 40)
  assert.equal(state.board.objects[1]!.x, 500)
})

test('object commands preserve selection spacing when the group reaches the board edge', () => {
  const state = createCommandState()
  state.selectedIndex = 1
  state.selectedIndexes = [0, 1]
  state.board.objects[0]!.x = 20
  state.board.objects[1]!.x = 500
  const commands = createObjectCommands({
    state,
    recordHistory: () => {},
    renderAll: () => {},
    selectObject: () => {},
    getSelected: () => state.board.objects[state.selectedIndex],
    getSelectedList: () => getSelectedObjects(state),
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: () => {},
    confirmAction: () => true,
  })

  commands.nudgeSelected('ArrowRight', 20)

  assert.equal(state.board.objects[0]!.x, 32)
  assert.equal(state.board.objects[1]!.x, 512)
})

test('object commands reject additions when the board object limit is reached', () => {
  const state = createCommandState()
  state.board.objects = Array.from({ length: MAX_BOARD_OBJECTS }, (_, index) => ({
    type: 'tank',
    x: index,
    y: index,
    editorId: `obj_${index}`,
  }))
  state.layerTree = state.board.objects.map((object) => ({
    type: 'object',
    id: object.editorId!,
  }))
  state.selectedIndex = 0
  state.clipboard = { type: 'tank', x: 10, y: 10, editorId: 'clipboard' }
  let historyCount = 0
  let status = ''
  const commands = createObjectCommands({
    state,
    recordHistory: () => {
      historyCount += 1
    },
    renderAll: () => {},
    selectObject: () => {},
    getSelected: () => state.board.objects[state.selectedIndex],
    getSelectedList: () => [state.board.objects[state.selectedIndex]!],
    normalizePoint: (x, y) => ({ x, y }),
    showStatus: (message) => {
      status = message
    },
    confirmAction: () => true,
  })

  commands.addObject('tank')
  commands.duplicateSelected()
  commands.pasteObject()

  assert.equal(state.board.objects.length, MAX_BOARD_OBJECTS)
  assert.equal(historyCount, 0)
  assert.equal(status.includes(String(MAX_BOARD_OBJECTS)), true)
})

function createCommandState(): EditorState {
  const state = createEditorState()
  state.board.objects = [
    { type: 'tank', x: 1, y: 2, editorId: 'obj_a' },
    { type: 'healer', x: 3, y: 4, editorId: 'obj_b' },
  ]
  state.layerTree = [
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
  ]
  return state
}

function getSelectedObjects(state: EditorState): BoardObject[] {
  return state.selectedIndexes
    .map((index) => state.board.objects[index])
    .filter((object): object is BoardObject => Boolean(object))
}
