import { getEditorData } from './api.js'
import { createEditorState } from './editorState.js'
import { createEditorActionRegistry } from './editorActionRegistry.js'
import { bindEditorEvents } from './editorBindings.js'
import { createEditorControllers } from './editorControllers.js'
import { createEditorContext } from './editorContext.js'
import { getEditorElements } from './editorElements.js'
import { createEditorFeedback } from './editorFeedback.js'
import { createEditorHistoryControls } from './editorHistoryControls.js'
import { createEditorRenderLoop } from './editorRenderLoop.js'
import { initializeEditorBoard } from './editorStartup.js'
import { createStageRenderer } from './stageRenderer.js'
import { renderPaletteTabs as renderPaletteTabsPanel } from './palettePanel.js'

export function createEditorApp({
  confirmAction = (message) => window.confirm(message),
} = {}) {
  const els = getEditorElements()
  const state = createEditorState()
  let renderLoop
  let startPromise
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
    getSelectedList,
    normalizeCoordinate,
    normalizePoint,
    selectObject,
    selectLayerGroup,
    selectObjects,
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
    selectObjects,
    showStatus,
  })
  const { stage } = stageRenderer
  const controllers = createEditorControllers({
    confirmAction,
    elements: els,
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
  })
  const {
    addObject,
    applyFitZoom,
    boardCodeActions,
    boardMetaControls,
    inspectorControls,
    loadFromCode,
    localBoardsPanel,
    objectCommands,
    projectFileActions,
    renderBackgroundOptions,
    renderInspectorPanel,
    renderLocalBoards,
    reorderLayer,
    syncBoardNameInput,
    toggleLayerFlag,
    viewportControls,
  } = controllers
  const eventActions = createEditorActionRegistry({
    boardCodeActions,
    boardMetaControls,
    editorContext,
    historyControls,
    inspectorControls,
    localBoardsPanel,
    objectCommands,
    projectFileActions,
    viewportControls,
  })
  renderLoop = createEditorRenderLoop({
    state,
    elements: els,
    stageRenderer,
    renderInspectorPanel,
    onSelectObject: selectObject,
    onSelectGroup: selectLayerGroup,
    onReorderLayer: reorderLayer,
    onRenameLayerGroup: objectCommands.renameLayerGroup,
    onMoveLayerNodeAfter: objectCommands.moveLayerNodeAfter,
    onMoveLayerNodeBefore: objectCommands.moveLayerNodeBefore,
    onMoveLayerNodeIntoGroup: objectCommands.moveLayerNodeIntoGroup,
    onMoveLayerNodeToRoot: objectCommands.moveLayerNodeToRoot,
    onToggleLayerGroup: objectCommands.toggleLayerGroup,
    onToggleLayerGroupFlag: objectCommands.toggleLayerGroupFlag,
    onToggleLayerFlag: toggleLayerFlag,
  })

  function start() {
    if (!startPromise) {
      startPromise = runStart().catch((error) => {
        startPromise = null
        throw error
      })
    }
    return startPromise
  }

  async function runStart() {
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
    viewportControls.syncControlStateFromDom()
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
