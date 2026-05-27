import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyInitialBoardSource,
  getInitialBoardSource,
} from '../../src/web/editorStartup.js'
import { PROJECT_FORMAT } from '../../src/web/project.js'

test('getInitialBoardSource prefers URL code over saved boards', () => {
  const source = getInitialBoardSource({
    defaultCode: 'default-code',
    savedBoard: { name: 'saved' },
    search: '?code=url-code',
  })

  assert.deepEqual(source, {
    code: 'url-code',
    statusText: '已从链接导入战术板',
    type: 'url-code',
  })
})

test('getInitialBoardSource falls back to saved board before default code', () => {
  const savedBoard = { name: 'saved' }
  assert.deepEqual(
    getInitialBoardSource({
      defaultCode: 'default-code',
      savedBoard,
      search: '',
    }),
    {
      board: savedBoard,
      statusText: '编辑器已就绪',
      type: 'saved-board',
    },
  )
  assert.deepEqual(
    getInitialBoardSource({
      defaultCode: 'default-code',
      savedBoard: null,
      search: '',
    }),
    {
      code: 'default-code',
      statusText: '编辑器已就绪',
      type: 'default-code',
    },
  )
})

test('applyInitialBoardSource normalizes saved boards and syncs controls', async () => {
  const calls = []
  const state = {
    board: null,
  }

  await applyInitialBoardSource({
    elements: { codeInput: { value: '' } },
    loadFromCode: async () => calls.push('loadFromCode'),
    renderBackgroundOptions: () => calls.push('renderBackgroundOptions'),
    source: {
      board: {
        name: 'saved',
        objects: [{ type: 'tank', x: 1, y: 2 }],
      },
      type: 'saved-board',
    },
    state,
    syncBoardNameInput: () => calls.push('syncBoardNameInput'),
  })

  assert.equal(state.board.name, 'saved')
  assert.equal(state.board.boardBackground, 'checkered')
  assert.equal(state.board.objects[0].size, 100)
  assert.deepEqual(calls, ['syncBoardNameInput', 'renderBackgroundOptions'])
})

test('applyInitialBoardSource restores saved editor projects with layer groups', async () => {
  const calls = []
  const state = {
    board: null,
    layerTree: [],
  }

  await applyInitialBoardSource({
    elements: { codeInput: { value: '' } },
    loadFromCode: async () => calls.push('loadFromCode'),
    renderBackgroundOptions: () => calls.push('renderBackgroundOptions'),
    source: {
      board: {
        format: PROJECT_FORMAT,
        version: 1,
        fileName: 'grouped',
        board: {
          name: 'saved project',
          boardBackground: 'checkered',
        },
        objects: {
          obj_a: { type: 'tank', x: 1, y: 2 },
          obj_b: { type: 'healer', x: 3, y: 4 },
        },
        layers: [
          {
            type: 'group',
            id: 'grp_1',
            name: 'Persist Group',
            children: [
              { type: 'object', id: 'obj_b' },
              { type: 'object', id: 'obj_a' },
            ],
          },
        ],
      },
      type: 'saved-board',
    },
    state,
    syncBoardNameInput: () => calls.push('syncBoardNameInput'),
  })

  assert.equal(state.board.name, 'saved project')
  assert.deepEqual(
    state.board.objects.map((object) => object.editorId),
    ['obj_b', 'obj_a'],
  )
  assert.equal(state.layerTree[0].type, 'group')
  assert.equal(state.layerTree[0].name, 'Persist Group')
  assert.deepEqual(calls, ['syncBoardNameInput', 'renderBackgroundOptions'])
})

test('applyInitialBoardSource imports code sources without recording history', async () => {
  const calls = []
  const elements = { codeInput: { value: '' } }

  await applyInitialBoardSource({
    elements,
    loadFromCode: async (...args) => calls.push(args),
    renderBackgroundOptions: () => {},
    source: {
      code: 'share-code',
      type: 'default-code',
    },
    state: {},
    syncBoardNameInput: () => {},
  })

  assert.equal(elements.codeInput.value, 'share-code')
  assert.deepEqual(calls, [['share-code', { record: false }]])
})
