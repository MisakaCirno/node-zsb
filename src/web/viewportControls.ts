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
import type {
  EditorElements,
  EditorSettings,
  EditorState,
  GridRenderer,
  StageLike,
  StageZoomOptions,
  ViewportControls,
} from './types.js'

const MIN_ZOOM = ZOOM_LEVELS[0]
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 2

export function createViewportControls({
  state,
  elements,
  stage,
  stageRenderer,
  showStatus,
}: {
  state: EditorState
  elements: EditorElements
  stage: StageLike
  stageRenderer: GridRenderer
  showStatus: (message: string) => void
}): ViewportControls {
  function applyFitZoom(options: StageZoomOptions = {}) {
    const styles = elements.stageHost.ownerDocument.defaultView?.getComputedStyle(elements.stageHost)
    if (!styles) return
    const horizontalPadding =
      Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
    const verticalPadding =
      Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    const availableWidth = Math.max(0, elements.stageHost.clientWidth - horizontalPadding)
    const availableHeight = Math.max(0, elements.stageHost.clientHeight - verticalPadding)
    const zoom = Math.min(1, availableWidth / SCENE_WIDTH, availableHeight / SCENE_HEIGHT)
    setStageZoom(zoom, { mode: 'fit', ...options })
  }

  function stepZoom(direction: number) {
    const current = state.zoom
    const target =
      direction > 0
        ? ZOOM_LEVELS.find((level) => level > current + 0.01) ?? ZOOM_LEVELS.at(-1)
        : ZOOM_LEVELS.findLast((level) => level < current - 0.01) ?? ZOOM_LEVELS[0]
    setStageZoom(target ?? 1, { mode: 'manual' })
  }

  function setStageZoom(zoom: number, options: StageZoomOptions = {}) {
    const nextZoom = clamp(Number.isFinite(zoom) ? zoom : 1, MIN_ZOOM, MAX_ZOOM)
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
    elements.zoomOut.disabled = state.zoom <= MIN_ZOOM
    elements.zoomIn.disabled = state.zoom >= MAX_ZOOM
  }

  function setGridDensity(gridSize: number, options: StageZoomOptions = {}) {
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

  function setGridOpacity(gridOpacity: number, options: StageZoomOptions = {}) {
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
    const settings = loadEditorSettings() as Partial<EditorSettings> | null
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

  function applyInitialZoom(options: StageZoomOptions = {}) {
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

  function applySettings(settings: Partial<EditorSettings>) {
    state.snapToGrid = Boolean(settings.snapToGrid)
    state.showGrid = Boolean(settings.showGrid)
    state.zoom = clamp(Number(settings.zoom) || 1, MIN_ZOOM, MAX_ZOOM)
    state.zoomMode = settings.zoomMode === 'manual' ? 'manual' : 'fit'
    elements.snap.checked = state.snapToGrid
    elements.grid.checked = state.showGrid
    setGridDensity(settings.gridSize ?? DEFAULT_GRID_SIZE, { render: false, silent: true })
    setGridOpacity(settings.gridOpacity ?? DEFAULT_GRID_OPACITY, { render: false, silent: true })
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

function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}
