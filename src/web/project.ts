import { cleanBoard, normalizeBoard, sanitizeObject } from './board.js'
import {
  DEFAULT_BOARD_BACKGROUND,
  isBoardBackground,
} from '../shared/backgrounds.js'
import { MAX_BOARD_OBJECTS } from './constants.js'
import type {
  Board,
  BoardObject,
  CreateProjectOptions,
  LayerNode,
  ProjectFile,
} from './types.js'

export const PROJECT_FORMAT = 'node-zsb-project'
export const PROJECT_VERSION = 1
export const PROJECT_FILE_EXTENSION = '.zsb.json'
export const BUILT_IN_PROJECT_OBJECT_TYPES = [
  'text',
  'line',
  'line_aoe',
  'circle_aoe',
  'fan_aoe',
  'donut',
] as const
const UNSAFE_PROJECT_IDS = new Set(['__proto__', 'constructor', 'prototype'])

type ProjectObjects = Record<string, BoardObject>

interface NormalizeLayerContext {
  usedGroupIds: Set<string>
  usedObjectIds: Set<string>
}

interface InheritedLayerFlags {
  hidden?: boolean
  locked?: boolean
}

interface ParseProjectJsonOptions {
  allowedObjectTypes: Iterable<string>
}

interface StrictLayerContext {
  objectIds: Set<string>
  usedNodeIds: Set<string>
  referencedObjectIds: Set<string>
}

export function createProjectFromBoard(
  board: Partial<Board>,
  options: CreateProjectOptions = {},
): ProjectFile {
  const normalizedBoard = normalizeBoard(board)
  const objects: ProjectObjects = {}
  const defaultLayers = normalizedBoard.objects.map((object) => {
    const id = object.editorId as string
    objects[id] = sanitizeObject(object)
    return {
      type: 'object' as const,
      id,
    }
  })
  const layers = completeLayerNodes(
    normalizeLayerNodes(options.layerTree, objects),
    objects,
    defaultLayers,
  )
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    fileName: options.fileName ?? '',
    board: {
      name: normalizedBoard.name ?? '',
      boardBackground: normalizedBoard.boardBackground ?? DEFAULT_BOARD_BACKGROUND,
    },
    objects,
    layers,
  }
}

export function normalizeProject(project: unknown): ProjectFile {
  if (!isProject(project)) {
    throw new Error('Invalid node-zsb project')
  }
  const objects = normalizeProjectObjects(project.objects)
  const layers = completeLayerNodes(normalizeLayerNodes(project.layers, objects), objects)
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    fileName: String(project.fileName ?? ''),
    board: {
      name: project.board?.name ?? '',
      boardBackground: project.board?.boardBackground ?? DEFAULT_BOARD_BACKGROUND,
    },
    objects,
    layers,
  }
}

export function normalizeLayerTreeForBoard(
  layerTree: unknown,
  board: Partial<Board>,
): LayerNode[] {
  const objects: ProjectObjects = {}
  for (const object of board.objects ?? []) {
    if (object.editorId) {
      objects[object.editorId] = sanitizeObject(object)
    }
  }
  return completeLayerNodes(normalizeLayerNodes(layerTree, objects), objects)
}

export function isProject(value: unknown): value is Partial<ProjectFile> {
  return Boolean(
    value
      && typeof value === 'object'
      && !Array.isArray(value)
      && (value as Partial<ProjectFile>).format === PROJECT_FORMAT
      && Number((value as Partial<ProjectFile>).version) >= 1,
  )
}

export function parseProjectJson(
  text: string,
  { allowedObjectTypes }: ParseProjectJsonOptions,
): ProjectFile {
  let project: unknown
  try {
    project = JSON.parse(text)
  } catch {
    throw new Error('工程文件不是有效的 JSON')
  }
  validateExternalProject(project, new Set(allowedObjectTypes))
  return normalizeProject(project)
}

export function projectToJson(project: unknown): string {
  return `${JSON.stringify(normalizeProject(project), null, 2)}\n`
}

export function createProjectSnapshot(
  board: Partial<Board>,
  options: CreateProjectOptions = {},
): string {
  return projectToJson(createProjectFromBoard(board, options))
}

export function flattenProjectToBoard(project: unknown): ReturnType<typeof normalizeBoard> {
  const normalizedProject = normalizeProject(project)
  const objects: BoardObject[] = []
  const usedIds = new Set<string>()
  appendLayerObjects(normalizedProject.layers, normalizedProject.objects, objects, usedIds)
  return normalizeBoard({
    name: normalizedProject.board.name,
    boardBackground: normalizedProject.board.boardBackground,
    objects,
  })
}

