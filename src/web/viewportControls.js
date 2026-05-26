import {
  DEFAULT_GRID_OPACITY,
  DEFAULT_GRID_SIZE,
  GRID_OPACITY_STEP,
  GRID_SIZE_STEP,
  MAX_GRID_OPACITY,
  MAX_GRID_SIZE,
  MIN_GRID_OPACITY,
  MIN_GRID_SIZE,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  ZOOM_LEVELS,
} from './constants.js'
import { clamp } from './geometry.js'
import { loadEditorSettings, persistEditorSettings } from './storage.js'

export function createViewportControls({
  state,
  elements,
  stage,
  stageRenderer,
  showStatus,
}) {
  function applyFitZoom(options = {}) {
    const styles = getComputedStyle(elements.stageHost)
    const horizontalPadding =
      Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
    const verticalPadding =
      Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    const availableWidth = Math.max(0, elements.stageHost.clientWidth - horizontalPadding)
    const availableHeight = Math.max(0, elements.stageHost.clientHeight - verticalPadding)
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
    const nextZoom = clamp(Number.isFinite(zoom) ? zoom : 1, ZOOM_LEVELS[0], ZOOM_LEVELS.at(-1))
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
    if (!options.silent && options.persist !== false) {
      persistViewportSettings()
    }
  }

  function updateZoomControls() {
    elements.zoomSelect.value = String(state.zoom)
    elements.zoomValue.textContent =
      state.zoomMode === 'fit' ? `适配 ${formatZoom(state.zoom)}` : formatZoom(state.zoom)
    elements.zoomOut.disabled = state.zoom <= ZOOM_LEVELS[0]
    elements.zoomIn.disabled = state.zoom >= ZOOM_LEVELS.at(-1)
  }

  function setGridDensity(gridSize, options = {}) {
    const snapped = Math.round((Number(gridSize) || MIN_GRID_SIZE) / GRID_SIZE_STEP) * GRID_SIZE_STEP
    state.gridSize = clamp(snapped, MIN_GRID_SIZE, MAX_GRID_SIZE)
    updateGridDensityControls()
    if (options.render !== false) {
      stageRenderer.renderGrid()
    }
    if (!options.silent) {
      showStatus(`已设置网格间距 ${state.gridSize}px`)
    }
    if (!options.silent && options.persist !== false) {
      persistViewportSettings()
    }
  }

  function setGridOpacity(gridOpacity, options = {}) {
    const snapped =
      Math.round((Number(gridOpacity) || DEFAULT_GRID_OPACITY) / GRID_OPACITY_STEP)
      * GRID_OPACITY_STEP
    state.gridOpacity = Number(clamp(snapped, MIN_GRID_OPACITY, MAX_GRID_OPACITY).toFixed(2))
    updateGridOpacityControls()
    if (options.render !== false) {
      stageRenderer.renderGrid()
    }
    if (!options.silent) {
      showStatus(`已设置网格不透明度 ${formatPercent(state.gridOpacity)}`)
    }
    if (!options.silent && options.persist !== false) {
      persistViewportSettings()
    }
  }

  function updateGridDensityControls() {
    elements.gridDensity.value = String(state.gridSize)
    elements.gridDensityValue.textContent = `${state.gridSize}px`
  }

  function updateGridOpacityControls() {
    elements.gridOpacity.value = String(state.gridOpacity)
    elements.gridOpacityValue.textContent = formatPercent(state.gridOpacity)
  }

  function toggleSnapToGrid() {
    state.snapToGrid = elements.snap.checked
    persistViewportSettings()
    showStatus(state.snapToGrid ? '已开启网格吸附' : '已关闭网格吸附')
  }

  function toggleGrid() {
    state.showGrid = elements.grid.checked
    stageRenderer.renderGrid()
    persistViewportSettings()
    showStatus(state.showGrid ? '已显示辅助网格' : '已隐藏辅助网格')
  }

  function syncControlStateFromDom() {
    const settings = loadEditorSettings()
    if (settings) {
      applySettings(settings)
      return
    }
    applySettings({
      snapToGrid: elements.snap.checked,
      showGrid: elements.grid.checked,
      gridSize: Number(elements.gridDensity.value) || DEFAULT_GRID_SIZE,
      gridOpacity: Number(elements.gridOpacity.value) || DEFAULT_GRID_OPACITY,
      zoom: state.zoom,
      zoomMode: state.zoomMode,
    })
  }

  function applyInitialZoom(options = {}) {
    if (state.zoomMode === 'manual') {
      setStageZoom(state.zoom, { mode: 'manual', persist: false, ...options })
      return
    }
    applyFitZoom({ persist: false, ...options })
  }

  function applyFitZoomOnResize() {
    if (state.zoomMode === 'fit') {
      applyFitZoom({ silent: true })
    }
  }

  return {
    applyInitialZoom,
    applyFitZoom,
    applyFitZoomOnResize,
    setGridDensity,
    setGridOpacity,
    setStageZoom,
    stepZoom,
    syncControlStateFromDom,
    toggleGrid,
    toggleSnapToGrid,
  }

  function applySettings(settings) {
    state.snapToGrid = Boolean(settings.snapToGrid)
    state.showGrid = Boolean(settings.showGrid)
    state.zoom = clamp(Number(settings.zoom) || 1, ZOOM_LEVELS[0], ZOOM_LEVELS.at(-1))
    state.zoomMode = settings.zoomMode === 'manual' ? 'manual' : 'fit'
    elements.snap.checked = state.snapToGrid
    elements.grid.checked = state.showGrid
    setGridDensity(settings.gridSize, { render: false, silent: true })
    setGridOpacity(settings.gridOpacity, { render: false, silent: true })
  }

  function persistViewportSettings() {
    persistEditorSettings({
      snapToGrid: state.snapToGrid,
      showGrid: state.showGrid,
      gridSize: state.gridSize,
      gridOpacity: state.gridOpacity,
      zoom: state.zoom,
      zoomMode: state.zoomMode,
    })
  }
}

function formatZoom(zoom) {
  return `${Math.round(zoom * 100)}%`
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`
}
