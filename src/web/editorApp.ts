import { getEditorData } from './api.js'
import { getBrowserWindow } from './browser.js'
import { createEditorState } from './editorState.js'
import { createEditorActionRegistry } from './editorActionRegistry.js'
import { bindEditorEvents } from './editorBindings.js'
import { createEditorControllers } from './editorControllers.js'
import { createEditorContext } from './editorContext.js'
import { mountEditorDialogTemplates } from './dialogTemplates.js'
import { getEditorElements } from './editorElements.js'
import { createEditorFeedback } from './editorFeedback.js'
import { createEditorHistoryControls } from './editorHistoryControls.js'
import { createEditorRenderLoop } from './editorRenderLoop.js'
import { initializeEditorBoard } from './editorStartup.js'
import { createStageRenderer } from './stageRenderer.js'
import { renderPaletteTabs as renderPaletteTabsPanel } from './palettePanel.js'
import { rememberRecentObjectType } from './palettePreferences.js'
import type {
  EditorState,
} from './types.js'
import type {
  EditorElements,
} from './editorElements.js'

interface CreateEditorAppOptions {
  confirmAction?: (message: string) => boolean
}

interface EditorApp {
  elements: EditorElements
  start(): Promise<void>
  state: EditorState
}

interface RenderLoop {
  renderAll(): Promise<void>
  renderInspector(): void
  renderLayers(): void
}

export function createEditorApp({
  confirmAction = (message) => getBrowserWindow().confirm(message),
}: CreateEditorAppOptions = {}): EditorApp {
  mountEditorDialogTemplates()
  const els = getEditorElements()
  const state = createEditorState()
  let renderLoop: RenderLoop
  let startPromise: Promise<void> | null = null
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
    normalizeCoordinate,
    normalizePoint,
    recordHistory,
    renderAll,
    renderPalette: renderPaletteTabs,
    runAction,
    selectObject,
    showStatus,
    stage,
    stageRenderer,
    state,
    updateHistoryButtons,
  })
  const {
    addObject,
    applyInitialZoom,
    boardCodeActions,
    boardMetaControls,
    inspectorControls,
    loadFromCode,
    localBoardsPanel,
    localPresetsPanel,
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
    localPresetsPanel,
    objectCommands,
    projectFileActions,
    viewportControls,
  })
  renderLoop = createEditorRenderLoop({
    state,
    elements: els,
    stageRenderer,
    renderInspectorPanel,
    showStatus,
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

  function start(): Promise<void> {
    if (!startPromise) {
      startPromise = runStart().catch((error) => {
        startPromise = null
        throw error
      })
    }
    return startPromise
  }

  async function runStart(): Promise<void> {
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
    localPresetsPanel.renderLocalPresets()
    renderPaletteTabs()
    await renderAll()
    applyInitialZoom({ silent: true })
    showStatus(initialSource.statusText)
  }

  function bindEvents(): void {
    bindEditorEvents({
      elements: els,
      runAction,
      actions: eventActions,
      onPaletteObjectUsed,
      renderPalette: renderPaletteTabs,
    })
  }

  function renderPaletteTabs(): void {
    renderPaletteTabsPanel({
      state,
      elements: els,
      onAddObject: (type) => {
        if (addObject(type)) onPaletteObjectUsed(type)
      },
    })
  }

  function onPaletteObjectUsed(type: string): void {
    const activeElement = getBrowserWindow().document.activeElement
    const restoreFocus = activeElement instanceof HTMLElement
      && activeElement.classList.contains('palette-item')
    if (!rememberRecentObjectType(type)) return
    renderPaletteTabs()
    if (!restoreFocus) return
    const matchingButton = [...els.palette.querySelectorAll<HTMLButtonElement>('.palette-item')]
      .find((button) => button.dataset.objectType === type)
    matchingButton?.focus()
  }

  async function renderAll(): Promise<void> {
    await renderLoop.renderAll()
  }

  function renderInspector(): void {
    renderLoop.renderInspector()
  }

  function renderLayers(): void {
    renderLoop.renderLayers()
  }

  function restoreCurrentState(): void {
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

export async function startEditorApp(options?: CreateEditorAppOptions): Promise<EditorApp> {
  const app = createEditorApp(options)
  await app.start()
  return app
}
