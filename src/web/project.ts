import { cleanBoard, normalizeBoard, sanitizeObject } from './board.js'
import { DEFAULT_BOARD_BACKGROUND } from '../shared/backgrounds.js'
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

type ProjectObjects = Record<string, BoardObject>

interface NormalizeLayerContext {
  usedGroupIds: Set<string>
  usedObjectIds: Set<string>
}

interface InheritedLayerFlags {
  hidden?: boolean
  locked?: boolean
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

export function parseProjectJson(text: string): ProjectFile {
  return normalizeProject(JSON.parse(text))
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
