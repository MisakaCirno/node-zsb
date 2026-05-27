import { ensureObjectEditorIds, stripEditorFields } from './editorIds.js'
import type {
  Board,
  BoardObject,
  NormalizedBoard,
  ObjectCapabilities,
} from './types.js'

export function normalizeBoard(board: Partial<Board>): NormalizedBoard {
  const objects = (board.objects ?? []).map((object) => normalizeObjectForEditor(object))
  ensureObjectEditorIds(objects)
  return {
    name: board.name ?? '',
    boardBackground: board.boardBackground ?? 'checkered',
    objects,
  }
}

export function cleanBoard(board: NormalizedBoard): Board {
  return {
    name: board.name || undefined,
    boardBackground: board.boardBackground,
    objects: board.objects.map((object) => {
      const copy = sanitizeObject(object)
      for (const key of Object.keys(copy)) {
        if (copy[key] === undefined || copy[key] === '') delete copy[key]
      }
      return copy
    }),
  }
}

export function sanitizeObject(object: BoardObject): BoardObject {
  const capabilities = getObjectCapabilities(object.type)
  const copy = stripEditorFields(object)
  if (copy.type === 'text') {
    delete copy.size
    delete copy.angle
  }
  if (copy.type === 'line') {
    delete copy.angle
  }
  if (copy.type === 'donut' && copy.arcAngle === undefined) {
    copy.arcAngle = 360
  }
  if (!capabilities.appearance) {
    delete copy.color
    delete copy.transparency
  }
  if (!capabilities.text) {
    delete copy.text
  }
  if (!capabilities.line) {
    delete copy.endX
    delete copy.endY
  }
  if (!capabilities.arcAngle) {
    delete copy.arcAngle
  }
  if (!capabilities.donutRadius) {
    delete copy.donutRadius
  }
  return copy
}

export function getObjectCapabilities(type: string): ObjectCapabilities {
  return {
    appearance: ['text', 'line', 'line_aoe', 'donut'].includes(type),
    text: type === 'text',
    line: type === 'line',
    arcAngle: type === 'fan_aoe' || type === 'donut',
    donutRadius: type === 'donut',
  }
}

function normalizeObjectForEditor(object: BoardObject): BoardObject {
  const normalized = sanitizeObject({
    size: 100,
    color: '#ff8000',
    transparency: 0,
    ...object,
  })
  if (typeof object.editorId === 'string') {
    normalized.editorId = object.editorId
  }
  if (normalized.type === 'text') {
    normalized.size = 100
  }
  return normalized
}
