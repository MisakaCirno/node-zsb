import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyInitialBoardSource,
  clearUrlCodeParameter,
  getInitialBoardSource,
} from '../../src/web/editorStartup.js'
import { PROJECT_FORMAT } from '../../src/web/project.js'

test('getInitialBoardSource prefers URL code over editor drafts', () => {
  const source = getInitialBoardSource({
    defaultCode: 'default-code',
    editorDraft: { name: 'saved' },
    search: '?code=url-code',
  })

  assert.equal(source.type, 'url-code')
  assert.equal(source.code, 'url-code')
  assert.ok(source.statusText)
})

test('getInitialBoardSource falls back to editor draft before default code', () => {
  const editorDraft = { name: 'saved' }
  const draftSource = getInitialBoardSource({
    defaultCode: 'default-code',
    editorDraft,
    search: '',
  })

  assert.equal(draftSource.type, 'editor-draft')
  assert.equal(draftSource.board, editorDraft)
  assert.ok(draftSource.statusText)

  const defaultSource = getInitialBoardSource({
    defaultCode: 'default-code',
    editorDraft: null,
    search: '',
  })

  assert.equal(defaultSource.type, 'default-code')
  assert.equal(defaultSource.code, 'default-code')
  assert.ok(defaultSource.statusText)
})

test('applyInitialBoardSource normalizes editor drafts and syncs controls', async () => {
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
      type: 'editor-draft',
    },
    state,
    syncBoardNameInput: () => calls.push('syncBoardNameInput'),
  })

  assert.equal(state.board.name, 'saved')
  assert.equal(state.board.boardBackground, 'checkered')
  assert.equal(state.board.objects[0].size, 100)
  assert.deepEqual(calls, ['syncBoardNameInput', 'renderBackgroundOptions'])
})

test('applyInitialBoardSource restores draft editor projects with layer groups', async () => {
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
      type: 'editor-draft',
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

test('clearUrlCodeParameter removes only the imported share code from the address', () => {
  const previousWindow = globalThis.window
  const calls = []
  globalThis.window = {
    history: {
      state: { keep: true },
      replaceState: (...args) => calls.push(args),
    },
    location: {
      href: 'http://localhost:3000/editor?code=share-code&tab=objects#canvas',
      search: '?code=share-code&tab=objects',
    },
  }

  try {
    clearUrlCodeParameter()
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = previousWindow
    }
  }

  assert.deepEqual(calls, [[{ keep: true }, '', '/editor?tab=objects#canvas']])
})
