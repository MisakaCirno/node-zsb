import { createBoardCodeActions } from './boardCodeActions.js'
import { createBoardMetaControls } from './boardMetaControls.js'
import { createInspectorControls } from './inspectorControls.js'
import { createLocalBoardsPanel } from './localBoardsPanel.js'
import { createObjectCommands } from './objectCommands.js'
import { createProjectFileActions } from './projectFileActions.js'
import { createViewportControls } from './viewportControls.js'

export function createEditorControllers({
  confirmAction,
  elements,
  getSelected,
  getSelectedList,
  normalizePoint,
  recordHistory,
  renderAll,
  selectObject,
  showStatus,
  stage,
  stageRenderer,
  state,
}) {
  const objectCommands = createObjectCommands({
    state,
    recordHistory,
    renderAll,
    selectObject,
    getSelected,
    getSelectedList,
    normalizePoint,
    showStatus,
    confirmAction,
    stage,
  })

  const boardMetaControls = createBoardMetaControls({
    state,
    elements,
    recordHistory,
    renderAll,
  })
  const {
    renderBackgroundOptions,
    syncBoardNameInput,
  } = boardMetaControls

  const inspectorControls = createInspectorControls({
    state,
    elements,
    getSelected,
    normalizePoint,
    recordHistory,
    renderAll,
  })

  const boardCodeActions = createBoardCodeActions({
    state,
    elements,
    recordHistory,
    renderAll,
    renderBackgroundOptions,
  })

  const projectFileActions = createProjectFileActions({
    state,
    elements,
    recordHistory,
    renderAll,
    renderBackgroundOptions,
  })

  const viewportControls = createViewportControls({
    state,
    elements,
    stage,
    stageRenderer,
    showStatus,
  })

  const localBoardsPanel = createLocalBoardsPanel({
    state,
    elements,
    recordHistory,
    renderAll,
    renderBackgroundOptions,
    showStatus,
    confirmAction,
  })

  return {
    boardCodeActions,
    boardMetaControls,
    inspectorControls,
    localBoardsPanel,
    objectCommands,
    projectFileActions,
    viewportControls,
    addObject: objectCommands.addObject,
    applyFitZoom: viewportControls.applyFitZoom,
    loadFromCode: boardCodeActions.loadFromCode,
    renderBackgroundOptions,
    renderInspectorPanel: inspectorControls.renderInspector,
    renderLocalBoards: localBoardsPanel.renderLocalBoards,
    reorderLayer: objectCommands.reorderLayer,
    syncBoardNameInput,
    toggleLayerFlag: objectCommands.toggleLayerFlag,
  }
}
