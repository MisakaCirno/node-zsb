import type { BoardObject } from '../web/types.js'

export const BOARD_SCALE = 2
export const DEFAULT_TEXT_FONT_SIZE = 28
export const AOE_RADIUS = 512
export const AOE_CENTER = 512

interface OpacityOptions {
  hiddenOpacity?: number
}

interface ArcOffsetOptions {
  arcAngle?: number
  outerRadius?: number
  innerRadius?: number
}

interface Point {
  x: number
  y: number
}

export function toSceneCoordinate(value: number): number {
  return value * BOARD_SCALE
}

export function toLogicalCoordinate(value: number): number {
  return Math.round(value / BOARD_SCALE)
}

export function objectScale(object: Pick<BoardObject, 'size'>): number {
  return (object.size ?? 100) / 100
}

export function objectOpacity(
  object: Pick<BoardObject, 'hidden' | 'transparency'>,
  options: OpacityOptions = {},
): number {
  const hiddenOpacity = options.hiddenOpacity ?? 0
  return object.hidden ? hiddenOpacity : (100 - (object.transparency ?? 0)) / 100
}

export function flippedScale(scale: number, flipped?: boolean): number {
  return scale * (flipped ? -1 : 1)
}

export function calcTextWidth(text = '', fontSize = DEFAULT_TEXT_FONT_SIZE): number {
  const asciiWidth = fontSize * 0.6
  let width = 0
  for (const char of text) {
    width += char.charCodeAt(0) < 128 ? asciiWidth : asciiWidth * 2
  }
  return width
}

export function calculateCircleOffset(
  arcAngle: number,
  radius = AOE_RADIUS,
  center = AOE_CENTER,
): { offsetX: number, offsetY: number } {
  if (arcAngle === 360) {
    return { offsetX: center, offsetY: center }
  }

  const startAngle = -Math.PI / 2
  const endAngle = startAngle + degreesToRadians(arcAngle)
  let minX = center
  let maxX = center
  let minY = center
  let maxY = center

  const startX = center + radius * Math.cos(startAngle)
  const startY = center + radius * Math.sin(startAngle)
  const endX = center + radius * Math.cos(endAngle)
  const endY = center + radius * Math.sin(endAngle)

  minX = Math.min(minX, startX, endX)
  maxX = Math.max(maxX, startX, endX)
  minY = Math.min(minY, startY, endY)
  maxY = Math.max(maxY, startY, endY)

  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    if (!isAngleWithinArc(angle, startAngle, endAngle)) continue
    minX = Math.min(minX, center + radius * Math.cos(angle))
    maxX = Math.max(maxX, center + radius * Math.cos(angle))
    minY = Math.min(minY, center + radius * Math.sin(angle))
    maxY = Math.max(maxY, center + radius * Math.sin(angle))
  }

  return {
    offsetX: (minX + maxX) / 2,
    offsetY: (minY + maxY) / 2,
  }
}

export function calculateDonutOffset({
  arcAngle = 360,
  outerRadius = AOE_RADIUS,
  innerRadius = 0,
}: ArcOffsetOptions = {}): { offsetX: number, offsetY: number } {
  if (arcAngle === 360) {
    return { offsetX: 0, offsetY: 0 }
  }

  const startAngle = -Math.PI / 2
  const endAngle = startAngle + degreesToRadians(arcAngle)
  const points = [
    arcPoint(outerRadius, startAngle),
    arcPoint(outerRadius, endAngle),
    arcPoint(innerRadius, startAngle),
    arcPoint(innerRadius, endAngle),
  ]

  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    if (isAngleWithinArc(angle, startAngle, endAngle)) {
      points.push(arcPoint(outerRadius, angle))
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return {
    offsetX: (minX + maxX) / 2,
    offsetY: (minY + maxY) / 2,
  }
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function arcPoint(radius: number, angle: number): Point {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  }
}

function isAngleWithinArc(angle: number, startAngle: number, endAngle: number): boolean {
  const normalized = normalizeRadians(angle)
  const start = normalizeRadians(startAngle)
  let end = normalizeRadians(endAngle)

  if (end < start) end += Math.PI * 2
  const checked = normalized < start ? normalized + Math.PI * 2 : normalized

  return checked >= start && checked <= end
}

function normalizeRadians(angle: number): number {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}
