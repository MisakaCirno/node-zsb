import { getEditorData } from './api.js'
import { createEditorState } from './editorState.js'
import { createEditorActionRegistry } from './editorActionRegistry.js'
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
  const historyControls = createEditorHistoryControls({
    state,
    getElements: () => els,
    restoreCurrentState,
    showStatus,
  })
  const {
    recordHistory,
    updateHistoryButtons,
  } = historyControls
  const editorContext = createEditorContext({
    state,
    renderAll,
    showStatus,
  })
  const {
    getSelected,
    normalizeCoordinate,
    normalizePoint,
    selectObject,
  } = editorContext
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
  const objectCommands = createObjectCommands({
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
    addObject,
    toggleLayerFlag,
  } = objectCommands

  const boardMetaControls = createBoardMetaControls({
    state,
    elements: els,
    recordHistory,
    renderAll,
  })
  const {
    renderBackgroundOptions,
    syncBoardNameInput,
  } = boardMetaControls

  const inspectorControls = createInspectorControls({
    state,
    elements: els,
    getSelected,
    normalizePoint,
    recordHistory,
    renderAll,
  })
  const {
    renderInspector: renderInspectorControl,
  } = inspectorControls

  const boardCodeActions = createBoardCodeActions({
    state,
    elements: els,
    recordHistory,
    renderAll,
    renderBackgroundOptions,
  })
  const { loadFromCode } = boardCodeActions

  const viewportControls = createViewportControls({
    state,
    elements: els,
    stage,
    stageRenderer,
    showStatus,
  })
  const { applyFitZoom } = viewportControls

  const localBoardsPanel = createLocalBoardsPanel({
    state,
    elements: els,
    recordHistory,
    renderAll,
    renderBackgroundOptions,
    showStatus,
    confirmAction,
  })
  const { renderLocalBoards } = localBoardsPanel
  const eventActions = createEditorActionRegistry({
    boardCodeActions,
    boardMetaControls,
    editorContext,
    historyControls,
    inspectorControls,
    localBoardsPanel,
    objectCommands,
    viewportControls,
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
      actions: eventActions,
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
