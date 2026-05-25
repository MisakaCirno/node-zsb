import { SNAP_STEP } from './constants.js'
import {
  normalizeCoordinate as normalizeCoordinateValue,
  normalizePoint as normalizePointValue,
} from './geometry.js'
import { persistSavedBoard } from './storage.js'
import {
  cleanBoard,
} from './board.js'
import { getEditorData } from './api.js'
import {
  createEditorState,
  getSelectedObject,
} from './editorState.js'
import { createBoardMetaControls } from './boardMetaControls.js'
import { createBoardCodeActions } from './boardCodeActions.js'
import { bindEditorEvents } from './editorBindings.js'
import { getEditorElements } from './editorElements.js'
import { createEditorFeedback } from './editorFeedback.js'
import { createEditorHistoryControls } from './editorHistoryControls.js'
import { initializeEditorBoard } from './editorStartup.js'
import { createStageRenderer } from './stageRenderer.js'
import { createInspectorControls } from './inspectorControls.js'
import { createLocalBoardsPanel } from './localBoardsPanel.js'
import { renderLayers as renderLayersPanel } from './layersPanel.js'
import { createObjectCommands } from './objectCommands.js'
import { renderPaletteTabs as renderPaletteTabsPanel } from './palettePanel.js'
import { createViewportControls } from './viewportControls.js'

export function createEditorApp({
  confirmAction = (message) => window.confirm(message),
} = {}) {
  const els = getEditorElements()
  const state = createEditorState()
  const {
    runAction,
    showStatus,
  } = createEditorFeedback({
    state,
    getElements: () => els,
  })
  const {
    recordHistory,
    redo,
    undo,
    updateHistoryButtons,
  } = createEditorHistoryControls({
    state,
    getElements: () => els,
    restoreCurrentState,
    showStatus,
  })
  const stageRenderer = createStageRenderer({
    container: 'stage-host',
    state,
    normalizePoint,
    normalizeCoordinate,
    recordHistory,
    renderAll,
    renderInspector,
    renderLayers,
    selectObject,
    showStatus,
  })
  const { stage } = stageRenderer
  const {
    addObject,
    centerSelected,
    clearBoard,
    copySelected,
    deleteSelected,
    duplicateSelected,
    moveSelected,
    nudgeSelected,
    pasteObject,
    toggleLayerFlag,
  } = createObjectCommands({
    state,
    recordHistory,
    renderAll,
    selectObject,
    getSelected,
    normalizePoint,
    showStatus,
    confirmAction,
  })

  const {
    onBackgroundChange,
    onBoardNameChange,
    renderBackgroundOptions,
    syncBoardNameInput,
  } = createBoardMetaControls({
    state,
    elements: els,
    recordHistory,
    renderAll,
  })

  const {
    renderInspector: renderInspectorControl,
    updateSelectedFromInspector,
  } = createInspectorControls({
    state,
    elements: els,
    getSelected,
    normalizePoint,
    recordHistory,
    renderAll,
  })

  const {
    exportCode,
    loadFromCode,
    renderPreview,
  } = createBoardCodeActions({
    state,
    elements: els,
    recordHistory,
    renderAll,
    renderBackgroundOptions,
  })

  const {
    applyFitZoom,
    applyFitZoomOnResize,
    setStageZoom,
    stepZoom,
    toggleGrid,
    toggleSnapToGrid,
  } = createViewportControls({
    state,
    elements: els,
    stage,
    stageRenderer,
    showStatus,
  })

  const {
    deleteLocalBoard,
    loadLocalBoard,
    renderLocalBoards,
    saveLocalBoard,
    updateLocalBoardButtons,
  } = createLocalBoardsPanel({
    state,
    elements: els,
    recordHistory,
    renderAll,
    renderBackgroundOptions,
    showStatus,
    confirmAction,
  })

  async function start() {
    const meta = await getEditorData()
    state.iconConfigs = meta.iconConfigs
    state.iconGroups = meta.iconGroups
    state.backgrounds = meta.backgrounds
    const initialSource = await initializeEditorBoard({
      elements: els,
      loadFromCode,
      meta,
      renderBackgroundOptions,
      state,
      syncBoardNameInput,
    })
    bindEvents()
    renderLocalBoards()
    renderPaletteTabs()
    renderAll()
    applyFitZoom({ silent: true })
    showStatus(initialSource.statusText)
  }

  function bindEvents() {
    bindEditorEvents({
      elements: els,
      runAction,
      actions: {
        applyFitZoom,
        applyFitZoomOnResize,
        centerSelected,
        clearBoard,
        copySelected,
        deleteLocalBoard,
        deleteSelected,
        deselect,
        duplicateSelected,
        exportCode,
        loadFromCode,
        loadLocalBoard,
        moveSelected,
        nudgeSelected,
        onBackgroundChange,
        onBoardNameChange,
        pasteObject,
        redo,
        renderPreview,
        saveLocalBoard,
        setStageZoom,
        stepZoom,
        toggleGrid,
        toggleSnapToGrid,
        undo,
        updateLocalBoardButtons,
        updateSelectedFromInspector,
      },
    })
  }

  function renderPaletteTabs() {
    renderPaletteTabsPanel({
      state,
      elements: els,
      onAddObject: addObject,
    })
  }

  async function renderAll() {
    await stageRenderer.renderBoard()
    stageRenderer.renderGrid()
    await stageRenderer.renderObjects()
    renderLayers()
    renderInspector()
    persistBoard()
  }

  function selectObject(index) {
    state.selectedIndex = index
    renderAll()
  }

  function renderInspector() {
    renderInspectorControl()
  }

  function renderLayers() {
    renderLayersPanel({
      state,
      elements: els,
      onSelectObject: selectObject,
      onToggleLayerFlag: toggleLayerFlag,
    })
  }

  function restoreCurrentState() {
    syncBoardNameInput()
    renderBackgroundOptions()
    renderAll()
    updateHistoryButtons()
  }

  function deselect() {
    selectObject(-1)
    showStatus('已取消选择')
  }

  function persistBoard() {
    persistSavedBoard(cleanBoard(state.board))
  }

  function getSelected() {
    return getSelectedObject(state)
  }

  function normalizePoint(x, y) {
    return normalizePointValue(x, y, getSnapStep())
  }

  function normalizeCoordinate(value, min, max) {
    return normalizeCoordinateValue(value, min, max, getSnapStep())
  }

  function getSnapStep() {
    return state.snapToGrid ? SNAP_STEP : 0
  }

  return {
    elements: els,
    start,
    state,
  }
}

export async function startEditorApp(options) {
  const app = createEditorApp(options)
  await app.start()
  return app
}
