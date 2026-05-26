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
import { getGroupObjectIds } from './layerTree.js'

export function createEditorContext({
  renderAll,
  showStatus,
  state,
}) {
  function selectObject(index, options = {}) {
    if (index < 0) {
      setSelection([])
      state.selectedGroupId = ''
      state.revealSelectedLayer = false
      renderAll()
      return
    }
    if (options.range) {
      const anchor = state.selectedIndex >= 0
        ? state.selectedIndex
        : getSelectedIndexes(state).at(0)
      const next = anchor === undefined
        ? [index]
        : createIndexRange(anchor, index)
      setSelection(next, index)
      state.selectedGroupId = ''
      state.revealSelectedLayer = Boolean(options.revealInLayers)
      renderAll()
      return
    }
    if (options.toggle) {
      const selected = getSelectedIndexes(state)
      const next = selected.includes(index)
        ? selected.filter((selectedIndex) => selectedIndex !== index)
        : [...selected, index]
      setSelection(next, index)
      state.selectedGroupId = ''
      state.revealSelectedLayer = Boolean(options.revealInLayers)
      renderAll()
      return
    }
    setSelection([index], index)
    state.selectedGroupId = ''
    state.revealSelectedLayer = Boolean(options.revealInLayers)
    renderAll()
  }

  function selectObjects(indexes, options = {}) {
    setSelection(indexes, options.primaryIndex ?? indexes.at(-1) ?? -1)
    state.selectedGroupId = ''
    state.revealSelectedLayer = Boolean(options.revealInLayers)
    renderAll()
  }

  function selectLayerGroup(groupId) {
    const ids = getGroupObjectIds(state.layerTree, groupId)
    const indexById = new Map(state.board.objects.map((object, index) => [object.editorId, index]))
    setSelection(ids.map((id) => indexById.get(id)).filter((index) => index !== undefined))
    state.selectedGroupId = groupId
    state.revealSelectedLayer = false
    renderAll()
  }

  function setMarqueeSelectionMode(mode) {
    state.marqueeSelectionMode = mode === 'intersect' ? 'intersect' : 'contained'
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
    selectLayerGroup,
    selectObjects,
    setMarqueeSelectionMode,
  }
}

function createIndexRange(start, end) {
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  return Array.from({ length: max - min + 1 }, (_, offset) => min + offset)
}
