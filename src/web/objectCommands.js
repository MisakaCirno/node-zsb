import { clamp } from './geometry.js'

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

    toggleLayerFlag(index, key) {
      const object = state.board.objects[index]
      if (!object) return
      recordHistory()
      object[key] = object[key] ? undefined : true
      state.selectedIndex = index
      renderAll()
    },

    deleteSelected() {
      if (state.selectedIndex < 0) return
      recordHistory()
      const object = getSelected()
      state.board.objects.splice(state.selectedIndex, 1)
      state.selectedIndex = -1
      renderAll()
      showStatus(`已删除 ${object?.type ?? '对象'}`)
    },

    clearBoard() {
      if (state.board.objects.length === 0) return
      if (!confirmAction('清空当前画板上的所有对象？')) return
      recordHistory()
      state.board.objects = []
      state.selectedIndex = -1
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
      recordHistory()
      const [object] = state.board.objects.splice(index, 1)
      state.board.objects.splice(target, 0, object)
      selectObject(target)
    },

    centerSelected() {
      const object = getSelected()
      if (!object || object.locked) return
      recordHistory()
      const oldX = object.x
      const oldY = object.y
      object.x = BOARD_CENTER.x
      object.y = BOARD_CENTER.y
      if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
        object.endX = clamp(Math.round(object.endX + object.x - oldX), 0, 512)
        object.endY = clamp(Math.round(object.endY + object.y - oldY), 0, 384)
      }
      renderAll()
      showStatus('已居中选中对象')
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
      object.x = point.x
      object.y = point.y
      if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
        object.endX = clamp(Math.round(object.endX + dx), 0, 512)
        object.endY = clamp(Math.round(object.endY + dy), 0, 384)
      }
      renderAll()
    },
  }
}

function createDefaultObject(type) {
  const base = {
    type,
    x: BOARD_CENTER.x,
    y: BOARD_CENTER.y,
    size: 100,
    color: '#ff8000',
    transparency: 0,
  }
  if (type === 'text') return { ...base, text: '文字', color: '#ffffff' }
  if (type === 'line') return { ...base, endX: 320, endY: BOARD_CENTER.y, height: 6 }
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
