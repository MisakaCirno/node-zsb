import { getBrowserDocument } from './browser.js'
import { getSelectionBounds } from './objectAlignment.js'
import {
  BOARD_SCALE,
  DEFAULT_AOE_COLOR,
  DEFAULT_DONUT_COLOR,
  DEFAULT_LINE_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  STRATEGY_TEXT_FONT_FAMILY,
  STRATEGY_TEXT_STROKE_WIDTH,
  objectOpacity,
  objectScale,
} from '../shared/boardGeometry.js'
import type {
  BoardObject,
  Bounds,
  EditorState,
  IconConfig,
  LayerNode,
  LocalLayerPreset,
} from './types.js'

const PREVIEW_WIDTH = 180
const PREVIEW_HEIGHT = 128
const PREVIEW_PADDING = 16
const PREVIEW_MIN_BOUNDS_MARGIN = 18
const PREVIEW_BOUNDS_MARGIN_RATIO = 0.12

export async function renderPresetPreviewBlob(
  preset: LocalLayerPreset,
  iconConfigs: Record<string, IconConfig>,
): Promise<Blob> {
  const document = getBrowserDocument()
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_WIDTH
  canvas.height = PREVIEW_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return new Blob()
  context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)
  context.fillStyle = '#151a1f'
  context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)

  const objects = collectPresetObjects(preset)
  if (objects.length === 0) return canvasToBlob(canvas)

  const bounds = expandPreviewBounds(getSelectionBounds(objects, { iconConfigs } as EditorState))
  const scale = getPreviewScale(bounds)
  const offset = {
    x: PREVIEW_PADDING - bounds.left * scale + (getAvailableWidth() - getBoundsWidth(bounds) * scale) / 2,
    y: PREVIEW_PADDING - bounds.top * scale + (getAvailableHeight() - getBoundsHeight(bounds) * scale) / 2,
  }

  for (const object of objects) {
    await drawPresetObject(context, object, iconConfigs, scale, offset)
  }
  return canvasToBlob(canvas)
}

async function drawPresetObject(
  context: CanvasRenderingContext2D,
  object: BoardObject,
  iconConfigs: Record<string, IconConfig>,
  scale: number,
  offset: { x: number, y: number },
): Promise<void> {
  context.save()
  context.globalAlpha = objectOpacity(object, { hiddenOpacity: 0.35 })
  context.translate(object.x * scale + offset.x, object.y * scale + offset.y)
  if (!['line', 'text'].includes(object.type)) {
    context.rotate(((object.angle ?? 0) * Math.PI) / 180)
    context.scale(object.horizontalFlip ? -1 : 1, object.verticalFlip ? -1 : 1)
  }
  const previewScale = objectScale(object) * scale
  if (object.type === 'line') {
    drawLine(context, object, scale)
  } else if (object.type === 'text') {
    drawText(context, object, previewScale)
  } else if (object.type === 'line_aoe') {
    drawLineAoe(context, object, previewScale)
  } else if (object.type === 'circle_aoe' || object.type === 'fan_aoe') {
    drawCircleAoe(context, object, previewScale)
  } else if (object.type === 'donut') {
    drawDonut(context, object, previewScale)
  } else {
    await drawIcon(context, object, iconConfigs, previewScale)
  }
  context.restore()
}

function drawLine(context: CanvasRenderingContext2D, object: BoardObject, scale: number): void {
  context.strokeStyle = object.color ?? DEFAULT_LINE_COLOR
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, 0)
  context.lineTo(((object.endX ?? object.x) - object.x) * scale, ((object.endY ?? object.y) - object.y) * scale)
  context.stroke()
}

