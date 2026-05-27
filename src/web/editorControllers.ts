import { createBoardCodeActions } from './boardCodeActions.js'
import { createBoardMetaControls } from './boardMetaControls.js'
import { createInspectorControls } from './inspectorControls.js'
import { createLocalBoardsPanel } from './localBoardsPanel.js'
import { createLocalPresetsPanel } from './localPresetsPanel.js'
import { createObjectCommands } from './objectCommands.js'
import { createProjectFileActions } from './projectFileActions.js'
import { createViewportControls } from './viewportControls.js'
import type {
  BoardObject,
  EditorState,
  GridRenderer,
  StageLike,
} from './types.js'
import type {
  EditorElements,
} from './editorElements.js'

interface EditorControllersDeps {
  confirmAction(message: string): boolean
  elements: EditorElements
  getSelected(): BoardObject | undefined
  getSelectedList(): BoardObject[]
  normalizePoint(x: number, y: number): { x: number, y: number }
  recordHistory(): void
  renderAll(): Promise<void>
  selectObject(index: number, options?: { range?: boolean, revealInLayers?: boolean, toggle?: boolean }): void
  showStatus(message: string, options?: { type?: string }): void
  stage: StageLike & { toDataURL(options?: { pixelRatio?: number }): string }
  stageRenderer: GridRenderer
  state: EditorState
}

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
}: EditorControllersDeps) {
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
    stage,
  })

  const localPresetsPanel = createLocalPresetsPanel({
    state,
    elements,
    recordHistory,
    renderAll,
    showStatus,
    confirmAction,
  })

  return {
    boardCodeActions,
    boardMetaControls,
    inspectorControls,
    localBoardsPanel,
    localPresetsPanel,
    objectCommands,
    projectFileActions,
    viewportControls,
    addObject: objectCommands.addObject,
    applyInitialZoom: viewportControls.applyInitialZoom,
    loadFromCode: boardCodeActions.loadFromCode,
    renderBackgroundOptions,
    renderInspectorPanel: inspectorControls.renderInspector,
    renderLocalBoards: localBoardsPanel.renderLocalBoards,
    reorderLayer: objectCommands.reorderLayer,
    syncBoardNameInput,
    toggleLayerFlag: objectCommands.toggleLayerFlag,
  }
}
