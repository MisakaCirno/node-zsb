import type { BoardObject } from './boardTypes.js'

export const BOARD_SCALE = 2
export const DEFAULT_TEXT_FONT_SIZE = 28
export const STRATEGY_TEXT_FONT_PRIMARY = 'MiSans'
export const STRATEGY_TEXT_FONT_WEIGHT = 600
export const STRATEGY_TEXT_FONT_FAMILY = `${STRATEGY_TEXT_FONT_PRIMARY}, Arial, "Microsoft YaHei", sans-serif`
export const STRATEGY_TEXT_STROKE_WIDTH = 0.6
export const STRATEGY_TEXT_SHADOW_BLUR = 1.5
export const STRATEGY_TEXT_SHADOW_OFFSET = 1
export const STRATEGY_TEXT_VISUAL_OFFSET_X = 0
export const STRATEGY_TEXT_VISUAL_OFFSET_Y = 0
export const DEFAULT_TEXT_COLOR = '#FFFFFF'
export const DEFAULT_LINE_COLOR = '#FF7F00'
export const DEFAULT_AOE_COLOR = '#FF7F00'
export const DEFAULT_DONUT_COLOR = '#55cc88'
export const MAX_GAME_TRANSPARENCY = 100
export const MIN_GAME_OBJECT_SIZE = 50
export const MIN_GAME_AOE_SIZE = 10
export const MAX_GAME_OBJECT_SIZE = 200
export const MIN_LINE_AOE_DIMENSION = 16
export const MAX_LINE_AOE_HEIGHT = 384
export const MAX_LINE_AOE_WIDTH = 512
export const MIN_GAME_ROTATION_ANGLE = -180
export const MAX_GAME_ROTATION_ANGLE = 180
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

export interface NumericBounds {
  min: number
  max: number
}

export interface GeometryBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export function toSceneCoordinate(value: number): number {
  return value * BOARD_SCALE
}

export function toLogicalCoordinate(value: number): number {
  return value / BOARD_SCALE
}

export function objectScale(object: Pick<BoardObject, 'size' | 'type'>): number {
  return normalizeObjectSize(object.size, object.type) / 100
}

export function normalizeObjectSize(value = 100, type = ''): number {
  if (type === 'line_aoe') return 100
  const number = Math.round(Number(value))
  if (!Number.isFinite(number)) return 100
  const bounds = getObjectSizeBounds(type)
  return clamp(number, bounds.min, bounds.max)
}

export function getObjectSizeBounds(type = ''): NumericBounds {
  if (type === 'circle_aoe' || type === 'fan_aoe' || type === 'donut') {
    return { min: MIN_GAME_AOE_SIZE, max: MAX_GAME_OBJECT_SIZE }
  }
  return { min: MIN_GAME_OBJECT_SIZE, max: MAX_GAME_OBJECT_SIZE }
}

export function getDefaultObjectColor(type = ''): string | undefined {
  if (type === 'text') return DEFAULT_TEXT_COLOR
  if (type === 'line' || type === 'line_aoe') return DEFAULT_LINE_COLOR
  return undefined
}

export function normalizeLineAoeHeight(value = 128): number {
  return normalizeBoundedNumber(value, MIN_LINE_AOE_DIMENSION, MAX_LINE_AOE_HEIGHT, 128)
}

export function normalizeLineAoeWidth(value = 128): number {
  return normalizeBoundedNumber(value, MIN_LINE_AOE_DIMENSION, MAX_LINE_AOE_WIDTH, 128)
}

export function normalizeDonutRadius(value = 80): number {
  return normalizeBoundedNumber(value, 0, 240, 80)
}

export function normalizeObjectAngle(value = 0): number {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number)) return 0
  const normalized = modulo(number + 180, 360) - 180
  return normalized === -180 && number > 0 ? 180 : normalized
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

export function calculateSectorBounds(
  arcAngle: number,
  outerRadius = AOE_RADIUS,
  innerRadius = 0,
): GeometryBounds {
  const crop = calculateSectorCrop(arcAngle, outerRadius, innerRadius)
  return {
    left: crop.left,
    right: outerRadius * 2 - crop.right,
    top: 0,
    bottom: outerRadius * 2 - crop.bottom,
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

function normalizeBoundedNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const number = Math.round(Number(value ?? fallback))
  if (!Number.isFinite(number)) return fallback
  return clamp(number, min, max)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
