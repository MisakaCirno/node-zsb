import { SNAP_STEP } from './constants.js'
import {
  normalizeCoordinate as normalizeCoordinateValue,
  normalizePoint as normalizePointValue,
} from './geometry.js'
import {
  getSelectedIndexes,
  getSelectedObject,
  getSelectedObjects,
} from './editorState.js'

export function createEditorContext({
  renderAll,
  showStatus,
  state,
}) {
  function selectObject(index, options = {}) {
    if (index < 0) {
      setSelection([])
      renderAll()
      return
    }
    if (options.toggle) {
      const selected = getSelectedIndexes(state)
      const next = selected.includes(index)
        ? selected.filter((selectedIndex) => selectedIndex !== index)
        : [...selected, index]
      setSelection(next, index)
      renderAll()
      return
    }
    setSelection([index], index)
    renderAll()
  }

  function deselect() {
    setSelection([])
    renderAll()
    showStatus('已取消选择')
  }

  function getSelected() {
    return getSelectedObject(state)
  }

  function getSelectedList() {
    return getSelectedObjects(state)
  }

  function setSelection(indexes, primaryIndex = indexes.at(-1) ?? -1) {
    const unique = [...new Set(indexes)]
      .filter((selectedIndex) =>
        selectedIndex >= 0 && selectedIndex < state.board.objects.length)
    state.selectedIndexes = unique
    state.selectedIndex = unique.includes(primaryIndex)
      ? primaryIndex
      : unique.at(-1) ?? -1
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
    getSelectedList,
    getSnapStep,
    normalizeCoordinate,
    normalizePoint,
    selectObject,
  }
}
