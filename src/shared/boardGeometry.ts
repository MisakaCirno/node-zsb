import type { BoardObject } from '../web/types.js'

export const BOARD_SCALE = 2
export const DEFAULT_TEXT_FONT_SIZE = 28
export const STRATEGY_TEXT_FONT_FAMILY = 'AlibabaPuHuiTi'
export const STRATEGY_TEXT_STROKE_WIDTH = 0.75
export const STRATEGY_TEXT_SHADOW_BLUR = 2
export const STRATEGY_TEXT_SHADOW_OFFSET = 1
export const MAX_GAME_TRANSPARENCY = 100
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
  return object.hidden
    ? hiddenOpacity
    : (MAX_GAME_TRANSPARENCY - clampTransparency(object.transparency ?? 0)) / MAX_GAME_TRANSPARENCY
}

export function normalizeTransparency(value = 0): number {
  return clampTransparency(Math.round(value))
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
): { offsetX: number, offsetY: number } {
  if (arcAngle >= 360) return { offsetX: radius, offsetY: radius }
  const crop = calculateSectorCrop(arcAngle, radius, 0)
  return getAbsoluteSectorCropCenter(crop, radius)
}

export function calculateDonutOffset({
  arcAngle = 360,
  outerRadius = AOE_RADIUS,
  innerRadius = 0,
}: ArcOffsetOptions = {}): { offsetX: number, offsetY: number } {
  if (arcAngle >= 360) {
    return { offsetX: 0, offsetY: 0 }
  }

  const crop = calculateSectorCrop(arcAngle, outerRadius, innerRadius)
  const center = getAbsoluteSectorCropCenter(crop, outerRadius)
  return {
    offsetX: center.offsetX - outerRadius,
    offsetY: center.offsetY - outerRadius,
  }
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function calculateSectorCrop(
  arcAngle: number,
  outerRadius: number,
  innerRadius: number,
): { left: number, right: number, bottom: number } {
  const radians = degreesToRadians(Math.max(0, Math.min(arcAngle, 360)))
  let left = 0
  let right = 0
  let bottom = 0

  if (radians < Math.PI * 1.5 && radians >= Math.PI) {
    left = (1 + Math.sin(radians)) * outerRadius
  } else if (radians < Math.PI) {
    left = outerRadius
  }

  if (radians < Math.PI) {
    bottom = radians >= Math.PI * 0.5
      ? (1 + Math.cos(radians)) * outerRadius
      : outerRadius + Math.cos(radians) * innerRadius
  }

  if (radians < Math.PI * 0.5) {
    right = (1 - Math.sin(radians)) * outerRadius
  }

  return { left, right, bottom }
}

function getAbsoluteSectorCropCenter(
  crop: { left: number, right: number, bottom: number },
  radius: number,
): { offsetX: number, offsetY: number } {
  return {
    offsetX: (radius * 2 + crop.left - crop.right) / 2,
    offsetY: (radius * 2 - crop.bottom) / 2,
  }
}

function clampTransparency(value: number): number {
  return Math.min(MAX_GAME_TRANSPARENCY, Math.max(0, value))
}
