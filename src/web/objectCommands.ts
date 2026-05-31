import { clamp } from './geometry.js'
import { MAX_BOARD_OBJECTS } from './constants.js'
import { createEditorId } from './editorIds.js'
import { getSelectedIndexes } from './editorState.js'
import { getDefaultObjectColor } from '../shared/boardGeometry.js'
import {
  BOARD_BOUNDS,
  getConstrainedObjectsMoveDelta,
  moveObjectBy,
  moveObjectsBy,
} from './objectMovement.js'
import {
  appendObjectLayerNode,
  groupObjectIds,
  moveLayerNodeAfter,
  moveLayerNodeBefore,
  moveLayerNodeIntoGroup,
  moveLayerNodeToRoot,
  removeObjectLayerNodes,
  renameGroup,
  syncBoardOrderFromLayerTree,
  syncFlatLayerTree,
  toggleGroupFlag,
  toggleGroupCollapsed,
  ungroupLayer,
} from './layerTree.js'
import {
  getBoundsCenterX,
  getBoundsCenterY,
  getObjectBounds,
  getSelectionBounds,
} from './objectAlignment.js'
import type {
  Alignment,
  BoardObject,
  Bounds,
  EditorContext,
  EditorState,
  LayerFlag,
  LayerNode,
  LayerNodeRef,
  ObjectCommands,
} from './types.js'

