import {
  clamp,
  normalizeCoordinate,
} from './geometry.js'
import type {
  BoardObject,
  Bounds,
  EditorState,
} from './types.js'

export const BOARD_BOUNDS = {
  left: 0,
  right: 512,
  top: 0,
  bottom: 384,
}

export function moveObjectBy(object: BoardObject, dx: number, dy: number): void {
  object.x = normalizeCoordinate(object.x + dx, BOARD_BOUNDS.left, BOARD_BOUNDS.right)
  object.y = normalizeCoordinate(object.y + dy, BOARD_BOUNDS.top, BOARD_BOUNDS.bottom)
  if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
    object.endX = normalizeCoordinate(object.endX + dx, BOARD_BOUNDS.left, BOARD_BOUNDS.right)
    object.endY = normalizeCoordinate(object.endY + dy, BOARD_BOUNDS.top, BOARD_BOUNDS.bottom)
  }
}

export function moveObjectsBy(objects: BoardObject[], dx: number, dy: number): void {
  for (const object of objects) {
    moveObjectBy(object, dx, dy)
  }
}

export function getConstrainedObjectsMoveDelta(
  objects: BoardObject[],
  state: EditorState,
  dx: number,
  dy: number,
) {
  void state
  if (objects.length === 0) return { dx: 0, dy: 0 }
  return getConstrainedPointDelta(objects.flatMap(getObjectMovePoints), dx, dy)
}

export function getConstrainedMoveDelta(bounds: Bounds, dx: number, dy: number) {
  return {
    dx: clampDelta(dx, BOARD_BOUNDS.left - bounds.left, BOARD_BOUNDS.right - bounds.right),
    dy: clampDelta(dy, BOARD_BOUNDS.top - bounds.top, BOARD_BOUNDS.bottom - bounds.bottom),
  }
}

function clampDelta(delta: number, min: number, max: number) {
  return normalizeCoordinate(clamp(delta, min, max), min, max)
}

function getObjectMovePoints(object: BoardObject) {
  const points = [{ x: object.x, y: object.y }]
  if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
    points.push({ x: object.endX, y: object.endY })
  }
  return points
}

function getConstrainedPointDelta(points: Array<{ x: number, y: number }>, dx: number, dy: number) {
  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))
  return {
    dx: clampDelta(dx, BOARD_BOUNDS.left - minX, BOARD_BOUNDS.right - maxX),
    dy: clampDelta(dy, BOARD_BOUNDS.top - minY, BOARD_BOUNDS.bottom - maxY),
  }
}
