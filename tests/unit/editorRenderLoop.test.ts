import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorRenderLoop } from '../../src/web/editorRenderLoop.js'
import { createEditorState } from '../../src/web/editorState.js'

type RenderLoopDeps = Parameters<typeof createEditorRenderLoop>[0]

interface FakeElement {
  children: unknown[]
  classList: {
    toggle(): void
  }
  innerHTML: string
  textContent: string
  append(child: unknown): void
}

test('createEditorRenderLoop serializes overlapping render requests', async () => {
  const restoreGlobals = installBrowserMocks()
  try {
    let releaseFirstBoard: () => void = () => {
      throw new Error('First board render was not queued')
    }
    let boardRenderCount = 0
    let objectRenderCount = 0
    const stageRenderer: RenderLoopDeps['stageRenderer'] = {
      async renderBoard() {
        boardRenderCount += 1
        if (boardRenderCount === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstBoard = resolve
          })
        }
      },
      renderGrid() {},
      async renderObjects() {
        objectRenderCount += 1
      },
    }
    const state = createEditorState()
    state.board.name = 'queued'
    state.currentFileName = 'queued-file'
    const loop = createEditorRenderLoop({
      elements: createElements(),
      onMoveLayerNodeAfter: () => {},
      onMoveLayerNodeBefore: () => {},
      onMoveLayerNodeIntoGroup: () => {},
      onMoveLayerNodeToRoot: () => {},
      onRenameLayerGroup: () => {},
      onReorderLayer: () => {},
      onSelectGroup: () => {},
      onSelectObject: () => {},
      onToggleLayerGroup: () => {},
      onToggleLayerGroupFlag: () => {},
      onToggleLayerFlag: () => {},
      renderInspectorPanel: () => {},
      stageRenderer,
      state,
    })

    const firstRender = loop.renderAll()
    const secondRender = loop.renderAll()
    assert.equal(firstRender, secondRender)
    assert.equal(boardRenderCount, 1)
    const writes = (globalThis as typeof globalThis & { localStorageWrites: Array<{ value: string }> }).localStorageWrites
    assert.equal(writes.length, 1)
    const immediateDraft = JSON.parse(writes.at(-1)?.value ?? '{}')
    assert.equal(immediateDraft.project.board.name, 'queued')

    releaseFirstBoard()
    await secondRender

    assert.equal(boardRenderCount, 2)
    assert.equal(objectRenderCount, 2)
    assert.equal(writes.length, 1)
    const saved = JSON.parse(writes.at(-1)?.value ?? '{}')
    assert.equal(saved.format, 'node-zsb-editor-draft')
    assert.equal(saved.project.fileName, 'queued-file')

    await loop.renderAll()
    assert.equal(writes.length, 1)

    state.board.name = 'changed'
    await loop.renderAll()
    assert.equal(writes.length, 2)
    const updated = JSON.parse(writes.at(-1)?.value ?? '{}')
    assert.equal(updated.project.board.name, 'changed')

    state.currentFileName = ''
    state.board.name = 'unsaved draft'
    await loop.renderAll()
    assert.equal(writes.length, 3)
    const draft = JSON.parse(writes.at(-1)?.value ?? '{}')
    assert.equal(draft.format, 'node-zsb-editor-draft')
    assert.equal(draft.project.fileName, '')
    assert.equal(draft.project.board.name, 'unsaved draft')
  } finally {
    restoreGlobals()
  }
})

function createElements(): RenderLoopDeps['elements'] {
  return {
    fileDirtyIndicator: Object.assign(document.createElement('span'), { hidden: true }),
    layers: document.createElement('div'),
    layerCount: document.createElement('span'),
  }
}

function createElement(): FakeElement {
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
  interface FakeDocument {
    createElement(tagName: string): FakeElement
  }

  interface FakeWindow {
    localStorage: {
      setItem(key: string, value: string): void
    }
  }

  const globals = globalThis as {
    document?: FakeDocument
    localStorageWrites?: Array<{ key: string, value: string }>
    window?: FakeWindow
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
  globals.document = document
  globals.window = window
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
