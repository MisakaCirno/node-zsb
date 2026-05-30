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

  const { scaleX, scaleY } = getDirectionalScalesForAnchor(activeAnchor, baseBox, newBox)
  if (limits.keepRatio) {
    const uniformScale = getUniformScaleForAnchor(activeAnchor, scaleX, scaleY)
    const minScale = Math.max(limits.minX, limits.minY)
    const maxScale = Math.min(limits.maxX, limits.maxY)
    if (minScale > maxScale) return oldBox
    return createAnchoredFixedRatioBox(
      baseBox,
      clamp(uniformScale, minScale, maxScale),
      activeAnchor,
      newBox,
    )
  }
  return createAnchoredFreeScaleBox(
    baseBox,
    clamp(scaleX, limits.minX, limits.maxX),
    clamp(scaleY, limits.minY, limits.maxY),
    activeAnchor,
    newBox,
  )
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

function createAnchoredFreeScaleBox(
  baseBox: TransformBox,
  scaleX: number,
  scaleY: number,
  anchor: string,
  sourceBox: TransformBox,
): TransformBox {
  const width = baseBox.width * scaleX
  const height = baseBox.height * scaleY
  const centerX = baseBox.x + baseBox.width / 2
  const centerY = baseBox.y + baseBox.height / 2
  const right = baseBox.x + baseBox.width
  const bottom = baseBox.y + baseBox.height
  return {
    x: anchor.includes('left')
      ? right - width
      : anchor.includes('center')
        ? centerX - width / 2
        : baseBox.x,
    y: anchor.includes('top')
      ? bottom - height
      : anchor.includes('middle')
        ? centerY - height / 2
        : baseBox.y,
    width,
    height,
    rotation: sourceBox.rotation,
  }
}

function getDirectionalScalesForAnchor(
  anchor: string,
  baseBox: TransformBox,
  newBox: TransformBox,
): { scaleX: number, scaleY: number } {
  const right = baseBox.x + baseBox.width
  const bottom = baseBox.y + baseBox.height
  const newRight = newBox.x + newBox.width
  const newBottom = newBox.y + newBox.height
  return {
    scaleX: getDirectionalScale({
      anchor,
      baseSize: baseBox.width,
      negativeSide: 'left',
      positiveSide: 'right',
      negativeDistance: right - newBox.x,
      positiveDistance: newRight - baseBox.x,
      fallbackSize: newBox.width,
    }),
    scaleY: getDirectionalScale({
      anchor,
      baseSize: baseBox.height,
      negativeSide: 'top',
      positiveSide: 'bottom',
      negativeDistance: bottom - newBox.y,
      positiveDistance: newBottom - baseBox.y,
      fallbackSize: newBox.height,
    }),
  }
}

function getDirectionalScale({
  anchor,
  baseSize,
  fallbackSize,
  negativeDistance,
  negativeSide,
  positiveDistance,
  positiveSide,
}: {
  anchor: string
  baseSize: number
  fallbackSize: number
  negativeDistance: number
  negativeSide: string
  positiveDistance: number
  positiveSide: string
}): number {
  if (anchor.includes(negativeSide)) {
    return Math.max(0, negativeDistance) / baseSize
  }
  if (anchor.includes(positiveSide)) {
    return Math.max(0, positiveDistance) / baseSize
  }
  return Math.abs(fallbackSize / baseSize)
}

function getUniformScaleForAnchor(anchor: string, scaleX: number, scaleY: number): number {
  if (anchor === 'top-center' || anchor === 'bottom-center') return scaleY
  if (anchor === 'middle-left' || anchor === 'middle-right') return scaleX
  return Math.max(scaleX, scaleY)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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
