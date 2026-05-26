import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorActionRegistry } from '../../src/web/editorActionRegistry.js'

test('createEditorActionRegistry exposes the event binding action surface', () => {
  const handlers = Object.fromEntries(
    [
      'applyFitZoom',
      'applyFitZoomOnResize',
      'alignSelected',
      'centerSelected',
      'clearBoard',
      'copySelected',
      'deleteLocalBoard',
      'deleteSelected',
      'deselect',
      'duplicateSelected',
      'exportCode',
      'loadFromCode',
      'loadLocalBoard',
      'moveSelected',
      'nudgeSelected',
      'onBackgroundChange',
      'onBoardNameChange',
      'pasteObject',
      'redo',
      'renderPreview',
      'saveLocalBoard',
      'selectObject',
      'setStageZoom',
      'stepZoom',
      'toggleGrid',
      'toggleLayerFlagForSelection',
      'toggleSnapToGrid',
      'undo',
      'updateLocalBoardButtons',
      'updateSelectedFromInspector',
    ].map((name) => [name, () => name]),
  )

  const actions = createEditorActionRegistry({
    boardCodeActions: {
      exportCode: handlers.exportCode,
      loadFromCode: handlers.loadFromCode,
      renderPreview: handlers.renderPreview,
    },
    boardMetaControls: {
      onBackgroundChange: handlers.onBackgroundChange,
      onBoardNameChange: handlers.onBoardNameChange,
    },
    editorContext: {
      deselect: handlers.deselect,
      selectObject: handlers.selectObject,
    },
    historyControls: {
      redo: handlers.redo,
      undo: handlers.undo,
    },
    inspectorControls: {
      updateSelectedFromInspector: handlers.updateSelectedFromInspector,
    },
    localBoardsPanel: {
      deleteLocalBoard: handlers.deleteLocalBoard,
      loadLocalBoard: handlers.loadLocalBoard,
      saveLocalBoard: handlers.saveLocalBoard,
      updateLocalBoardButtons: handlers.updateLocalBoardButtons,
    },
    objectCommands: {
      alignSelected: handlers.alignSelected,
      centerSelected: handlers.centerSelected,
      clearBoard: handlers.clearBoard,
      copySelected: handlers.copySelected,
      deleteSelected: handlers.deleteSelected,
      duplicateSelected: handlers.duplicateSelected,
      moveSelected: handlers.moveSelected,
      nudgeSelected: handlers.nudgeSelected,
      pasteObject: handlers.pasteObject,
      toggleSelectedLayerFlag: handlers.toggleLayerFlagForSelection,
    },
    viewportControls: {
      applyFitZoom: handlers.applyFitZoom,
      applyFitZoomOnResize: handlers.applyFitZoomOnResize,
      setStageZoom: handlers.setStageZoom,
      stepZoom: handlers.stepZoom,
      toggleGrid: handlers.toggleGrid,
      toggleSnapToGrid: handlers.toggleSnapToGrid,
    },
  })

  assert.deepEqual(Object.keys(actions).sort(), Object.keys(handlers).sort())
  for (const [name, handler] of Object.entries(handlers)) {
    assert.equal(actions[name], handler)
  }
})
