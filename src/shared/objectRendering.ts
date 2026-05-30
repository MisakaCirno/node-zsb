import {
  AOE_RADIUS,
  DEFAULT_DONUT_COLOR,
  DEFAULT_LINE_COLOR,
  calculateCircleOffset,
  calculateDonutOffset,
  flippedScale,
  normalizeLineAoeHeight,
  normalizeLineAoeWidth,
  objectOpacity,
  objectScale,
  toSceneCoordinate,
} from './boardGeometry.js'

export interface RenderObjectLike {
  type: string
  x: number
  y: number
  endX?: number
  endY?: number
  size?: number
  width?: number
  height?: number
  color?: string
  angle?: number
  arcAngle?: number
  donutRadius?: number
  horizontalFlip?: boolean
  verticalFlip?: boolean
  hidden?: boolean
  transparency?: number
}

export interface RenderOpacityOptions {
  hiddenOpacity?: number
}

export interface LineRenderSpec {
  startX: number
  startY: number
  endX: number
  endY: number
  endLocalX: number
  endLocalY: number
  stroke: string
  strokeWidth: number
  opacity: number
}

export interface LineAoeRenderSpec {
  x: number
  y: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  logicalWidth: number
  logicalHeight: number
  fill: string
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

export interface CircleAoeRenderSpec {
  x: number
  y: number
  offsetX: number
  offsetY: number
  imageWidth: number
  imageHeight: number
  clipRadius: number
  arcAngle: number
  startAngle: number
  endAngle: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

export interface DonutRenderSpec {
  x: number
  y: number
  offsetX: number
  offsetY: number
  outerRadius: number
  innerRadius: number
  arcAngle: number
  startAngle: number
  endAngle: number
  fill: string
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

export interface IconRenderSpec {
  x: number
  y: number
  width: number
  height: number
  offsetX: number
  offsetY: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

export function createLineRenderSpec(
  object: RenderObjectLike,
  options: RenderOpacityOptions = {},
): LineRenderSpec {
  const startX = toSceneCoordinate(object.x)
  const startY = toSceneCoordinate(object.y)
  const endX = toSceneCoordinate(object.endX ?? object.x)
  const endY = toSceneCoordinate(object.endY ?? object.y)
  return {
    startX,
    startY,
    endX,
    endY,
    endLocalX: endX - startX,
    endLocalY: endY - startY,
    stroke: object.color ?? DEFAULT_LINE_COLOR,
    strokeWidth: toSceneCoordinate(object.height ?? 6),
    opacity: objectOpacity(object, options),
  }
}

export function createLineAoeRenderSpec(
  object: RenderObjectLike,
  options: RenderOpacityOptions = {},
): LineAoeRenderSpec {
  const logicalWidth = normalizeLineAoeWidth(object.width)
  const logicalHeight = normalizeLineAoeHeight(object.height)
  const scale = objectScale(object)
  return {
    x: toSceneCoordinate(object.x),
    y: toSceneCoordinate(object.y),
    offsetX: logicalWidth,
    offsetY: logicalHeight,
    width: toSceneCoordinate(logicalWidth),
    height: toSceneCoordinate(logicalHeight),
    logicalWidth,
    logicalHeight,
    fill: object.color ?? DEFAULT_LINE_COLOR,
    scaleX: flippedScale(scale, object.horizontalFlip),
    scaleY: flippedScale(scale, object.verticalFlip),
    rotation: object.angle ?? 0,
    opacity: objectOpacity(object, options),
  }
}

export function createCircleAoeRenderSpec(
  object: RenderObjectLike,
  options: RenderOpacityOptions = {},
): CircleAoeRenderSpec {
  const arcAngle = object.type === 'fan_aoe' ? (object.arcAngle ?? 90) : 360
  const scale = objectScale(object)
  const startAngle = -Math.PI / 2
  const offset = calculateCircleOffset(arcAngle)
  return {
    x: toSceneCoordinate(object.x),
    y: toSceneCoordinate(object.y),
    offsetX: offset.offsetX,
    offsetY: offset.offsetY,
    imageWidth: AOE_RADIUS * 2,
    imageHeight: AOE_RADIUS * 2,
    clipRadius: AOE_RADIUS,
    arcAngle,
    startAngle,
    endAngle: startAngle + (arcAngle * Math.PI) / 180,
    scaleX: flippedScale(scale, object.horizontalFlip),
    scaleY: flippedScale(scale, object.verticalFlip),
    rotation: object.angle ?? 0,
    opacity: objectOpacity(object, options),
  }
}

export function createDonutRenderSpec(
  object: RenderObjectLike,
  options: RenderOpacityOptions = {},
): DonutRenderSpec {
  const scale = objectScale(object)
  const arcAngle = object.arcAngle ?? 360
  const startAngle = -Math.PI / 2
  const innerRadius = toSceneCoordinate(object.donutRadius ?? 80)
  const offset = calculateDonutOffset({
    arcAngle,
    outerRadius: AOE_RADIUS,
    innerRadius,
  })
  return {
    x: toSceneCoordinate(object.x),
    y: toSceneCoordinate(object.y),
    offsetX: offset.offsetX,
    offsetY: offset.offsetY,
    outerRadius: AOE_RADIUS,
    innerRadius,
    arcAngle,
    startAngle,
    endAngle: startAngle + (arcAngle * Math.PI) / 180,
    fill: DEFAULT_DONUT_COLOR,
    scaleX: flippedScale(scale, object.horizontalFlip),
    scaleY: flippedScale(scale, object.verticalFlip),
    rotation: object.angle ?? 0,
    opacity: objectOpacity(object, options),
  }
}

export function createIconRenderSpec(
  object: RenderObjectLike,
  iconSize: number,
  options: RenderOpacityOptions = {},
): IconRenderSpec {
  const scale = objectScale(object)
  return {
    x: toSceneCoordinate(object.x),
    y: toSceneCoordinate(object.y),
    width: toSceneCoordinate(iconSize),
    height: toSceneCoordinate(iconSize),
    offsetX: iconSize,
    offsetY: iconSize,
    scaleX: flippedScale(scale, object.horizontalFlip),
    scaleY: flippedScale(scale, object.verticalFlip),
    rotation: object.angle ?? 0,
    opacity: objectOpacity(object, options),
  }
}
