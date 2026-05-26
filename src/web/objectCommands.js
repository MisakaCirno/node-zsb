import { clamp } from './geometry.js'
import { getSelectedIndexes } from './editorState.js'
import {
  getBoundsCenterX,
  getBoundsCenterY,
  getObjectBounds,
  getSelectionBounds,
} from './objectAlignment.js'

const PASTE_OFFSET = 18
const BOARD_CENTER = {
  x: 256,
  y: 192,
}

export function createObjectCommands({
  state,
  recordHistory,
  renderAll,
  selectObject,
  getSelected,
  getSelectedList,
  normalizePoint,
  showStatus,
  confirmAction,
}) {
  return {
    addObject(type) {
      recordHistory()
      const object = createDefaultObject(type)
      state.board.objects.push(object)
      selectObject(state.board.objects.length - 1)
    },

    addObjectAt(type, point) {
      recordHistory()
      const object = createDefaultObject(type, point)
      state.board.objects.push(object)
      selectObject(state.board.objects.length - 1)
    },

    toggleLayerFlag(index, key) {
      const object = state.board.objects[index]
      if (!object) return
      recordHistory()
      object[key] = object[key] ? undefined : true
      state.selectedIndex = index
      state.selectedIndexes = [index]
      renderAll()
    },

    toggleSelectedLayerFlag(key) {
      const index = state.selectedIndex
      const object = state.board.objects[index]
      if (!object) return
      recordHistory()
      object[key] = object[key] ? undefined : true
      renderAll()
    },

    deleteSelected() {
      const selectedIndexes = getSelectedIndexes(state)
      if (selectedIndexes.length === 0) return
      recordHistory()
      const object = getSelected()
      for (const index of [...selectedIndexes].sort((a, b) => b - a)) {
        state.board.objects.splice(index, 1)
      }
      state.selectedIndex = -1
      state.selectedIndexes = []
      renderAll()
      showStatus(selectedIndexes.length > 1
        ? `已删除 ${selectedIndexes.length} 个对象`
        : `已删除 ${object?.type ?? '对象'}`)
    },

    clearBoard() {
      if (state.board.objects.length === 0) return
      if (!confirmAction('清空当前画板上的所有对象？')) return
      recordHistory()
      state.board.objects = []
      state.selectedIndex = -1
      state.selectedIndexes = []
      renderAll()
      showStatus('已清空画板')
    },

    duplicateSelected() {
      const object = getSelected()
      if (!object) return
      recordHistory()
      const copy = createPastedObject(object)
      state.board.objects.push(copy)
      selectObject(state.board.objects.length - 1)
    },

    moveSelected(delta) {
      const index = state.selectedIndex
      const target = index + delta
      if (index < 0 || target < 0 || target >= state.board.objects.length) return
      moveSelectedToIndex(index, target, state, recordHistory, selectObject)
    },

    moveSelectedTo(target) {
      const index = state.selectedIndex
      if (index < 0 || target < 0 || target >= state.board.objects.length) return
      moveSelectedToIndex(index, target, state, recordHistory, selectObject)
    },

    getLastLayerIndex() {
      return state.board.objects.length - 1
    },

    reorderLayer(fromIndex, toIndex) {
      if (
        fromIndex === toIndex
        || fromIndex < 0
        || toIndex < 0
        || fromIndex >= state.board.objects.length
        || toIndex >= state.board.objects.length
      ) return
      recordHistory()
      const [object] = state.board.objects.splice(fromIndex, 1)
      state.board.objects.splice(toIndex, 0, object)
      state.selectedIndexes = state.selectedIndexes.map((index) =>
        mapMovedIndex(index, fromIndex, toIndex))
      state.selectedIndex = mapMovedIndex(state.selectedIndex, fromIndex, toIndex)
      renderAll()
      showStatus('已调整图层顺序')
    },

    centerSelected() {
      const selectedIndexes = getSelectedIndexes(state)
      const selectedObjects = selectedIndexes.map((index) => state.board.objects[index])
      const movableObjects = selectedObjects.filter((object) => object && !object.locked)
      if (movableObjects.length === 0) return
      recordHistory()
      if (movableObjects.length === 1) {
        const object = movableObjects[0]
        moveObjectBy(object, BOARD_CENTER.x - object.x, BOARD_CENTER.y - object.y)
      } else {
        const bounds = getSelectionBounds(selectedObjects, state)
        const dx = BOARD_CENTER.x - getBoundsCenterX(bounds)
        const dy = BOARD_CENTER.y - getBoundsCenterY(bounds)
        for (const object of movableObjects) {
          moveObjectBy(object, dx, dy)
        }
      }
      renderAll()
      showStatus(movableObjects.length > 1 ? '已居中选中对象组' : '已居中选中对象')
    },

    alignSelected(alignment) {
      const selectedObjects = getSelectedList()
      if (selectedObjects.length < 2) return
      const movableObjects = selectedObjects.filter((object) => object && !object.locked)
      if (movableObjects.length === 0) return
      recordHistory()
      const selectionBounds = getSelectionBounds(selectedObjects, state)
      for (const object of movableObjects) {
        const objectBounds = getObjectBounds(object, state)
        const delta = getAlignmentDelta(alignment, objectBounds, selectionBounds)
        moveObjectBy(object, delta.dx, delta.dy)
      }
      renderAll()
      showStatus(`已对齐 ${movableObjects.length} 个对象`)
    },

    copySelected() {
      const object = getSelected()
      if (!object) return
      state.clipboard = structuredClone(object)
      showStatus(`已复制 ${object.type}`)
    },

    pasteObject() {
      if (!state.clipboard) return
      recordHistory()
      const object = createPastedObject(state.clipboard)
      state.board.objects.push(object)
      selectObject(state.board.objects.length - 1)
      showStatus(`已粘贴 ${object.type}`)
    },

    nudgeSelected(key, step) {
      const object = getSelected()
      if (!object || object.locked) return
      const delta = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      }[key]
      if (!delta) return
      recordHistory()
      const [dx, dy] = delta
      const point = normalizePoint(object.x + dx, object.y + dy)
      moveObjectBy(object, point.x - object.x, point.y - object.y)
      renderAll()
    },
  }
}

