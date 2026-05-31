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
    } as any)

    const firstRender = loop.renderAll()
    const secondRender = loop.renderAll()
    assert.equal(firstRender, secondRender)
    assert.equal(boardRenderCount, 1)
    const writes = (globalThis as typeof globalThis & { localStorageWrites: Array<{ value: string }> }).localStorageWrites
    assert.equal(writes.length, 1)
    const immediateDraft = JSON.parse(writes.at(-1).value)
    assert.equal(immediateDraft.board.name, 'queued')

    releaseFirstBoard()
    await secondRender

    assert.equal(boardRenderCount, 2)
    assert.equal(objectRenderCount, 2)
    assert.equal(writes.length, 1)
    const saved = JSON.parse(writes.at(-1).value)
    assert.equal(saved.format, 'node-zsb-project')
    assert.equal(saved.fileName, 'queued-file')

    await loop.renderAll()
    assert.equal(writes.length, 1)

    state.board.name = 'changed'
    await loop.renderAll()
    assert.equal(writes.length, 2)
    const updated = JSON.parse(writes.at(-1).value)
    assert.equal(updated.board.name, 'changed')

    state.currentFileName = ''
    state.board.name = 'unsaved draft'
    await loop.renderAll()
    assert.equal(writes.length, 3)
    const draft = JSON.parse(writes.at(-1).value)
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
    append(child: unknown) {
      this.children.push(child)
    },
  }
}

function installBrowserMocks() {
  const globals = globalThis as typeof globalThis & {
    document?: Document
    localStorageWrites?: Array<{ key: string, value: string }>
    window?: any
  }
  const previousDocument = globals.document
  const previousWindow = globals.window
  const writes: Array<{ key: string, value: string }> = []
  const document = {
    createElement,
  }
  const window = {
    localStorage: {
      setItem(key: string, value: string) {
        writes.push({ key, value })
      },
    },
  }
  globals.document = document as unknown as Document
  globals.window = window as unknown as Window
  globals.localStorageWrites = writes

  return () => {
    if (previousDocument === undefined) {
      delete globals.document
    } else {
      globals.document = previousDocument
    }
    if (previousWindow === undefined) {
      delete globals.window
    } else {
      globals.window = previousWindow
    }
    delete globals.localStorageWrites
  }
}
