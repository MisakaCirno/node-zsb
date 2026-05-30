import {
  MAX_LINE_AOE_HEIGHT,
  MAX_LINE_AOE_WIDTH,
  MIN_LINE_AOE_DIMENSION,
  getObjectSizeBounds,
  normalizeLineAoeHeight,
  normalizeLineAoeWidth,
  normalizeObjectSize,
} from '../shared/boardGeometry.js'
import type { BoardObject } from './types.js'

export interface TransformBox {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface TransformScaleLimits {
  minX: number
  maxX: number
  minY: number
  maxY: number
  keepRatio: boolean
}

export function copyTransformBox(box: TransformBox): TransformBox {
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: box.rotation,
  }
}

export function constrainTransformBox({
  activeAnchor,
  baseBox,
  limits,
  newBox,
  oldBox,
}: {
  activeAnchor: string
  baseBox: TransformBox
  limits: TransformScaleLimits | null
  newBox: TransformBox
  oldBox: TransformBox
}): TransformBox {
  if (activeAnchor === 'rotater') return newBox
  if (oldBox.width === 0 || oldBox.height === 0) return oldBox
  if (newBox.width <= 0 || newBox.height <= 0) return oldBox
  if (!limits) return newBox

  const scaleX = Math.abs(newBox.width / baseBox.width)
  const scaleY = Math.abs(newBox.height / baseBox.height)
  if (limits.keepRatio) {
    const uniformScale = getUniformScaleForAnchor(activeAnchor, scaleX, scaleY)
    return uniformScale >= limits.minX && uniformScale <= limits.maxX
      ? createAnchoredFixedRatioBox(baseBox, uniformScale, activeAnchor, newBox)
      : oldBox
  }
  return scaleX >= limits.minX
    && scaleX <= limits.maxX
    && scaleY >= limits.minY
    && scaleY <= limits.maxY
    ? newBox
    : oldBox
}

export function getSelectionScaleLimits(objects: Array<BoardObject | undefined>): TransformScaleLimits | null {
  let minX = 0
  let maxX = Infinity
  let minY = 0
  let maxY = Infinity
  let keepRatio = true
  let hasTransformableObject = false
  for (const object of objects) {
    if (!object || object.locked || object.type === 'line' || object.type === 'text') continue
    const limits = getObjectScaleLimits(object)
    minX = Math.max(minX, limits.minX)
    maxX = Math.min(maxX, limits.maxX)
    minY = Math.max(minY, limits.minY)
    maxY = Math.min(maxY, limits.maxY)
    keepRatio = keepRatio && limits.keepRatio
    hasTransformableObject = true
  }
  if (!hasTransformableObject) return null
  return { minX, maxX, minY, maxY, keepRatio }
}

export function getObjectScaleLimits(object: BoardObject): TransformScaleLimits {
  if (object.type === 'line_aoe') {
    const width = normalizeLineAoeWidth(object.width ?? 128)
    const height = normalizeLineAoeHeight(object.height ?? 128)
    return {
      minX: MIN_LINE_AOE_DIMENSION / width,
      maxX: MAX_LINE_AOE_WIDTH / width,
      minY: MIN_LINE_AOE_DIMENSION / height,
      maxY: MAX_LINE_AOE_HEIGHT / height,
      keepRatio: false,
    }
  }
  const bounds = getObjectSizeBounds(object.type)
  const size = normalizeObjectSize(object.size, object.type)
  return {
    minX: bounds.min / size,
    maxX: bounds.max / size,
    minY: bounds.min / size,
    maxY: bounds.max / size,
    keepRatio: true,
  }
}

export function constrainObjectScale(
  object: BoardObject,
  scaleX: number,
  scaleY: number,
): { scaleX: number, scaleY: number } {
  if (object.type === 'line' || object.type === 'text') {
    return { scaleX, scaleY }
  }
  const limits = object.type === 'line_aoe'
    ? getObjectScaleLimits(object)
    : getRenderedObjectScaleLimits(object)
  return {
    scaleX: clampSignedScale(scaleX, limits.minX, limits.maxX),
    scaleY: clampSignedScale(scaleY, limits.minY, limits.maxY),
  }
}

export function clampSignedScale(value: number, min: number, max: number): number {
  const sign = value < 0 ? -1 : 1
  const magnitude = Math.min(max, Math.max(min, Math.abs(value)))
  return sign * magnitude
}

function createAnchoredFixedRatioBox(
  baseBox: TransformBox,
  scale: number,
  anchor: string,
  sourceBox: TransformBox,
): TransformBox {
  const width = baseBox.width * scale
  const height = baseBox.height * scale
  const centerX = baseBox.x + baseBox.width / 2
  const centerY = baseBox.y + baseBox.height / 2
  const right = baseBox.x + baseBox.width
  const bottom = baseBox.y + baseBox.height
  const box = {
    x: baseBox.x,
    y: baseBox.y,
    width,
    height,
    rotation: sourceBox.rotation,
  }
  switch (anchor) {
    case 'top-left':
      box.x = right - width
      box.y = bottom - height
      break
    case 'top-center':
      box.x = centerX - width / 2
      box.y = bottom - height
      break
    case 'top-right':
      box.y = bottom - height
      break
    case 'middle-left':
      box.x = right - width
      box.y = centerY - height / 2
      break
    case 'middle-right':
      box.y = centerY - height / 2
      break
    case 'bottom-left':
      box.x = right - width
      break
    case 'bottom-center':
      box.x = centerX - width / 2
      break
  }
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: box.rotation,
  }
}

function getUniformScaleForAnchor(anchor: string, scaleX: number, scaleY: number): number {
  if (anchor === 'top-center' || anchor === 'bottom-center') return scaleY
  if (anchor === 'middle-left' || anchor === 'middle-right') return scaleX
  return Math.max(scaleX, scaleY)
}

function getRenderedObjectScaleLimits(object: BoardObject): TransformScaleLimits {
  const bounds = getObjectSizeBounds(object.type)
  return {
    minX: bounds.min / 100,
    maxX: bounds.max / 100,
    minY: bounds.min / 100,
    maxY: bounds.max / 100,
    keepRatio: true,
  }
}