function getAlignmentDelta(alignment, objectBounds, selectionBounds) {
  switch (alignment) {
    case 'left':
      return { dx: selectionBounds.left - objectBounds.left, dy: 0 }
    case 'center-x':
      return { dx: getBoundsCenterX(selectionBounds) - getBoundsCenterX(objectBounds), dy: 0 }
    case 'right':
      return { dx: selectionBounds.right - objectBounds.right, dy: 0 }
    case 'top':
      return { dx: 0, dy: selectionBounds.top - objectBounds.top }
    case 'center-y':
      return { dx: 0, dy: getBoundsCenterY(selectionBounds) - getBoundsCenterY(objectBounds) }
    case 'bottom':
      return { dx: 0, dy: selectionBounds.bottom - objectBounds.bottom }
    default:
      return { dx: 0, dy: 0 }
  }
}

function moveObjectBy(object, dx, dy) {
  object.x = clamp(Math.round(object.x + dx), 0, 512)
  object.y = clamp(Math.round(object.y + dy), 0, 384)
  if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
    object.endX = clamp(Math.round(object.endX + dx), 0, 512)
    object.endY = clamp(Math.round(object.endY + dy), 0, 384)
  }
}

function moveSelectedToIndex(index, target, state, recordHistory, selectObject) {
  if (index === target) return
  recordHistory()
  const [object] = state.board.objects.splice(index, 1)
  state.board.objects.splice(target, 0, object)
  selectObject(target)
}

function mapMovedIndex(index, fromIndex, toIndex) {
  if (index === fromIndex) return toIndex
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return index + 1
  return index
}

function createDefaultObject(type, point = BOARD_CENTER) {
  const base = {
    type,
    x: point.x,
    y: point.y,
    size: 100,
    color: '#ff8000',
    transparency: 0,
  }
  if (type === 'text') return { ...base, text: '文字', color: '#ffffff' }
  if (type === 'line') {
    return {
      ...base,
      endX: clamp(point.x + 64, 0, 512),
      endY: point.y,
      height: 6,
    }
  }
  if (type === 'line_aoe') return { ...base, width: 128, height: 128 }
  if (type === 'fan_aoe') return { ...base, arcAngle: 90 }
  if (type === 'donut') return { ...base, donutRadius: 80 }
  return base
}

function createPastedObject(object) {
  const copy = structuredClone(object)
  copy.x = clamp((copy.x ?? BOARD_CENTER.x) + PASTE_OFFSET, 0, 512)
  copy.y = clamp((copy.y ?? BOARD_CENTER.y) + PASTE_OFFSET, 0, 384)
  if (copy.type === 'line' && copy.endX !== undefined && copy.endY !== undefined) {
    copy.endX = clamp(copy.endX + PASTE_OFFSET, 0, 512)
    copy.endY = clamp(copy.endY + PASTE_OFFSET, 0, 384)
  }
  return copy
}
