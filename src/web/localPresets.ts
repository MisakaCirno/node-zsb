import { sanitizeObject } from './board.js'
import { MAX_BOARD_OBJECTS } from './constants.js'
import { createEditorId } from './editorIds.js'
import { getSelectedIndexes } from './editorState.js'
import { syncBoardOrderFromLayerTree } from './layerTree.js'
import { normalizeCoordinate } from './geometry.js'
import {
  getBoundsCenterX,
  getBoundsCenterY,
  getSelectionBounds,
} from './objectAlignment.js'
import type {
  BoardObject,
  EditorState,
  LayerNode,
  LocalLayerPreset,
} from './types.js'

interface InsertPresetOptions {
  point: { x: number, y: number }
}

interface InsertPresetResult {
  groupId: string
  indexes: number[]
  objectCount: number
}

interface InheritedLayerFlags {
  hidden?: boolean
  locked?: boolean
}

const BOARD_BOUNDS = {
  bottom: 384,
  left: 0,
  right: 512,
  top: 0,
}

export function createPresetFromSelection(
  state: EditorState,
  name: string,
): LocalLayerPreset | null {
  const selection = getPresetSelection(state)
  if (!selection) return null
  const now = new Date().toISOString()
  const objects = collectPresetObjects(state, selection.layers)
  const contentHash = hashPresetContent({ objects, layers: selection.layers })
  return {
    id: createEditorId('preset'),
    name: name.trim() || '未命名预设',
    objects,
    layers: selection.layers,
    objectCount: Object.keys(objects).length,
    contentHash,
    createdAt: now,
    updatedAt: now,
  }
}

export function canSavePresetFromSelection(state: EditorState): boolean {
  return Boolean(getPresetSelection(state))
}

export function insertPresetIntoBoard(
  state: EditorState,
  preset: LocalLayerPreset,
  { point }: InsertPresetOptions,
): InsertPresetResult | null {
  const objectIds = collectLayerObjectIds(preset.layers)
  const sourceObjectMap = new Map<string, BoardObject>()
  for (const id of objectIds) {
    const object = preset.objects[id]
    if (!object || sourceObjectMap.has(id)) continue
    sourceObjectMap.set(id, sanitizeObject(structuredClone(object)))
  }
  applyLayerFlagsToObjects(preset.layers, sourceObjectMap)
  const sourceObjects = [...sourceObjectMap.values()]
  if (sourceObjects.length === 0) return null
  if (state.board.objects.length + sourceObjects.length > MAX_BOARD_OBJECTS) return null

  const bounds = getSelectionBounds(sourceObjects, state)
  const delta = constrainDeltaToBoard(bounds, {
    x: point.x - getBoundsCenterX(bounds),
    y: point.y - getBoundsCenterY(bounds),
  })
  const objectIdMap = new Map<string, string>()
  const groupIdMap = new Map<string, string>()
  const clonedObjects = new Map<string, BoardObject>()
  for (const id of objectIds) {
    const object = sourceObjectMap.get(id)
    if (!object || clonedObjects.has(id)) continue
    const nextId = createEditorId('obj')
    objectIdMap.set(id, nextId)
    const clonedObject = structuredClone(object)
    clonedObject.editorId = nextId
    clonedObjects.set(id, translateObject(clonedObject, delta))
  }

  const clonedLayers = clonePresetLayers(preset.layers, objectIdMap, groupIdMap)
  const orderedIds = collectLayerObjectIds(clonedLayers)
  const insertedObjects = orderedIds
    .map((id) => clonedObjects.get(reverseLookup(objectIdMap, id)))
    .filter((object): object is BoardObject => Boolean(object))
  state.board.objects.push(...insertedObjects)
  state.layerTree.push(...clonedLayers)
  syncBoardOrderFromLayerTree(state)

  const insertedIdSet = new Set(insertedObjects.map((object) => object.editorId))
  const indexes = state.board.objects
    .map((object, index) => insertedIdSet.has(object.editorId) ? index : -1)
    .filter((index) => index >= 0)
  const selectableIndexes = indexes.filter((index) => !state.board.objects[index]?.locked)
  state.selectedIndexes = selectableIndexes
  state.selectedIndex = selectableIndexes.at(-1) ?? -1
  const rootGroup = clonedLayers.length === 1 && clonedLayers[0]?.type === 'group'
    ? clonedLayers[0]
    : null
  state.selectedGroupId = rootGroup && !rootGroup.locked && selectableIndexes.length > 0
    ? rootGroup.id
    : ''
  state.revealSelectedLayer = true
  return {
    groupId: state.selectedGroupId,
    indexes,
    objectCount: insertedObjects.length,
  }
}

