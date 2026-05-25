import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SNAP_STEP,
  ZOOM_LEVELS,
} from './constants.js'
import {
  clamp,
  normalizeCoordinate as normalizeCoordinateValue,
  normalizePoint as normalizePointValue,
  numberValue,
} from './geometry.js'
import {
  loadSavedBoard,
  persistSavedBoard,
} from './storage.js'
import {
  cleanBoard,
  getObjectCapabilities,
  normalizeBoard,
} from './board.js'
import {
  decodeBoardCode,
  encodeBoardCode,
  getEditorData,
  renderPreviewImage,
} from './api.js'
import {
  createEditorState,
  getSelectedObject,
  replaceBoard,
} from './editorState.js'
import {
  recordHistory as pushHistory,
  redoHistory,
  undoHistory,
} from './history.js'
import { createStageRenderer } from './stageRenderer.js'
import { renderInspector as renderInspectorPanel } from './inspectorPanel.js'
import { handleEditorKeyboard } from './keyboardShortcuts.js'
import { createLocalBoardsPanel } from './localBoardsPanel.js'
import { renderLayers as renderLayersPanel } from './layersPanel.js'
import { createObjectCommands } from './objectCommands.js'
import { renderPaletteTabs as renderPaletteTabsPanel } from './palettePanel.js'

const state = createEditorState()
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
  els.snap.addEventListener('change', () => {
    state.snapToGrid = els.snap.checked
    showStatus(state.snapToGrid ? '已开启网格吸附' : '已关闭网格吸附')
  })
  els.grid.addEventListener('change', () => {
    state.showGrid = els.grid.checked
    stageRenderer.renderGrid()
    showStatus(state.showGrid ? '已显示辅助网格' : '已隐藏辅助网格')
  })
  window.addEventListener('resize', () => {
    if (state.zoomMode === 'fit') {
      applyFitZoom({ silent: true })
    }
  })
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

async function loadFromCode(code, options = {}) {
  const board = await decodeBoardCode(code)
  if (options.record !== false) {
    recordHistory()
  }
  replaceBoard(state, normalizeBoard(board))
  els.boardName.value = state.board.name ?? ''
  renderBackgroundOptions()
  await renderAll()
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
  renderInspectorPanel({
    object: getSelected(),
    elements: els,
    updateSelectionActions,
  })
}

function updateSelectedFromInspector() {
  const object = getSelected()
  if (!object) return
  const capabilities = getObjectCapabilities(object.type)
  recordHistory()
  const point = normalizePoint(numberValue(els.x, 0, 512), numberValue(els.y, 0, 384))
  object.x = point.x
  object.y = point.y
  object.size = numberValue(els.size, 10, 300)
  object.angle = numberValue(els.angle, 0, 360)
  object.color = capabilities.appearance ? els.color.value : undefined
  object.transparency = capabilities.appearance
    ? numberValue(els.transparency, 0, 100)
    : undefined
  object.text = capabilities.text ? els.text.value || undefined : undefined
  object.endX = capabilities.line ? numberValue(els.endX, 0, 512) : undefined
  object.endY = capabilities.line ? numberValue(els.endY, 0, 384) : undefined
  object.arcAngle = capabilities.arcAngle ? numberValue(els.arc, 10, 360) : undefined
  object.donutRadius = capabilities.donutRadius
    ? numberValue(els.donut, 0, 240)
    : undefined
  object.hidden = els.hidden.checked || undefined
  object.locked = els.locked.checked || undefined
  renderAll()
}

function renderLayers() {
  renderLayersPanel({
    state,
    elements: els,
    onSelectObject: selectObject,
    onToggleLayerFlag: toggleLayerFlag,
  })
}

function applyFitZoom(options = {}) {
  const styles = getComputedStyle(els.stageHost)
  const horizontalPadding =
    Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
  const verticalPadding =
    Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
  const availableWidth = Math.max(0, els.stageHost.clientWidth - horizontalPadding)
  const availableHeight = Math.max(0, els.stageHost.clientHeight - verticalPadding)
  const zoom = Math.min(1, availableWidth / SCENE_WIDTH, availableHeight / SCENE_HEIGHT)
  setStageZoom(zoom, { mode: 'fit', ...options })
}

function stepZoom(direction) {
  const current = state.zoom
  const target =
    direction > 0
      ? ZOOM_LEVELS.find((level) => level > current + 0.01) ?? ZOOM_LEVELS.at(-1)
      : ZOOM_LEVELS.findLast((level) => level < current - 0.01) ?? ZOOM_LEVELS[0]
  setStageZoom(target, { mode: 'manual' })
}

