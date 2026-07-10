import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorFeedback } from '../../src/web/editorFeedback.ts'
import { createEditorState } from '../../src/web/editorState.ts'

test('runAction suppresses success for false results and handles async errors', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      setTimeout() {
        return 1
      },
    },
  })
  const classes = new Set<string>()
  const button = () => ({
    disabled: false,
    setAttribute() {},
  })
  const status = {
    textContent: '',
    classList: {
      add(name: string) {
        classes.add(name)
      },
      remove(name: string) {
        classes.delete(name)
      },
      toggle(name: string, force?: boolean) {
        const enabled = force ?? !classes.has(name)
        if (enabled) classes.add(name)
        else classes.delete(name)
      },
    },
  }
  const elements = {
    status,
    loadCode: button(),
    importProjectFile: button(),
    openExportCodeDialog: button(),
    exportProjectFile: button(),
    openExportImageDialog: button(),
    copyExportCode: button(),
    copyExportImage: button(),
    downloadPreviewImage: button(),
    quickSaveLocalBoard: button(),
    quickSaveAsLocalBoard: button(),
    quickOpenImportDialog: button(),
    quickOpenExportCodeDialog: button(),
    quickOpenExportImageDialog: button(),
    savePreset: button(),
    savePresetFromLayers: button(),
    toolSavePreset: button(),
    boardName: button(),
    fileName: button(),
    newLocalBoard: button(),
    saveLocalBoard: button(),
    saveAsLocalBoard: button(),
    openLocalBoardDialog: button(),
    manageLocalBoards: button(),
    deleteSelectedLocalBoards: button(),
    background: {
      querySelectorAll<E extends Element = Element>() {
        return [] as unknown as NodeListOf<E>
      },
    },
    fileMenuButton: button(),
    editMenuButton: button(),
  }
  const feedback = createEditorFeedback({
    state: createEditorState(),
    getElements: () => elements,
  })
  const originalError = console.error
  console.error = () => {}
  try {
    await feedback.runAction(async () => false, '不应出现', {
      busyMessage: '处理中',
    })
    assert.equal(status.textContent, '')
    assert.equal(classes.has('visible'), false)

    await feedback.runAction(async () => true, '已完成')
    assert.equal(status.textContent, '已完成')

    await feedback.runAction(async () => {
      throw new Error('异步失败')
    }, '不应出现')
    assert.equal(status.textContent, '异步失败')
    assert.equal(classes.has('error'), true)
  } finally {
    console.error = originalError
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      delete (globalThis as { window?: unknown }).window
    }
  }
})