function drawText(context: CanvasRenderingContext2D, object: BoardObject, scale: number): void {
  context.fillStyle = object.color ?? DEFAULT_TEXT_COLOR
  context.strokeStyle = 'black'
  context.lineWidth = Math.max(1, (STRATEGY_TEXT_STROKE_WIDTH / BOARD_SCALE) * scale)
  context.font = `${Math.max(8, (DEFAULT_TEXT_FONT_SIZE / BOARD_SCALE) * scale)}px ${STRATEGY_TEXT_FONT_FAMILY}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.strokeText(object.text ?? 'T', 0, 0)
  context.fillText(object.text ?? 'T', 0, 0)
}

function drawLineAoe(context: CanvasRenderingContext2D, object: BoardObject, scale: number): void {
  const width = (object.width ?? 128) * scale
  const height = (object.height ?? 128) * scale
  context.fillStyle = object.color ?? DEFAULT_LINE_COLOR
  context.fillRect(-width / 2, -height / 2, width, height)
}

function drawCircleAoe(context: CanvasRenderingContext2D, object: BoardObject, scale: number): void {
  const radius = 256 * scale
  const arcAngle = object.type === 'fan_aoe' ? (object.arcAngle ?? 90) : 360
  context.fillStyle = DEFAULT_AOE_COLOR
  context.beginPath()
  if (arcAngle >= 360) {
    context.arc(0, 0, radius, 0, Math.PI * 2)
  } else {
    context.moveTo(0, 0)
    context.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + (arcAngle * Math.PI) / 180)
    context.closePath()
  }
  context.fill()
}

function drawDonut(context: CanvasRenderingContext2D, object: BoardObject, scale: number): void {
  const outer = 256 * scale
  const inner = (object.donutRadius ?? 80) * scale
  const arcAngle = object.arcAngle ?? 360
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + (arcAngle * Math.PI) / 180
  context.fillStyle = DEFAULT_DONUT_COLOR
  context.beginPath()
  if (arcAngle >= 360) {
    context.arc(0, 0, outer, 0, Math.PI * 2)
    context.arc(0, 0, inner, 0, Math.PI * 2, true)
  } else {
    context.arc(0, 0, outer, startAngle, endAngle)
    context.arc(0, 0, inner, endAngle, startAngle, true)
    context.closePath()
  }
  context.fill()
}

async function drawIcon(
  context: CanvasRenderingContext2D,
  object: BoardObject,
  iconConfigs: Record<string, IconConfig>,
  scale: number,
): Promise<void> {
  const config = iconConfigs[object.type]
  if (!config) {
    drawFallbackIcon(context, object.type, scale)
    return
  }
  try {
    const image = await loadImage(`/assets/objects/${config.src}.webp`)
    const size = config.size * scale
    context.drawImage(
      image,
      config.crop.x,
      config.crop.y,
      config.crop.width,
      config.crop.height,
      -size / 2,
      -size / 2,
      size,
      size,
    )
  } catch {
    drawFallbackIcon(context, object.type, scale)
  }
}

function drawFallbackIcon(context: CanvasRenderingContext2D, type: string, scale: number): void {
  const size = 32 * scale
  context.fillStyle = '#20362f'
  context.strokeStyle = '#66c2a5'
  context.lineWidth = 1
  context.fillRect(-size / 2, -size / 2, size, size)
  context.strokeRect(-size / 2, -size / 2, size, size)
  context.fillStyle = '#eef2f3'
  context.font = `${Math.max(8, 11 * scale)}px "Segoe UI", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(type.slice(0, 2), 0, 0)
}

function collectPresetObjects(preset: LocalLayerPreset): BoardObject[] {
  return collectLayerObjectIds(preset.layers)
    .map((id) => preset.objects[id])
    .filter((object): object is BoardObject => Boolean(object))
}

function collectLayerObjectIds(layers: LayerNode[]): string[] {
  const ids: string[] = []
  for (const node of layers) {
    if (node.type === 'object') {
      ids.push(node.id)
      continue
    }
    ids.push(...collectLayerObjectIds(node.children ?? []))
  }
  return [...new Set(ids)]
}

function getPreviewScale(bounds: Bounds): number {
  return Math.min(
    getAvailableWidth() / Math.max(1, getBoundsWidth(bounds)),
    getAvailableHeight() / Math.max(1, getBoundsHeight(bounds)),
  )
}

function expandPreviewBounds(bounds: Bounds): Bounds {
  const width = getBoundsWidth(bounds)
  const height = getBoundsHeight(bounds)
  const margin = Math.max(
    PREVIEW_MIN_BOUNDS_MARGIN,
    Math.max(width, height) * PREVIEW_BOUNDS_MARGIN_RATIO,
  )
  return {
    bottom: bounds.bottom + margin,
    left: bounds.left - margin,
    right: bounds.right + margin,
    top: bounds.top - margin,
  }
}

function getAvailableWidth(): number {
  return PREVIEW_WIDTH - PREVIEW_PADDING * 2
}

function getAvailableHeight(): number {
  return PREVIEW_HEIGHT - PREVIEW_PADDING * 2
}

function getBoundsWidth(bounds: Bounds): number {
  return bounds.right - bounds.left
}

function getBoundsHeight(bounds: Bounds): number {
  return bounds.bottom - bounds.top
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ?? dataUrlToBlob(canvas.toDataURL('image/png')))
    }, 'image/png')
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta = '', data = ''] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? 'image/png'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}
