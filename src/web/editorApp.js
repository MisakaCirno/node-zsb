import { getEditorData } from './api.js'
import { createEditorState } from './editorState.js'
import { createBoardMetaControls } from './boardMetaControls.js'
import { createBoardCodeActions } from './boardCodeActions.js'
import { bindEditorEvents } from './editorBindings.js'
import { createEditorContext } from './editorContext.js'
import { getEditorElements } from './editorElements.js'
import { createEditorFeedback } from './editorFeedback.js'
import { createEditorHistoryControls } from './editorHistoryControls.js'
import { createEditorRenderLoop } from './editorRenderLoop.js'
import { initializeEditorBoard } from './editorStartup.js'
import { createStageRenderer } from './stageRenderer.js'
import { createInspectorControls } from './inspectorControls.js'
import { createLocalBoardsPanel } from './localBoardsPanel.js'
import { createObjectCommands } from './objectCommands.js'
import { renderPaletteTabs as renderPaletteTabsPanel } from './palettePanel.js'
import { createViewportControls } from './viewportControls.js'

export function createEditorApp({
  confirmAction = (message) => window.confirm(message),
} = {}) {
  const els = getEditorElements()
  const state = createEditorState()
  let renderLoop
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
  const {
    deselect,
    getSelected,
    normalizeCoordinate,
    normalizePoint,
    selectObject,
  } = createEditorContext({
    state,
    renderAll,
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
  renderLoop = createEditorRenderLoop({
    state,
    elements: els,
    stageRenderer,
    renderInspectorPanel: renderInspectorControl,
    onSelectObject: selectObject,
    onToggleLayerFlag: toggleLayerFlag,
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
    await renderLoop.renderAll()
  }

  function renderInspector() {
    renderLoop.renderInspector()
  }

  function renderLayers() {
    renderLoop.renderLayers()
  }

  function restoreCurrentState() {
    syncBoardNameInput()
    renderBackgroundOptions()
    renderAll()
    updateHistoryButtons()
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