interface ObjectCommandsDeps {
  state: EditorState
  recordHistory: () => void
  renderAll: () => void
  selectObject: EditorContext['selectObject']
  getSelected: () => BoardObject | undefined
  getSelectedList: () => BoardObject[]
  normalizePoint: EditorContext['normalizePoint']
  showStatus: (message: string) => void
  confirmAction: (message: string) => boolean
}

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

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
}: ObjectCommandsDeps): ObjectCommands {
  return {
    addObject(type: string) {
      if (!canAddObjects(state, 1, showStatus)) return
      recordHistory()
      const object = createDefaultObject(type)
      state.board.objects.push(object)
      appendObjectLayerNode(state.layerTree, object.editorId)
      selectObject(state.board.objects.length - 1)
    },

    addObjectAt(type: string, point: { x: number, y: number }) {
      if (!canAddObjects(state, 1, showStatus)) return
      recordHistory()
      const object = createDefaultObject(type, normalizePoint(point.x, point.y))
      state.board.objects.push(object)
      appendObjectLayerNode(state.layerTree, object.editorId)
      selectObject(state.board.objects.length - 1)
    },

    toggleLayerFlag(index: number, key: LayerFlag) {
      const object = state.board.objects[index]
      if (!object) return
      recordHistory()
      object[key] = object[key] ? undefined : true
      state.selectedIndex = index
      state.selectedIndexes = [index]
      renderAll()
    },

    toggleLayerGroupFlag(groupId: string, key: LayerFlag) {
      if (!canMutateLayerTree(state, (layerTree) => toggleGroupFlag(layerTree, groupId, key))) return
      recordHistory()
      const result = toggleGroupFlag(state.layerTree, groupId, key)
      if (!result) return
      const affectedIds = new Set(result.objectIds)
      for (const object of state.board.objects) {
        if (object.editorId && affectedIds.has(object.editorId)) {
          object[key] = result.active || undefined
        }
      }
      state.selectedGroupId = groupId
      renderAll()
    },

    toggleSelectedLayerFlag(key: LayerFlag) {
      const selectedObjects = getSelectedList()
      if (selectedObjects.length === 0) return
      const shouldEnable = selectedObjects.some((object) => !object[key])
      recordHistory()
      for (const object of selectedObjects) {
        object[key] = shouldEnable || undefined
      }
      renderAll()
    },

    deleteSelected() {
      const selectedIndexes = getSelectedIndexes(state)
      if (selectedIndexes.length === 0) return
      recordHistory()
      const object = getSelected()
      const selectedIds = selectedIndexes
        .map((index) => state.board.objects[index]?.editorId)
        .filter((id): id is string => Boolean(id))
      for (const index of [...selectedIndexes].sort((a, b) => b - a)) {
        state.board.objects.splice(index, 1)
      }
      removeObjectLayerNodes(state.layerTree, selectedIds)
      state.selectedIndex = -1
      state.selectedIndexes = []
      state.selectedGroupId = ''
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
      syncFlatLayerTree(state)
      state.selectedIndex = -1
      state.selectedIndexes = []
      state.selectedGroupId = ''
      renderAll()
      showStatus('已清空画板')
    },

    duplicateSelected() {
      const object = getSelected()
      if (!object) return
      if (!canAddObjects(state, 1, showStatus)) return
      recordHistory()
      const copy = createPastedObject(object)
      state.board.objects.push(copy)
      appendObjectLayerNode(state.layerTree, copy.editorId)
      selectObject(state.board.objects.length - 1)
    },

    moveSelected(delta: number) {
      const index = state.selectedIndex
      const target = index + delta
      if (index < 0 || target < 0 || target >= state.board.objects.length) return
      moveSelectedToIndex(index, target, state, recordHistory, selectObject)
    },

    moveSelectedTo(target: number) {
      const index = state.selectedIndex
      if (index < 0 || target < 0 || target >= state.board.objects.length) return
      moveSelectedToIndex(index, target, state, recordHistory, selectObject)
    },

    getLastLayerIndex() {
      return state.board.objects.length - 1
    },

    reorderLayer(fromIndex: number, toIndex: number) {
      if (
        fromIndex === toIndex
        || fromIndex < 0
        || toIndex < 0
        || fromIndex >= state.board.objects.length
        || toIndex >= state.board.objects.length
      ) return
      const object = state.board.objects[fromIndex]
      const target = state.board.objects[toIndex]
      if (!object || !target) return
      if (!object.editorId || !target.editorId) return
      const dragged = { type: 'object' as const, id: object.editorId }
      const targetNode = {
        type: 'object',
        id: target.editorId,
      } as const
      if (!canMutateLayerTree(state, (layerTree) =>
        moveLayerNodeBefore(layerTree, dragged, targetNode))) return
      recordHistory()
      const moved = moveLayerNodeBefore(state.layerTree, dragged, targetNode)
      if (!moved) return
      syncBoardOrderFromLayerTree(state)
      renderAll()
      showStatus('已调整图层顺序')
    },

    moveLayerNodeBefore(dragged: LayerNodeRef, target: LayerNodeRef) {
      if (!canMutateLayerTree(state, (layerTree) =>
        moveLayerNodeBefore(layerTree, dragged, target))) return
      recordHistory()
      if (!moveLayerNodeBefore(state.layerTree, dragged, target)) return
      syncBoardOrderFromLayerTree(state)
      renderAll()
      showStatus('已调整图层顺序')
    },

    moveLayerNodeAfter(dragged: LayerNodeRef, target: LayerNodeRef) {
      if (!canMutateLayerTree(state, (layerTree) =>
        moveLayerNodeAfter(layerTree, dragged, target))) return
      recordHistory()
      if (!moveLayerNodeAfter(state.layerTree, dragged, target)) return
      syncBoardOrderFromLayerTree(state)
      renderAll()
      showStatus('已调整图层顺序')
    },

    moveLayerNodeIntoGroup(dragged: LayerNodeRef, groupId: string) {
      if (!canMutateLayerTree(state, (layerTree) =>
        moveLayerNodeIntoGroup(layerTree, dragged, groupId))) return
      recordHistory()
      if (!moveLayerNodeIntoGroup(state.layerTree, dragged, groupId)) return
      syncBoardOrderFromLayerTree(state)
      renderAll()
      showStatus('已移动到组内')
    },

    moveLayerNodeToRoot(dragged: LayerNodeRef) {
      if (!canMutateLayerTree(state, (layerTree) =>
        moveLayerNodeToRoot(layerTree, dragged))) return
      recordHistory()
      if (!moveLayerNodeToRoot(state.layerTree, dragged)) return
      syncBoardOrderFromLayerTree(state)
      renderAll()
      showStatus('已移动到根层级')
    },

    groupSelected() {
      const selectedIndexes = getSelectedIndexes(state)
      if (selectedIndexes.length < 2) return
      const selectedIds = selectedIndexes
        .map((index) => state.board.objects[index]?.editorId)
        .filter((id): id is string => Boolean(id))
      const groupName = `组 ${Date.now().toString(36).slice(-4)}`
      if (!canMutateLayerTree(state, (layerTree) =>
        groupObjectIds(layerTree, selectedIds, groupName))) return
      recordHistory()
      const group = groupObjectIds(
        state.layerTree,
        selectedIds,
        groupName,
      )
      if (!group) return
      state.selectedGroupId = group.id
      syncBoardOrderFromLayerTree(state)
      renderAll()
      showStatus(`已创建组，包含 ${selectedIds.length} 个对象`)
    },

    ungroupSelectedGroup() {
      if (!state.selectedGroupId) return
      if (!canMutateLayerTree(state, (layerTree) =>
        ungroupLayer(layerTree, state.selectedGroupId))) return
      recordHistory()
      if (!ungroupLayer(state.layerTree, state.selectedGroupId)) return
      state.selectedGroupId = ''
      syncBoardOrderFromLayerTree(state)
      renderAll()
      showStatus('已解组')
    },

    toggleLayerGroup(groupId: string) {
      if (!toggleGroupCollapsed(state.layerTree, groupId)) return
      renderAll()
    },

    renameLayerGroup(groupId: string, name: string) {
      if (!canMutateLayerTree(state, (layerTree) =>
        renameGroup(layerTree, groupId, name))) return
      recordHistory()
      if (!renameGroup(state.layerTree, groupId, name)) return
      state.selectedGroupId = groupId
      renderAll()
      showStatus('已重命名组')
    },

    alignSelected(alignment: Alignment) {
      const selectedObjects = getSelectedList()
      if (selectedObjects.length === 0) return
      const movableObjects = selectedObjects.filter((object) => object && !object.locked)
      if (movableObjects.length === 0) return
      recordHistory()
      const targetBounds = selectedObjects.length === 1
        ? BOARD_BOUNDS
        : getSelectionBounds(selectedObjects, state)
      for (const object of movableObjects) {
        const objectBounds = getObjectBounds(object, state)
        const delta = getAlignmentDelta(alignment, objectBounds, targetBounds)
        moveObjectBy(object, delta.dx, delta.dy)
      }
      renderAll()
      showStatus(movableObjects.length === 1 ? '已对齐到画布' : `已对齐 ${movableObjects.length} 个对象`)
    },

    copySelected() {
      const object = getSelected()
      if (!object) return
      state.clipboard = structuredClone(object)
      renderAll()
      showStatus(`已复制 ${object.type}`)
    },

    pasteObject() {
      if (!state.clipboard) return
      if (!canAddObjects(state, 1, showStatus)) return
      recordHistory()
      const object = createPastedObject(state.clipboard)
      state.board.objects.push(object)
      appendObjectLayerNode(state.layerTree, object.editorId)
      selectObject(state.board.objects.length - 1)
      showStatus(`已粘贴 ${object.type}`)
    },

    nudgeSelected(key: string, step: number) {
      const deltas: Record<ArrowKey, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      }
      const delta = deltas[key as ArrowKey]
      if (!delta) return
      const selectedObjects = getSelectedList().filter((object) => !object.locked)
      const primaryObject = getSelected()
      const referenceObject = primaryObject && !primaryObject.locked ? primaryObject : selectedObjects[0]
      if (!referenceObject || selectedObjects.length === 0) return
      const [dx, dy] = delta
      const point = normalizePoint(referenceObject.x + dx, referenceObject.y + dy)
      const moveDelta = getConstrainedObjectsMoveDelta(
        selectedObjects,
        state,
        point.x - referenceObject.x,
        point.y - referenceObject.y,
      )
      if (moveDelta.dx === 0 && moveDelta.dy === 0) return
      recordHistory()
      moveObjectsBy(selectedObjects, moveDelta.dx, moveDelta.dy)
      renderAll()
    },
  }
}

