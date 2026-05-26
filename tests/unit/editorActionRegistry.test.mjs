import assert from 'node:assert/strict'
import test from 'node:test'

import { createEditorActionRegistry } from '../../src/web/editorActionRegistry.js'

test('createEditorActionRegistry exposes the event binding action surface', () => {
  const handlers = Object.fromEntries(
    [
      'applyFitZoom',
      'applyFitZoomOnResize',
      'addObjectAt',
      'alignSelected',
      'centerSelected',
      'clearBoard',
      'copyExportCode',
      'copyExportImage',
      'copySelected',
      'deleteLocalBoard',
      'deleteSelectedLocalBoards',
      'deleteSelected',
      'deselect',
      'downloadPreviewImage',
      'downloadProjectFile',
      'duplicateSelected',
      'exportCode',
      'importProjectFile',
      'getLastLayerIndex',
      'groupSelected',
      'moveLayerNodeBefore',
      'moveLayerNodeIntoGroup',
      'ungroupSelectedGroup',
      'toggleLayerGroup',
      'toggleLayerGroupFlag',
      'renameLayerGroup',
      'loadFromCode',
      'loadLocalBoard',
      'moveSelected',
      'moveSelectedTo',
      'newLocalBoard',
      'nudgeSelected',
      'onBackgroundChange',
      'onBoardNameChange',
      'pasteObject',
      'redo',
      'renderLocalBoards',
      'renderPreview',
      'saveLocalBoard',
      'saveLocalBoardAs',
      'selectObject',
      'setMarqueeSelectionMode',
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
      copyExportCode: handlers.copyExportCode,
      copyExportImage: handlers.copyExportImage,
      downloadPreviewImage: handlers.downloadPreviewImage,
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
      setMarqueeSelectionMode: handlers.setMarqueeSelectionMode,
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
      deleteSelectedLocalBoards: handlers.deleteSelectedLocalBoards,
      loadLocalBoard: handlers.loadLocalBoard,
      newLocalBoard: handlers.newLocalBoard,
      renderLocalBoards: handlers.renderLocalBoards,
      saveLocalBoard: handlers.saveLocalBoard,
      saveLocalBoardAs: handlers.saveLocalBoardAs,
      updateLocalBoardButtons: handlers.updateLocalBoardButtons,
    },
    objectCommands: {
      alignSelected: handlers.alignSelected,
      centerSelected: handlers.centerSelected,
      clearBoard: handlers.clearBoard,
      copySelected: handlers.copySelected,
      deleteSelected: handlers.deleteSelected,
      duplicateSelected: handlers.duplicateSelected,
      addObjectAt: handlers.addObjectAt,
      getLastLayerIndex: handlers.getLastLayerIndex,
      groupSelected: handlers.groupSelected,
      moveLayerNodeBefore: handlers.moveLayerNodeBefore,
      moveLayerNodeIntoGroup: handlers.moveLayerNodeIntoGroup,
      ungroupSelectedGroup: handlers.ungroupSelectedGroup,
      toggleLayerGroup: handlers.toggleLayerGroup,
      toggleLayerGroupFlag: handlers.toggleLayerGroupFlag,
      renameLayerGroup: handlers.renameLayerGroup,
      moveSelected: handlers.moveSelected,
      moveSelectedTo: handlers.moveSelectedTo,
      nudgeSelected: handlers.nudgeSelected,
      pasteObject: handlers.pasteObject,
      toggleSelectedLayerFlag: handlers.toggleLayerFlagForSelection,
    },
    projectFileActions: {
      downloadProjectFile: handlers.downloadProjectFile,
      importProjectFile: handlers.importProjectFile,
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
