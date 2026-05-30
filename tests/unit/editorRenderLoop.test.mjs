import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorRenderLoop } from '../../src/web/editorRenderLoop.js'

test('createEditorRenderLoop serializes overlapping render requests', async () => {
  const restoreGlobals = installBrowserMocks()
  try {
    let releaseFirstBoard
    let boardRenderCount = 0
    let objectRenderCount = 0
    const stageRenderer = {
      async renderBoard() {
        boardRenderCount += 1
        if (boardRenderCount === 1) {
          await new Promise((resolve) => {
            releaseFirstBoard = resolve
          })
        }
      },
      renderGrid() {},
      async renderObjects() {
        objectRenderCount += 1
      },
    }
    const state = {
      board: {
        name: 'queued',
        boardBackground: 'checkered',
        objects: [],
      },
      currentFileName: 'queued-file',
      layerTree: [],
      selectedIndex: -1,
    }
    const loop = createEditorRenderLoop({
      elements: createElements(),
      onSelectObject: () => {},
      onToggleLayerFlag: () => {},
      renderInspectorPanel: () => {},
      stageRenderer,
      state,
    })

    const firstRender = loop.renderAll()
    const secondRender = loop.renderAll()
    assert.equal(firstRender, secondRender)
    assert.equal(boardRenderCount, 1)

    releaseFirstBoard()
    await secondRender

    assert.equal(boardRenderCount, 2)
    assert.equal(objectRenderCount, 2)
    assert.equal(globalThis.localStorageWrites.length, 1)
    const saved = JSON.parse(globalThis.localStorageWrites.at(-1).value)
    assert.equal(saved.format, 'node-zsb-project')
    assert.equal(saved.fileName, 'queued-file')

    await loop.renderAll()
    assert.equal(globalThis.localStorageWrites.length, 1)

    state.board.name = 'changed'
    await loop.renderAll()
    assert.equal(globalThis.localStorageWrites.length, 2)
    const updated = JSON.parse(globalThis.localStorageWrites.at(-1).value)
    assert.equal(updated.board.name, 'changed')

    state.currentFileName = ''
    state.board.name = 'unsaved draft'
    await loop.renderAll()
    assert.equal(globalThis.localStorageWrites.length, 3)
    const draft = JSON.parse(globalThis.localStorageWrites.at(-1).value)
    assert.equal(draft.format, 'node-zsb-project')
    assert.equal(draft.fileName, '')
    assert.equal(draft.board.name, 'unsaved draft')
  } finally {
    restoreGlobals()
  }
})

function createElements() {
  return {
    layers: createElement(),
    layerCount: createElement(),
  }
}

function createElement() {
  return {
    children: [],
    classList: {
      toggle() {},
    },
    innerHTML: '',
    textContent: '',
    append(child) {
      this.children.push(child)
    },
  }
}

function installBrowserMocks() {
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const writes = []
  const document = {
    createElement,
  }
  const window = {
    localStorage: {
      setItem(key, value) {
        writes.push({ key, value })
      },
    },
  }
  globalThis.document = document
  globalThis.window = window
  globalThis.localStorageWrites = writes

  return () => {
    if (previousDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = previousDocument
    }
    if (previousWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = previousWindow
    }
    delete globalThis.localStorageWrites
  }
}