function canAddObjects(
  state: EditorState,
  count: number,
  showStatus: (message: string) => void,
): boolean {
  if (state.board.objects.length + count <= MAX_BOARD_OBJECTS) return true
  showStatus(`对象数量已达上限 ${MAX_BOARD_OBJECTS}`)
  return false
}

function getAlignmentDelta(alignment: Alignment, objectBounds: Bounds, selectionBounds: Bounds) {
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

function moveSelectedToIndex(
  index: number,
  target: number,
  state: EditorState,
  recordHistory: () => void,
  selectObject: EditorContext['selectObject'],
): void {
  if (index === target) return
  const object = state.board.objects[index]
  const targetObject = state.board.objects[target]
  if (!object || !targetObject) return
  if (!object.editorId || !targetObject.editorId) return
  const dragged = { type: 'object' as const, id: object.editorId }
  const targetNode = { type: 'object' as const, id: targetObject.editorId }
  const canMove = canMutateLayerTree(state, (layerTree) =>
    index < target
      ? moveLayerNodeAfter(layerTree, dragged, targetNode)
      : moveLayerNodeBefore(layerTree, dragged, targetNode))
  if (!canMove) return
  recordHistory()
  const moved = index < target
    ? moveLayerNodeAfter(state.layerTree, dragged, targetNode)
    : moveLayerNodeBefore(state.layerTree, dragged, targetNode)
  if (!moved) return
  syncBoardOrderFromLayerTree(state)
  selectObject(state.board.objects.findIndex((entry) => entry.editorId === object.editorId))
}

function canMutateLayerTree(
  state: EditorState,
  mutate: (layerTree: LayerNode[]) => unknown,
): boolean {
  return Boolean(mutate(structuredClone(state.layerTree)))
}

function createDefaultObject(type: string, point = BOARD_CENTER): BoardObject {
  const base = {
    editorId: createEditorId('obj'),
    type,
    x: point.x,
    y: point.y,
    size: 100,
    transparency: 0,
  }
  const color = getDefaultObjectColor(type)
  const coloredBase = color ? { ...base, color } : base
  if (type === 'text') return { ...coloredBase, text: '文字' }
  if (type === 'line') {
    return {
      ...coloredBase,
      endX: clamp(point.x + 64, 0, 512),
      endY: point.y,
      height: 6,
    }
  }
  if (type === 'line_aoe') return { ...coloredBase, width: 128, height: 128 }
  if (type === 'circle_aoe') return { ...base, size: 50 }
  if (type === 'fan_aoe') return { ...base, size: 50, arcAngle: 90 }
  if (type === 'donut') return { ...base, arcAngle: 360, donutRadius: 80 }
  return base
}

function createPastedObject(object: BoardObject): BoardObject {
  const copy = structuredClone(object)
  copy.editorId = createEditorId('obj')
  copy.x = clamp((copy.x ?? BOARD_CENTER.x) + PASTE_OFFSET, 0, 512)
  copy.y = clamp((copy.y ?? BOARD_CENTER.y) + PASTE_OFFSET, 0, 384)
  if (copy.type === 'line' && copy.endX !== undefined && copy.endY !== undefined) {
    copy.endX = clamp(copy.endX + PASTE_OFFSET, 0, 512)
    copy.endY = clamp(copy.endY + PASTE_OFFSET, 0, 384)
  }
  return copy
}
