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
import type {
  EditorContext,
  EditorState,
  SelectionOptions,
} from './types.js'

export function createEditorContext({
  renderAll,
  showStatus,
  state,
}: {
  renderAll: () => void
  showStatus: (message: string) => void
  state: EditorState
}): EditorContext {
  function selectObject(index: number, options: SelectionOptions = {}) {
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

  function selectObjects(indexes: number[], options: SelectionOptions = {}) {
    setSelection(indexes, options.primaryIndex ?? indexes.at(-1) ?? -1)
    state.selectedGroupId = ''
    state.revealSelectedLayer = Boolean(options.revealInLayers)
    renderAll()
  }

  function selectLayerGroup(groupId: string) {
    const ids = getGroupObjectIds(state.layerTree, groupId)
    const indexById = new Map(state.board.objects.map((object, index) => [object.editorId, index]))
    setSelection(ids.map((id) => indexById.get(id)).filter((index): index is number => index !== undefined))
    state.selectedGroupId = state.selectedIndexes.length > 0 ? groupId : ''
    state.revealSelectedLayer = false
    renderAll()
  }

  function deselect() {
    setSelection([])
    state.selectedGroupId = ''
    state.revealSelectedLayer = false
    renderAll()
    showStatus('已取消选择')
  }

  function getSelected() {
    return getSelectedObject(state)
  }

  function getSelectedList() {
    return getSelectedObjects(state)
  }

  function setSelection(indexes: number[], primaryIndex = indexes.at(-1) ?? -1) {
    const unique = [...new Set(indexes)]
      .filter((selectedIndex) =>
        selectedIndex >= 0
        && selectedIndex < state.board.objects.length
        && !state.board.objects[selectedIndex]?.locked)
    state.selectedIndexes = unique
    state.selectedIndex = unique.includes(primaryIndex)
      ? primaryIndex
      : unique.at(-1) ?? -1
  }

  function normalizePoint(x: number, y: number) {
    return normalizePointValue(x, y, getSnapStep())
  }

  function normalizeCoordinate(value: number, min: number, max: number) {
    return normalizeCoordinateValue(value, min, max, getSnapStep())
  }

  function getSnapStep() {
    return state.snapToGrid ? state.gridSize : 0
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
  }
}

function createIndexRange(start: number, end: number): number[] {
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  return Array.from({ length: max - min + 1 }, (_, offset) => min + offset)
}
