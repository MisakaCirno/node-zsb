import {
  AOE_RADIUS,
  BOARD_SCALE,
  calcTextWidth,
  calculateCircleOffset,
  calculateDonutOffset,
  calculateSectorBounds,
  objectScale,
} from '../shared/boardGeometry.js'
import { rotatePoint } from './geometry.js'
import type {
  BoardObject,
  Bounds,
  EditorState,
} from './types.js'

const DEFAULT_ICON_SIZE = 32
const CIRCLE_AOE_SIZE = 512
const DEFAULT_LINE_WIDTH = 6

interface ObjectSize {
  width: number
  height: number
}

interface LocalBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export function getObjectBounds(object: BoardObject, state: EditorState): Bounds {
  if (object.type === 'line') {
    return getLineBounds(object)
  }
  return transformLocalBounds(getObjectLocalBounds(object, state), object)
}

export function getSelectionBounds(objects: BoardObject[], state: EditorState): Bounds {
  const bounds = objects.map((object) => getObjectBounds(object, state))
  return {
    left: Math.min(...bounds.map((bound) => bound.left)),
    right: Math.max(...bounds.map((bound) => bound.right)),
    top: Math.min(...bounds.map((bound) => bound.top)),
    bottom: Math.max(...bounds.map((bound) => bound.bottom)),
  }
}

export function getBoundsCenterX(bounds: Bounds) {
  return bounds.left + (bounds.right - bounds.left) / 2
}

export function getBoundsCenterY(bounds: Bounds) {
  return bounds.top + (bounds.bottom - bounds.top) / 2
}

function getObjectSize(object: BoardObject, state: EditorState): ObjectSize {
  if (object.type === 'text') {
    return {
      width: calcTextWidth(object.text ?? '', 28) / BOARD_SCALE,
      height: 14,
    }
  }
  if (object.type === 'line_aoe') {
    return {
      width: object.width ?? 128,
      height: object.height ?? 128,
    }
  }
  if (object.type === 'circle_aoe' || object.type === 'fan_aoe' || object.type === 'donut') {
    return {
      width: CIRCLE_AOE_SIZE,
      height: CIRCLE_AOE_SIZE,
    }
  }
  const iconSize = state.iconConfigs[object.type]?.size ?? DEFAULT_ICON_SIZE
  return {
    width: iconSize,
    height: iconSize,
  }
}

function getObjectLocalBounds(object: BoardObject, state: EditorState): LocalBounds {
  if (object.type === 'circle_aoe' || object.type === 'fan_aoe') {
    return getCircleAoeLocalBounds(object)
  }
  if (object.type === 'donut') {
    return getDonutLocalBounds(object)
  }
  const { width, height } = getObjectSize(object, state)
  return centeredBounds(width, height)
}

function getLineBounds(object: BoardObject): Bounds {
  const endX = object.endX ?? object.x
  const endY = object.endY ?? object.y
  const halfWidth = (Number(object.height) || DEFAULT_LINE_WIDTH) / 2
  return {
    left: Math.min(object.x, endX) - halfWidth,
    right: Math.max(object.x, endX) + halfWidth,
    top: Math.min(object.y, endY) - halfWidth,
    bottom: Math.max(object.y, endY) + halfWidth,
  }
}

function getCircleAoeLocalBounds(object: BoardObject): LocalBounds {
  const arcAngle = object.type === 'fan_aoe' ? (object.arcAngle ?? 90) : 360
  const sector = calculateSectorBounds(arcAngle, AOE_RADIUS, 0)
  const offset = calculateCircleOffset(arcAngle, AOE_RADIUS)
  return sceneBoundsToLogical({
    left: sector.left - offset.offsetX,
    right: sector.right - offset.offsetX,
    top: sector.top - offset.offsetY,
    bottom: sector.bottom - offset.offsetY,
  })
}

function getDonutLocalBounds(object: BoardObject): LocalBounds {
  const outerRadius = AOE_RADIUS
  const innerRadius = (object.donutRadius ?? 80) * BOARD_SCALE
  const arcAngle = object.arcAngle ?? 360
  if (arcAngle >= 360) {
    return sceneBoundsToLogical({
      left: -outerRadius,
      right: outerRadius,
      top: -outerRadius,
      bottom: outerRadius,
    })
  }
  const sector = calculateSectorBounds(arcAngle, outerRadius, innerRadius)
  const offset = calculateDonutOffset({ arcAngle, outerRadius, innerRadius })
  return sceneBoundsToLogical({
    left: sector.left - outerRadius - offset.offsetX,
    right: sector.right - outerRadius - offset.offsetX,
    top: sector.top - outerRadius - offset.offsetY,
    bottom: sector.bottom - outerRadius - offset.offsetY,
  })
}

function transformLocalBounds(bounds: LocalBounds, object: BoardObject): Bounds {
  const scale = objectScale(object)
  const scaleX = scale * (object.horizontalFlip ? -1 : 1)
  const scaleY = scale * (object.verticalFlip ? -1 : 1)
  const angle = Number(object.angle) || 0
  const points = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ].map((point) => {
    const rotated = rotatePoint({ x: point.x * scaleX, y: point.y * scaleY }, angle)
    return {
      x: object.x + rotated.x,
      y: object.y + rotated.y,
    }
  })
  return {
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y)),
  }
}

function centeredBounds(width: number, height: number): LocalBounds {
  return {
    left: -width / 2,
    right: width / 2,
    top: -height / 2,
    bottom: height / 2,
  }
}

function sceneBoundsToLogical(bounds: LocalBounds): LocalBounds {
  return {
    left: bounds.left / BOARD_SCALE,
    right: bounds.right / BOARD_SCALE,
    top: bounds.top / BOARD_SCALE,
    bottom: bounds.bottom / BOARD_SCALE,
  }
}