export function createPureBoardFromProject(project: unknown): Board {
  return cleanBoard(flattenProjectToBoard(project))
}

function normalizeProjectObjects(objects: unknown): ProjectObjects {
  const normalized: ProjectObjects = {}
  if (!objects || typeof objects !== 'object' || Array.isArray(objects)) {
    return normalized
  }
  for (const [id, object] of Object.entries(objects)) {
    if (!id || !isRecord(object)) continue
    normalized[id] = sanitizeObject(structuredClone(object) as BoardObject)
  }
  return normalized
}

function normalizeLayerNodes(nodes: unknown, objects: ProjectObjects): LayerNode[] {
  return normalizeLayerNodesWithContext(nodes, objects, createNormalizeLayerContext())
}

function normalizeLayerNodesWithContext(
  nodes: unknown,
  objects: ProjectObjects,
  context: NormalizeLayerContext,
): LayerNode[] {
  if (!Array.isArray(nodes)) return []
  const normalized: LayerNode[] = []
  for (const node of nodes) {
    if (!isRecord(node)) continue
    if (
      node.type === 'object'
      && typeof node.id === 'string'
      && objects[node.id]
      && !context.usedObjectIds.has(node.id)
    ) {
      context.usedObjectIds.add(node.id)
      normalized.push({
        type: 'object',
        id: node.id,
      })
      continue
    }
    if (node.type === 'group') {
      const id = createUniqueGroupId(node.id, context)
      normalized.push({
        type: 'group',
        id,
        name: String(node.name ?? 'Group'),
        collapsed: Boolean(node.collapsed),
        hidden: Boolean(node.hidden),
        locked: Boolean(node.locked),
        children: normalizeLayerNodesWithContext(node.children, objects, context),
      })
    }
  }
  return normalized
}

function createNormalizeLayerContext(): NormalizeLayerContext {
  return {
    usedGroupIds: new Set(),
    usedObjectIds: new Set(),
  }
}

function createUniqueGroupId(value: unknown, context: NormalizeLayerContext): string {
  const base = typeof value === 'string' && value ? value : `grp_${context.usedGroupIds.size + 1}`
  let id = base
  let index = 2
  while (context.usedGroupIds.has(id)) {
    id = `${base}_${index}`
    index += 1
  }
  context.usedGroupIds.add(id)
  return id
}

function completeLayerNodes(
  layers: LayerNode[],
  objects: ProjectObjects,
  fallbackLayers: LayerNode[] = [],
): LayerNode[] {
  const completed = layers.length > 0 ? [...layers] : [...fallbackLayers]
  const usedIds = new Set<string>()
  collectLayerObjectIds(completed, usedIds)
  for (const id of Object.keys(objects)) {
    if (!usedIds.has(id)) {
      completed.push({ type: 'object', id })
    }
  }
  return completed
}

function appendLayerObjects(
  nodes: LayerNode[],
  objects: ProjectObjects,
  result: BoardObject[],
  usedIds: Set<string>,
  inheritedFlags: InheritedLayerFlags = {},
): void {
  for (const node of nodes) {
    if (node.type === 'object') {
      const object = objects[node.id]
      if (usedIds.has(node.id) || !object) continue
      result.push(applyInheritedLayerFlags({
        ...structuredClone(object),
        editorId: node.id,
      }, inheritedFlags))
      usedIds.add(node.id)
      continue
    }
    if (node.type === 'group') {
      appendLayerObjects(node.children ?? [], objects, result, usedIds, {
        hidden: inheritedFlags.hidden || Boolean(node.hidden),
        locked: inheritedFlags.locked || Boolean(node.locked),
      })
    }
  }
}

function applyInheritedLayerFlags(object: BoardObject, flags: InheritedLayerFlags): BoardObject {
  if (flags.hidden) object.hidden = true
  if (flags.locked) object.locked = true
  return object
}

function collectLayerObjectIds(nodes: LayerNode[], result: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'object') {
      result.add(node.id)
      continue
    }
    if (node.type === 'group') {
      collectLayerObjectIds(node.children ?? [], result)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validateExternalProject(
  value: unknown,
  allowedObjectTypes: Set<string>,
): asserts value is ProjectFile {
  if (!isRecord(value)) {
    throw new Error('工程文件格式无效：根节点必须是对象')
  }
  if (value.format !== PROJECT_FORMAT) {
    throw new Error(`工程文件格式无效：仅支持 ${PROJECT_FORMAT}`)
  }
  if (typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    throw new Error('工程文件格式无效：version 必须是整数')
  }
  if (value.version > PROJECT_VERSION) {
    throw new Error('工程文件版本较新，需要更新编辑器后再打开')
  }
  if (value.version !== PROJECT_VERSION) {
    throw new Error(`工程文件版本无效：仅支持 v${PROJECT_VERSION}`)
  }
  if (typeof value.fileName !== 'string') {
    throw new Error('工程文件格式无效：fileName 必须是字符串')
  }
  validateProjectBoard(value.board)
  const objectIds = validateProjectObjects(value.objects, allowedObjectTypes)
  validateProjectLayers(value.layers, objectIds)
}

function validateProjectBoard(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('工程文件格式无效：board 必须是对象')
  }
  if (typeof value.name !== 'string') {
    throw new Error('工程文件格式无效：board.name 必须是字符串')
  }
  if (!isBoardBackground(value.boardBackground)) {
    throw new Error('工程文件格式无效：board.boardBackground 不受支持')
  }
}

