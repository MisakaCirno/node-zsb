import { createProjectFromBoard } from './project.js'
import { persistSavedBoard } from './storage.js'
import { renderLayers as renderLayersPanel } from './layersPanel.js'
import type {
  EditorState,
  LayerFlag,
  LayerNodeRef,
  TextElement,
} from './types.js'

interface EditorRenderLoopDeps {
  elements: LayerPanelElements
  onReorderLayer: (fromIndex: number, toIndex: number) => void
  onSelectGroup: (groupId: string) => void
  onSelectObject: (index: number, options?: { range?: boolean, toggle?: boolean }) => void
  onRenameLayerGroup: (groupId: string, name: string) => void
  onToggleLayerGroup: (groupId: string) => void
  onToggleLayerGroupFlag: (groupId: string, key: LayerFlag) => void
  onToggleLayerFlag: (index: number, key: LayerFlag) => void
  onMoveLayerNodeAfter: (dragged: LayerNodeRef, target: LayerNodeRef) => void
  onMoveLayerNodeBefore: (dragged: LayerNodeRef, target: LayerNodeRef) => void
  onMoveLayerNodeIntoGroup: (dragged: LayerNodeRef, groupId: string) => void
  onMoveLayerNodeToRoot: (dragged: LayerNodeRef) => void
  renderInspectorPanel(): void
  stageRenderer: StageRenderer
  state: EditorState
}

interface LayerPanelElements {
  layers: HTMLElement
  layerCount: TextElement
}

interface StageRenderer {
  renderBoard(): Promise<void>
  renderGrid(): void
  renderObjects(): Promise<void>
}

export function createEditorRenderLoop({
  elements,
  onReorderLayer,
  onSelectGroup,
  onSelectObject,
  onRenameLayerGroup,
  onToggleLayerGroup,
  onToggleLayerGroupFlag,
  onToggleLayerFlag,
  onMoveLayerNodeAfter,
  onMoveLayerNodeBefore,
  onMoveLayerNodeIntoGroup,
  onMoveLayerNodeToRoot,
  renderInspectorPanel,
  stageRenderer,
  state,
}: EditorRenderLoopDeps) {
  let isRendering = false
  let needsRender = false
  let currentRender = Promise.resolve()
  let lastPersistedSnapshot = ''

  function renderAll() {
    needsRender = true
    if (!isRendering) {
      currentRender = drainRenderQueue()
    }
    return currentRender
  }

  async function drainRenderQueue() {
    isRendering = true
    try {
      while (needsRender) {
        needsRender = false
        await renderOnce()
      }
    } finally {
      isRendering = false
    }
  }

  async function renderOnce() {
    await stageRenderer.renderBoard()
    stageRenderer.renderGrid()
    await stageRenderer.renderObjects()
    renderLayers()
    renderInspector()
    persistBoardIfChanged()
  }

  function renderInspector() {
    renderInspectorPanel()
  }

  function renderLayers() {
    renderLayersPanel({
      state,
      elements,
      onReorderLayer,
      onRenameLayerGroup,
      onMoveLayerNodeAfter,
      onMoveLayerNodeBefore,
      onMoveLayerNodeIntoGroup,
      onMoveLayerNodeToRoot,
      onSelectGroup,
      onSelectObject,
      onToggleLayerGroup,
      onToggleLayerGroupFlag,
      onToggleLayerFlag,
    })
  }

  function persistBoard() {
    persistProjectSnapshot({ force: true })
  }

  function persistBoardIfChanged() {
    persistProjectSnapshot({ force: false })
  }

  function persistProjectSnapshot({ force }: { force: boolean }) {
    const project = createProjectFromBoard(state.board, {
      fileName: state.currentFileName,
      layerTree: state.layerTree,
    })
    const snapshot = JSON.stringify(project)
    if (!force && snapshot === lastPersistedSnapshot) return
    if (persistSavedBoard(project)) {
      lastPersistedSnapshot = snapshot
    }
  }

  return {
    persistBoard,
    renderAll,
    renderInspector,
    renderLayers,
  }
}
