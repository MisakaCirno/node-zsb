import { cleanBoard, normalizeBoard } from './board.js'
import { stripEditorFields } from './editorIds.js'

export const PROJECT_FORMAT = 'node-zsb-project'
export const PROJECT_VERSION = 1
export const PROJECT_FILE_EXTENSION = '.zsb.json'

export function createProjectFromBoard(board, options = {}) {
  const normalizedBoard = normalizeBoard(board)
  const objects = {}
  const defaultLayers = normalizedBoard.objects.map((object) => {
    const id = object.editorId
    objects[id] = stripEditorFields(object)
    return {
      type: 'object',
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
      boardBackground: normalizedBoard.boardBackground ?? 'checkered',
    },
    objects,
    layers,
  }
}

export function normalizeProject(project) {
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
      boardBackground: project.board?.boardBackground ?? 'checkered',
    },
    objects,
    layers,
  }
}

export function normalizeLayerTreeForBoard(layerTree, board) {
  const objects = Object.fromEntries(
    (board.objects ?? [])
      .filter((object) => object.editorId)
      .map((object) => [object.editorId, stripEditorFields(object)]),
  )
  return completeLayerNodes(normalizeLayerNodes(layerTree, objects), objects)
}

export function isProject(value) {
  return Boolean(
    value
      && typeof value === 'object'
      && value.format === PROJECT_FORMAT
      && Number(value.version) >= 1,
  )
}

export function parseProjectJson(text) {
  return normalizeProject(JSON.parse(text))
}

export function projectToJson(project) {
  return `${JSON.stringify(normalizeProject(project), null, 2)}\n`
}

export function flattenProjectToBoard(project) {
  const normalizedProject = normalizeProject(project)
  const objects = []
  const usedIds = new Set()
  appendLayerObjects(normalizedProject.layers, normalizedProject.objects, objects, usedIds)
  return normalizeBoard({
    name: normalizedProject.board.name,
    boardBackground: normalizedProject.board.boardBackground,
    objects,
  })
}

export function createPureBoardFromProject(project) {
  return cleanBoard(flattenProjectToBoard(project))
}

function normalizeProjectObjects(objects) {
  const normalized = {}
  if (!objects || typeof objects !== 'object' || Array.isArray(objects)) {
    return normalized
  }
  for (const [id, object] of Object.entries(objects)) {
    if (!id || !object || typeof object !== 'object' || Array.isArray(object)) continue
    normalized[id] = stripEditorFields(structuredClone(object))
  }
  return normalized
}

function normalizeLayerNodes(nodes, objects) {
  if (!Array.isArray(nodes)) return []
  const normalized = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'object' && objects[node.id]) {
      normalized.push({
        type: 'object',
        id: node.id,
      })
      continue
    }
    if (node.type === 'group') {
      normalized.push({
        type: 'group',
        id: typeof node.id === 'string' && node.id ? node.id : `grp_${normalized.length + 1}`,
        name: String(node.name ?? 'Group'),
        collapsed: Boolean(node.collapsed),
        hidden: Boolean(node.hidden),
        locked: Boolean(node.locked),
        children: normalizeLayerNodes(node.children, objects),
      })
    }
  }
  return normalized
}

function completeLayerNodes(layers, objects, fallbackLayers = []) {
  const completed = layers.length > 0 ? [...layers] : [...fallbackLayers]
  const usedIds = new Set()
  collectLayerObjectIds(completed, usedIds)
  for (const id of Object.keys(objects)) {
    if (!usedIds.has(id)) {
      completed.push({ type: 'object', id })
    }
  }
  return completed
}

function appendLayerObjects(nodes, objects, result, usedIds) {
  for (const node of nodes) {
    if (node.type === 'object') {
      if (usedIds.has(node.id) || !objects[node.id]) continue
      result.push({
        ...structuredClone(objects[node.id]),
        editorId: node.id,
      })
      usedIds.add(node.id)
      continue
    }
    if (node.type === 'group') {
      appendLayerObjects(node.children ?? [], objects, result, usedIds)
    }
  }
}

function collectLayerObjectIds(nodes, result) {
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