function validateProjectObjects(
  value: unknown,
  allowedObjectTypes: Set<string>,
): Set<string> {
  if (!isRecord(value)) {
    throw new Error('工程文件格式无效：objects 必须是对象')
  }
  const entries = Object.entries(value)
  if (entries.length > MAX_BOARD_OBJECTS) {
    throw new Error(`工程文件对象数量超过上限 ${MAX_BOARD_OBJECTS}`)
  }
  const objectIds = new Set<string>()
  for (const [id, object] of entries) {
    if (!id.trim() || UNSAFE_PROJECT_IDS.has(id)) {
      throw new Error(`工程文件包含无效的对象 ID“${id}”`)
    }
    if (!isRecord(object)) {
      throw new Error(`对象“${id}”格式无效：必须是对象`)
    }
    if (typeof object.type !== 'string' || !object.type.trim()) {
      throw new Error(`对象“${id}”缺少有效的 type`)
    }
    if (!allowedObjectTypes.has(object.type)) {
      throw new Error(`对象“${id}”的类型“${object.type}”不受支持`)
    }
    validateFiniteCoordinate(object, id, 'x', { required: true })
    validateFiniteCoordinate(object, id, 'y', { required: true })
    validateFiniteCoordinate(object, id, 'endX')
    validateFiniteCoordinate(object, id, 'endY')
    objectIds.add(id)
  }
  return objectIds
}

function validateFiniteCoordinate(
  object: Record<string, unknown>,
  id: string,
  key: 'x' | 'y' | 'endX' | 'endY',
  { required = false }: { required?: boolean } = {},
): void {
  const value = object[key]
  if (value === undefined && !required) return
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`对象“${id}”的坐标 ${key} 必须是有限数字`)
  }
}

function validateProjectLayers(value: unknown, objectIds: Set<string>): void {
  if (!Array.isArray(value)) {
    throw new Error('工程文件格式无效：layers 必须是数组')
  }
  const context: StrictLayerContext = {
    objectIds,
    usedNodeIds: new Set(),
    referencedObjectIds: new Set(),
  }
  validateLayerNodes(value, context)
  for (const id of objectIds) {
    if (!context.referencedObjectIds.has(id)) {
      throw new Error(`对象“${id}”未被任何图层引用`)
    }
  }
}

function validateLayerNodes(nodes: unknown[], context: StrictLayerContext): void {
  for (const node of nodes) {
    if (!isRecord(node)) {
      throw new Error('工程文件包含无效的图层节点')
    }
    if (
      typeof node.id !== 'string'
      || !node.id.trim()
      || UNSAFE_PROJECT_IDS.has(node.id)
    ) {
      throw new Error('工程文件包含缺少有效 ID 的图层节点')
    }
    if (context.usedNodeIds.has(node.id)) {
      throw new Error(`图层节点 ID“${node.id}”重复`)
    }
    context.usedNodeIds.add(node.id)

    if (node.type === 'object') {
      if (!context.objectIds.has(node.id)) {
        throw new Error(`图层引用了不存在的对象“${node.id}”`)
      }
      if (context.referencedObjectIds.has(node.id)) {
        throw new Error(`对象“${node.id}”被图层重复引用`)
      }
      context.referencedObjectIds.add(node.id)
      continue
    }
    if (node.type !== 'group') {
      throw new Error(`图层节点“${node.id}”的 type 无效`)
    }
    if (typeof node.name !== 'string') {
      throw new Error(`图层组“${node.id}”的 name 必须是字符串`)
    }
    for (const key of ['collapsed', 'hidden', 'locked'] as const) {
      if (node[key] !== undefined && typeof node[key] !== 'boolean') {
        throw new Error(`图层组“${node.id}”的 ${key} 必须是布尔值`)
      }
    }
    if (!Array.isArray(node.children)) {
      throw new Error(`图层组“${node.id}”的 children 必须是数组`)
    }
    validateLayerNodes(node.children, context)
  }
}