function setStageZoom(zoom, options = {}) {
  const nextZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 0.35, 1.5)
  state.zoom = nextZoom
  state.zoomMode = options.mode ?? 'manual'
  stage.scale({ x: nextZoom, y: nextZoom })
  stage.width(Math.round(SCENE_WIDTH * nextZoom))
  stage.height(Math.round(SCENE_HEIGHT * nextZoom))
  stage.batchDraw()
  updateZoomControls()
  if (!options.silent) {
    const action = state.zoomMode === 'fit' ? '已适配画布视图' : '已设置画布缩放'
    showStatus(`${action} ${formatZoom(nextZoom)}`)
  }
}

function updateZoomControls() {
  els.zoomSelect.value = state.zoomMode === 'fit' ? 'fit' : String(state.zoom)
  els.zoomOut.disabled = state.zoom <= ZOOM_LEVELS[0]
  els.zoomIn.disabled = state.zoom >= ZOOM_LEVELS.at(-1)
}

function formatZoom(zoom) {
  return `${Math.round(zoom * 100)}%`
}

async function exportCode() {
  const code = await encodeBoardCode(cleanBoard(state.board))
  els.codeOutput.value = code
  els.codeInput.value = code
  updateCodeUrl(code)
}

async function renderPreview() {
  const code = await exportAndReturnCode()
  const data = await renderPreviewImage(code)
  els.preview.src = `/preview/${data.hash}.webp?${Date.now()}`
  els.preview.style.display = 'block'
}

async function exportAndReturnCode() {
  const code = await encodeBoardCode(cleanBoard(state.board))
  els.codeOutput.value = code
  els.codeInput.value = code
  updateCodeUrl(code)
  return code
}

function recordHistory() {
  pushHistory(state)
  updateHistoryButtons()
}

function undo() {
  if (!undoHistory(state)) return
  restoreCurrentState()
  showStatus('已撤销')
}

function redo() {
  if (!redoHistory(state)) return
  restoreCurrentState()
  showStatus('已重做')
}

function restoreCurrentState() {
  els.boardName.value = state.board.name ?? ''
  renderBackgroundOptions()
  renderAll()
  updateHistoryButtons()
}

function updateHistoryButtons() {
  els.undo.disabled = state.history.length === 0
  els.redo.disabled = state.future.length === 0
}

function updateSelectionActions() {
  const object = getSelected()
  const hasSelection = Boolean(object)
  els.clearBoard.disabled = state.board.objects.length === 0
  els.deleteObject.disabled = !hasSelection
  els.duplicateObject.disabled = !hasSelection
  els.centerObject.disabled = !hasSelection || Boolean(object?.locked)
  els.moveUp.disabled =
    !hasSelection || state.selectedIndex >= state.board.objects.length - 1
  els.moveDown.disabled = !hasSelection || state.selectedIndex <= 0
}

function deselect() {
  selectObject(-1)
  showStatus('已取消选择')
}

async function runAction(action, successMessage, options = {}) {
  if (state.actionRunning) return
  state.actionRunning = true
  setAsyncActionsDisabled(true)
  if (options.busyMessage) {
    showStatus(options.busyMessage)
  }
  try {
    await action()
    showStatus(successMessage)
  } catch (error) {
    handleError(error)
  } finally {
    state.actionRunning = false
    setAsyncActionsDisabled(false)
  }
}

function setAsyncActionsDisabled(disabled) {
  for (const button of [els.loadCode, els.exportCode, els.renderPreview]) {
    button.disabled = disabled
    button.setAttribute('aria-busy', String(disabled))
  }
  for (const control of [
    els.background,
    els.boardName,
    els.localBoardSelect,
    els.saveLocalBoard,
    els.loadLocalBoard,
    els.deleteLocalBoard,
  ]) {
    control.disabled = disabled
  }
}

function handleError(error) {
  console.error(error)
  showStatus(error.message ?? '操作失败', { type: 'error' })
}

function showStatus(message, options = {}) {
  clearTimeout(state.statusTimer)
  els.status.textContent = message
  els.status.classList.toggle('error', options.type === 'error')
  els.status.classList.add('visible')
  state.statusTimer = window.setTimeout(() => {
    els.status.classList.remove('visible')
  }, 2200)
}

function persistBoard() {
  persistSavedBoard(cleanBoard(state.board))
}

function updateCodeUrl(code) {
  const url = new URL(window.location.href)
  url.searchParams.set('code', code)
  window.history.replaceState(null, '', url)
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