export function hashPresetContent(content: {
  layers: LayerNode[]
  objects: Record<string, BoardObject>
}): string {
  const text = JSON.stringify(content)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function getPresetSelection(state: EditorState): { layers: LayerNode[] } | null {
  if (state.selectedGroupId) {
    const group = findGroupNode(state.layerTree, state.selectedGroupId)
    return group ? { layers: [cloneLayerNode(group)] } : null
  }

  const selectedIds = getSelectedIndexes(state)
    .map((index) => state.board.objects[index]?.editorId)
    .filter((id): id is string => Boolean(id))
  if (selectedIds.length === 0) return null
  return {
    layers: selectedIds.map((id) => ({ type: 'object', id })),
  }
}

function collectPresetObjects(
  state: EditorState,
  layers: LayerNode[],
): Record<string, BoardObject> {
  const ids = new Set(collectLayerObjectIds(layers))
  const objects: Record<string, BoardObject> = {}
  for (const object of state.board.objects) {
    if (object.editorId && ids.has(object.editorId)) {
      objects[object.editorId] = sanitizeObject(object)
    }
  }
  return objects
}

function applyLayerFlagsToObjects(
  layers: LayerNode[],
  objects: Map<string, BoardObject>,
  inheritedFlags: InheritedLayerFlags = {},
): void {
  for (const node of layers) {
    if (node.type === 'object') {
      const object = objects.get(node.id)
      if (!object) continue
      if (inheritedFlags.hidden) object.hidden = true
      if (inheritedFlags.locked) object.locked = true
      continue
    }
    applyLayerFlagsToObjects(node.children ?? [], objects, {
      hidden: inheritedFlags.hidden || Boolean(node.hidden),
      locked: inheritedFlags.locked || Boolean(node.locked),
    })
  }
}

function cloneLayerNode(node: LayerNode): LayerNode {
  if (node.type === 'object') return { type: 'object', id: node.id }
  return {
    type: 'group',
    id: node.id,
    name: node.name,
    collapsed: Boolean(node.collapsed),
    hidden: Boolean(node.hidden),
    locked: Boolean(node.locked),
    children: (node.children ?? []).map(cloneLayerNode),
  }
}

function clonePresetLayers(
  layers: LayerNode[],
  objectIdMap: Map<string, string>,
  groupIdMap: Map<string, string>,
): LayerNode[] {
  return layers
    .map((node) => clonePresetLayer(node, objectIdMap, groupIdMap))
    .filter((node): node is LayerNode => Boolean(node))
}

function clonePresetLayer(
  node: LayerNode,
  objectIdMap: Map<string, string>,
  groupIdMap: Map<string, string>,
): LayerNode | null {
  if (node.type === 'object') {
    const id = objectIdMap.get(node.id)
    return id ? { type: 'object', id } : null
  }
  const id = createEditorId('grp')
  groupIdMap.set(node.id, id)
  return {
    type: 'group',
    id,
    name: node.name,
    collapsed: false,
    hidden: Boolean(node.hidden),
    locked: Boolean(node.locked),
    children: clonePresetLayers(node.children ?? [], objectIdMap, groupIdMap),
  }
}

function collectLayerObjectIds(layers: LayerNode[]): string[] {
  const ids: string[] = []
  for (const node of layers) {
    if (node.type === 'object') {
      ids.push(node.id)
      continue
    }
    ids.push(...collectLayerObjectIds(node.children ?? []))
  }
  return [...new Set(ids)]
}

function findGroupNode(layers: LayerNode[], groupId: string): Extract<LayerNode, { type: 'group' }> | null {
  for (const node of layers) {
    if (node.type === 'group' && node.id === groupId) return node
    if (node.type === 'group') {
      const child = findGroupNode(node.children ?? [], groupId)
      if (child) return child
    }
  }
  return null
}

function translateObject(object: BoardObject, delta: { x: number, y: number }): BoardObject {
  object.x = normalizeCoordinate(object.x + delta.x, 0, 512)
  object.y = normalizeCoordinate(object.y + delta.y, 0, 384)
  if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
    object.endX = normalizeCoordinate(object.endX + delta.x, 0, 512)
    object.endY = normalizeCoordinate(object.endY + delta.y, 0, 384)
  }
  return object
}

function constrainDeltaToBoard(
  bounds: { bottom: number, left: number, right: number, top: number },
  delta: { x: number, y: number },
): { x: number, y: number } {
  return {
    x: constrainAxisDelta(delta.x, bounds.left, bounds.right, BOARD_BOUNDS.left, BOARD_BOUNDS.right),
    y: constrainAxisDelta(delta.y, bounds.top, bounds.bottom, BOARD_BOUNDS.top, BOARD_BOUNDS.bottom),
  }
}

function constrainAxisDelta(
  delta: number,
  sourceMin: number,
  sourceMax: number,
  targetMin: number,
  targetMax: number,
): number {
  const sourceSize = sourceMax - sourceMin
  const targetSize = targetMax - targetMin
  if (sourceSize > targetSize) {
    return targetMin + (targetSize - sourceSize) / 2 - sourceMin
  }
  if (sourceMin + delta < targetMin) {
    return targetMin - sourceMin
  }
  if (sourceMax + delta > targetMax) {
    return targetMax - sourceMax
  }
  return delta
}

function reverseLookup(map: Map<string, string>, value: string): string {
  for (const [source, target] of map.entries()) {
    if (target === value) return source
  }
  return ''
}
