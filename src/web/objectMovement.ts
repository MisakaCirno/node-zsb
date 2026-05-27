import { clamp } from './geometry.js'
import type {
  BoardObject,
  Bounds,
} from './types.js'

export const BOARD_BOUNDS = {
  left: 0,
  right: 512,
  top: 0,
  bottom: 384,
}

export function moveObjectBy(object: BoardObject, dx: number, dy: number): void {
  object.x = clamp(Math.round(object.x + dx), BOARD_BOUNDS.left, BOARD_BOUNDS.right)
  object.y = clamp(Math.round(object.y + dy), BOARD_BOUNDS.top, BOARD_BOUNDS.bottom)
  if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
    object.endX = clamp(Math.round(object.endX + dx), BOARD_BOUNDS.left, BOARD_BOUNDS.right)
    object.endY = clamp(Math.round(object.endY + dy), BOARD_BOUNDS.top, BOARD_BOUNDS.bottom)
  }
}

export function getConstrainedMoveDelta(bounds: Bounds, dx: number, dy: number) {
  return {
    dx: clampDelta(dx, BOARD_BOUNDS.left - bounds.left, BOARD_BOUNDS.right - bounds.right),
    dy: clampDelta(dy, BOARD_BOUNDS.top - bounds.top, BOARD_BOUNDS.bottom - bounds.bottom),
  }
}

function clampDelta(delta: number, min: number, max: number) {
  return clamp(Math.round(delta), Math.ceil(min), Math.floor(max))
}
