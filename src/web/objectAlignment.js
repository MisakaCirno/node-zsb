import { calcTextWidth, objectScale } from '../shared/boardGeometry.js'

const DEFAULT_ICON_SIZE = 32
const CIRCLE_AOE_SIZE = 512

export function getObjectBounds(object, state) {
  if (object.type === 'line') {
    const endX = object.endX ?? object.x
    const endY = object.endY ?? object.y
    return {
      left: Math.min(object.x, endX),
      right: Math.max(object.x, endX),
      top: Math.min(object.y, endY),
      bottom: Math.max(object.y, endY),
    }
  }
  const { width, height } = getObjectSize(object, state)
  return {
    left: object.x - width / 2,
    right: object.x + width / 2,
    top: object.y - height / 2,
    bottom: object.y + height / 2,
  }
}

export function getSelectionBounds(objects, state) {
  const bounds = objects.map((object) => getObjectBounds(object, state))
  return {
    left: Math.min(...bounds.map((bound) => bound.left)),
    right: Math.max(...bounds.map((bound) => bound.right)),
    top: Math.min(...bounds.map((bound) => bound.top)),
    bottom: Math.max(...bounds.map((bound) => bound.bottom)),
  }
}

export function getBoundsCenterX(bounds) {
  return bounds.left + (bounds.right - bounds.left) / 2
}

export function getBoundsCenterY(bounds) {
  return bounds.top + (bounds.bottom - bounds.top) / 2
}

function getObjectSize(object, state) {
  const scale = objectScale(object)
  if (object.type === 'text') {
    return {
      width: (calcTextWidth(object.text ?? '', 28) / 2) * scale,
      height: 14 * scale,
    }
  }
  if (object.type === 'line_aoe') {
    return {
      width: (object.width ?? 128) * scale,
      height: (object.height ?? 128) * scale,
    }
  }
  if (object.type === 'circle_aoe' || object.type === 'fan_aoe' || object.type === 'donut') {
    return {
      width: CIRCLE_AOE_SIZE * scale,
      height: CIRCLE_AOE_SIZE * scale,
    }
  }
  const iconSize = state.iconConfigs[object.type]?.size ?? DEFAULT_ICON_SIZE
  return {
    width: iconSize * scale,
    height: iconSize * scale,
  }
}
