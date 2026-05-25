import { SNAP_STEP } from './constants.js'
import {
  normalizeCoordinate as normalizeCoordinateValue,
  normalizePoint as normalizePointValue,
} from './geometry.js'
import {
  loadSavedBoard,
  persistSavedBoard,
} from './storage.js'
import {
  cleanBoard,
  normalizeBoard,
} from './board.js'
import { getEditorData } from './api.js'
import {
  createEditorState,
  getSelectedObject,
} from './editorState.js'
import { createBoardCodeActions } from './boardCodeActions.js'
import { createEditorFeedback } from './editorFeedback.js'
import { createEditorHistoryControls } from './editorHistoryControls.js'
import { createStageRenderer } from './stageRenderer.js'
import { createInspectorControls } from './inspectorControls.js'
import { handleEditorKeyboard } from './keyboardShortcuts.js'
import { createLocalBoardsPanel } from './localBoardsPanel.js'
import { renderLayers as renderLayersPanel } from './layersPanel.js'
import { createObjectCommands } from './objectCommands.js'
import { renderPaletteTabs as renderPaletteTabsPanel } from './palettePanel.js'
import { createViewportControls } from './viewportControls.js'

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
  confirmAction: (message) => window.confirm(message),
})

const els = {
  codeInput: document.querySelector('#code-input'),
  codeOutput: document.querySelector('#code-output'),
  loadCode: document.querySelector('#load-code'),
  exportCode: document.querySelector('#export-code'),
  renderPreview: document.querySelector('#render-preview'),
  background: document.querySelector('#background-select'),
  localBoardSelect: document.querySelector('#local-board-select'),
  saveLocalBoard: document.querySelector('#save-local-board'),
  loadLocalBoard: document.querySelector('#load-local-board'),
  deleteLocalBoard: document.querySelector('#delete-local-board'),
  boardName: document.querySelector('#board-name'),
  paletteTabs: document.querySelector('#palette-tabs'),
  palette: document.querySelector('#palette'),
  layers: document.querySelector('#layers'),
  layerCount: document.querySelector('#layer-count'),
  stageHost: document.querySelector('#stage-host'),
  preview: document.querySelector('#preview-image'),
  status: document.querySelector('#status'),
  undo: document.querySelector('#undo-action'),
  redo: document.querySelector('#redo-action'),
  clearBoard: document.querySelector('#clear-board'),
  deleteObject: document.querySelector('#delete-object'),
  duplicateObject: document.querySelector('#duplicate-object'),
  moveUp: document.querySelector('#move-up'),
  moveDown: document.querySelector('#move-down'),
  centerObject: document.querySelector('#center-object'),
  zoomOut: document.querySelector('#zoom-out'),
  zoomSelect: document.querySelector('#zoom-select'),
  zoomIn: document.querySelector('#zoom-in'),
  fitStage: document.querySelector('#fit-stage'),
  snap: document.querySelector('#snap-toggle'),
  grid: document.querySelector('#grid-toggle'),
  emptyState: document.querySelector('#empty-state'),
  inspector: document.querySelector('#inspector-form'),
  type: document.querySelector('#object-type'),
  x: document.querySelector('#object-x'),
  y: document.querySelector('#object-y'),
  size: document.querySelector('#object-size'),
  angle: document.querySelector('#object-angle'),
  color: document.querySelector('#object-color'),
  transparency: document.querySelector('#object-transparency'),
  text: document.querySelector('#object-text'),
  endX: document.querySelector('#object-end-x'),
  endY: document.querySelector('#object-end-y'),
  arc: document.querySelector('#object-arc'),
  donut: document.querySelector('#object-donut'),
  hidden: document.querySelector('#object-hidden'),
  locked: document.querySelector('#object-locked'),
}

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
  confirmAction: (message) => window.confirm(message),
})

