import { SNAP_STEP } from './constants.js'
import {
  normalizeCoordinate as normalizeCoordinateValue,
  normalizePoint as normalizePointValue,
} from './geometry.js'
import { getSelectedObject } from './editorState.js'

export function createEditorContext({
  renderAll,
  showStatus,
  state,
}) {
  function selectObject(index) {
    state.selectedIndex = index
    renderAll()
  }

  function deselect() {
    selectObject(-1)
    showStatus('已取消选择')
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

  return {
    deselect,
    getSelected,
    getSnapStep,
    normalizeCoordinate,
    normalizePoint,
    selectObject,
  }
}
