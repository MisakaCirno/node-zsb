import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
  ZOOM_LEVELS,
} from './constants.js'
import { clamp } from './geometry.js'

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
    elements.zoomSelect.value = String(state.zoom)
    elements.zoomValue.textContent =
      state.zoomMode === 'fit' ? `适配 ${formatZoom(state.zoom)}` : formatZoom(state.zoom)
  }

  function toggleSnapToGrid() {
    state.snapToGrid = elements.snap.checked
    showStatus(state.snapToGrid ? '已开启网格吸附' : '已关闭网格吸附')
  }

  function toggleGrid() {
    state.showGrid = elements.grid.checked
    stageRenderer.renderGrid()
    showStatus(state.showGrid ? '已显示辅助网格' : '已隐藏辅助网格')
  }

  function applyFitZoomOnResize() {
    if (state.zoomMode === 'fit') {
      applyFitZoom({ silent: true })
    }
  }

  return {
    applyFitZoom,
    applyFitZoomOnResize,
    setStageZoom,
    stepZoom,
    toggleGrid,
    toggleSnapToGrid,
  }
}

function formatZoom(zoom) {
  return `${Math.round(zoom * 100)}%`
}