async function init() {
  const meta = await getEditorData()
  state.iconConfigs = meta.iconConfigs
  state.iconGroups = meta.iconGroups
  state.backgrounds = meta.backgrounds
  const codeFromUrl = new URLSearchParams(window.location.search).get('code')
  const savedBoard = loadSavedBoard()
  if (codeFromUrl) {
    els.codeInput.value = codeFromUrl
    await loadFromCode(codeFromUrl, { record: false })
  } else if (savedBoard) {
    state.board = normalizeBoard(savedBoard)
    els.boardName.value = state.board.name ?? ''
    renderBackgroundOptions()
  } else {
    els.codeInput.value = meta.defaultCode
    await loadFromCode(meta.defaultCode, { record: false })
  }
  bindEvents()
  renderLocalBoards()
  renderPaletteTabs()
  renderAll()
  applyFitZoom({ silent: true })
  showStatus(codeFromUrl ? '已从链接导入战术板' : '编辑器已就绪')
}

function bindEvents() {
  els.loadCode.addEventListener('click', () =>
    runAction(() => loadFromCode(els.codeInput.value), '已导入战术板', {
      busyMessage: '正在导入战术板...',
    }),
  )
  els.exportCode.addEventListener('click', () =>
    runAction(exportCode, '已导出战术板代码', {
      busyMessage: '正在导出战术板代码...',
    }),
  )
  els.renderPreview.addEventListener('click', () =>
    runAction(renderPreview, '已渲染预览图', {
      busyMessage: '正在渲染预览图...',
    }),
  )
  els.background.addEventListener('change', () => {
    recordHistory()
    state.board.boardBackground = els.background.value
    renderAll()
  })
  els.boardName.addEventListener('change', () => {
    recordHistory()
    state.board.name = els.boardName.value
  })
  els.localBoardSelect.addEventListener('change', updateLocalBoardButtons)
  els.saveLocalBoard.addEventListener('click', saveLocalBoard)
  els.loadLocalBoard.addEventListener('click', loadLocalBoard)
  els.deleteLocalBoard.addEventListener('click', deleteLocalBoard)
  els.undo.addEventListener('click', undo)
  els.redo.addEventListener('click', redo)
  els.clearBoard.addEventListener('click', clearBoard)
  els.deleteObject.addEventListener('click', deleteSelected)
  els.duplicateObject.addEventListener('click', duplicateSelected)
  els.moveUp.addEventListener('click', () => moveSelected(1))
  els.moveDown.addEventListener('click', () => moveSelected(-1))
  els.centerObject.addEventListener('click', centerSelected)
  els.zoomOut.addEventListener('click', () => stepZoom(-1))
  els.zoomIn.addEventListener('click', () => stepZoom(1))
  els.fitStage.addEventListener('click', () => applyFitZoom())
  els.zoomSelect.addEventListener('change', () => {
    if (els.zoomSelect.value === 'fit') {
      applyFitZoom()
      return
    }
    setStageZoom(Number(els.zoomSelect.value), { mode: 'manual' })
  })
  els.snap.addEventListener('change', toggleSnapToGrid)
  els.grid.addEventListener('change', toggleGrid)
  window.addEventListener('resize', applyFitZoomOnResize)
  document.addEventListener('keydown', (event) =>
    handleEditorKeyboard(event, {
      applyFitZoom,
      copySelected,
      deleteSelected,
      deselect,
      duplicateSelected,
      nudgeSelected,
      pasteObject,
      redo,
      stepZoom,
      undo,
    }),
  )
  for (const input of [
    els.x,
    els.y,
    els.size,
    els.angle,
    els.color,
    els.transparency,
    els.text,
    els.endX,
    els.endY,
    els.arc,
    els.donut,
    els.hidden,
    els.locked,
  ]) {
    input.addEventListener('input', updateSelectedFromInspector)
  }
}

function renderBackgroundOptions() {
  els.background.innerHTML = ''
  for (const key of Object.keys(state.backgrounds)) {
    const option = document.createElement('option')
    option.value = key
    option.textContent = key
    option.selected = key === state.board.boardBackground
    els.background.append(option)
  }
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
  els.boardName.value = state.board.name ?? ''
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

init().catch((error) => {
  console.error(error)
  alert(error.message)
})
