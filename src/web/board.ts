import { ensureObjectEditorIds, stripEditorFields } from './editorIds.js'
import {
  normalizeDonutRadius,
  normalizeLineAoeHeight,
  normalizeLineAoeWidth,
  normalizeObjectAngle,
  normalizeObjectSize,
  normalizeTransparency,
} from '../shared/boardGeometry.js'
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
  } else {
    copy.size = normalizeObjectSize(Number(copy.size ?? 100), copy.type)
  }
  if (copy.type === 'line') {
    delete copy.angle
  }
  if (!capabilities.angle) {
    delete copy.angle
  } else if (copy.angle !== undefined) {
    copy.angle = normalizeObjectAngle(Number(copy.angle))
  }
  if (copy.type === 'donut' && copy.arcAngle === undefined) {
    copy.arcAngle = 360
  }
  if (!capabilities.color) {
    delete copy.color
  }
  if (!capabilities.transparency) {
    delete copy.transparency
  } else {
    copy.transparency = normalizeTransparency(Number(copy.transparency ?? 0))
  }
  if (!capabilities.text) {
    delete copy.text
  }
  if (!capabilities.line) {
    delete copy.endX
    delete copy.endY
  }
  if (!capabilities.dimensions) {
    delete copy.width
    delete copy.height
  } else {
    copy.width = normalizeLineAoeWidth(copy.width)
    copy.height = normalizeLineAoeHeight(copy.height)
  }
  if (!capabilities.arcAngle) {
    delete copy.arcAngle
  }
  if (!capabilities.donutRadius) {
    delete copy.donutRadius
  } else {
    copy.donutRadius = normalizeDonutRadius(copy.donutRadius)
  }
  return copy
}

export function getObjectCapabilities(type: string): ObjectCapabilities {
  const color = ['text', 'line', 'line_aoe'].includes(type)
  const transparency = [
    'text',
    'line',
    'line_aoe',
    'circle_aoe',
    'fan_aoe',
    'donut',
  ].includes(type)
  return {
    appearance: color || transparency,
    color,
    transparency,
    text: type === 'text',
    line: type === 'line',
    size: !['text', 'line', 'line_aoe'].includes(type),
    angle: !['text', 'line'].includes(type),
    dimensions: type === 'line_aoe',
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
