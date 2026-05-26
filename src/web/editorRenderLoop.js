import { cleanBoard } from './board.js'
import { persistSavedBoard } from './storage.js'
import { renderLayers as renderLayersPanel } from './layersPanel.js'

export function createEditorRenderLoop({
  elements,
  onReorderLayer,
  onSelectGroup,
  onSelectObject,
  onRenameLayerGroup,
  onToggleLayerGroup,
  onToggleLayerGroupFlag,
  onToggleLayerFlag,
  renderInspectorPanel,
  stageRenderer,
  state,
}) {
  let isRendering = false
  let needsRender = false
  let currentRender = Promise.resolve()

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
    persistBoard()
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
      onSelectGroup,
      onSelectObject,
      onToggleLayerGroup,
      onToggleLayerGroupFlag,
      onToggleLayerFlag,
    })
  }

  function persistBoard() {
    persistSavedBoard(cleanBoard(state.board))
  }

  return {
    persistBoard,
    renderAll,
    renderInspector,
    renderLayers,
  }
}
