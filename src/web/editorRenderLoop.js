import { cleanBoard } from './board.js'
import { persistSavedBoard } from './storage.js'
import { renderLayers as renderLayersPanel } from './layersPanel.js'

export function createEditorRenderLoop({
  elements,
  onSelectObject,
  onToggleLayerFlag,
  renderInspectorPanel,
  stageRenderer,
  state,
}) {
  async function renderAll() {
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
      onSelectObject,
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
