import 'konva/skia-backend'
import Konva from 'konva'
import {
  type BackgroundType,
  type DecodeResult,
  type IconType,
  type StrategyObject,
} from 'xiv-strat-board'
import { getIconConfig } from '../utils/iconMap.ts'
import { getBoardUrl, getIconUrl } from '../utils/staticImage.ts'
import { loadImage, FontLibrary } from 'skia-canvas'
import { SCENE_HEIGHT, SCENE_WIDTH } from '../utils/resize.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  AOE_RADIUS,
  calcTextWidth,
  calculateCircleOffset as getCircleOffset,
  calculateDonutOffset as getDonutOffset,
  degreesToRadians,
  flippedScale,
  objectOpacity,
  objectScale,
  toSceneCoordinate,
} from '../../shared/boardGeometry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'assets',
  'fonts',
  'AlibabaPuHuiTi-3-55-Regular.ttf',
)

FontLibrary.use('AlibabaPuHuiTi', [FONT_PATH])

// --- Helper Functions from Components ---

// From Board.tsx
const boardMap: Record<BackgroundType, string> = {
  none: getBoardUrl('1'),
  checkered: getBoardUrl('2'),
  checkered_circle: getBoardUrl('3'),
  checkered_square: getBoardUrl('4'),
  grey: getBoardUrl('5'),
  grey_circle: getBoardUrl('6'),
  grey_square: getBoardUrl('7'),
}

async function createBoardLayer(backgroundType: BackgroundType = 'checkered') {
  const layer = new Konva.Layer()
  const imageUrl = boardMap[backgroundType]

  const imageObj = await loadImage(imageUrl)
  const konvaImage = new Konva.Image({
    image: imageObj,
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
  })
  layer.add(konvaImage)
  return layer
}

function createTextBlock(data: StrategyObject): Konva.Text {
  const text = data.text ?? ''
  const fontSize = 28
  const textWidth = calcTextWidth(text, fontSize)
  const offsetX = textWidth / 2
  const offsetY = fontSize / 2

  return new Konva.Text({
    text: data.text,
    fill: data.color,
    x: toSceneCoordinate(data.x),
    y: toSceneCoordinate(data.y),
    fontFamily: 'AlibabaPuHuiTi',
    fontSize: fontSize,
    offsetX: offsetX,
    offsetY: offsetY,
    shadowEnabled: true,
    shadowColor: 'black',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowOpacity: 1, // React-Konva default might handle this differently, but explicit is good
  })
}

// From LineBlock.tsx
function createLineBlock(data: StrategyObject): Konva.Group {
  const startX = toSceneCoordinate(data.x)
  const startY = toSceneCoordinate(data.y)
  const endX = toSceneCoordinate(data.endX ?? data.x)
  const endY = toSceneCoordinate(data.endY ?? data.y)
  const opacity = objectOpacity(data)

  const group = new Konva.Group()

  const line = new Konva.Line({
    points: [startX, startY, endX, endY],
    stroke: data.color ?? '#ff8000',
    strokeWidth: toSceneCoordinate(data.height ?? 6),
    opacity: opacity,
  })

  const startCircle = new Konva.Circle({
    x: startX,
    y: startY,
    radius: 8,
    fill: 'white',
    opacity: opacity,
    stroke: '#43A8D8',
    strokeWidth: 2,
  })

  const endCircle = new Konva.Circle({
    x: endX,
    y: endY,
    radius: 8,
    fill: 'white',
    opacity: opacity,
    stroke: '#43A8D8',
    strokeWidth: 2,
  })

  group.add(line)
  group.add(startCircle)
  group.add(endCircle)
  return group
}

// From LineAoe.tsx
function createLineAoe(data: StrategyObject): Konva.Rect {
  const width = data.width ?? 128
  const height = data.height ?? 128
  const scale = objectScale(data)
  const opacity = objectOpacity(data)

  return new Konva.Rect({
    x: toSceneCoordinate(data.x),
    y: toSceneCoordinate(data.y),
    offsetX: width,
    offsetY: height,
    width: toSceneCoordinate(width),
    height: toSceneCoordinate(height),
    fill: data.color ?? '#ff8000',
    scaleX: scale,
    scaleY: scale,
    rotation: data.angle ?? 0,
    opacity: opacity,
  })
}

function createDonut(data: StrategyObject): Konva.Group {
  const scale = objectScale(data)
  const opacity = objectOpacity(data)
  const outerRadius = AOE_RADIUS
  const innerRadius = toSceneCoordinate(data.donutRadius ?? 0)
  const arcAngle = data.arcAngle ?? 360

  const { offsetX, offsetY } = getDonutOffset({
    arcAngle,
    outerRadius,
    innerRadius,
  })

  const group = new Konva.Group({
    x: toSceneCoordinate(data.x),
    y: toSceneCoordinate(data.y) - 10,
    scaleX: flippedScale(scale, data.horizontalFlip),
    scaleY: flippedScale(scale, data.verticalFlip),
    opacity: opacity,
    offsetX: offsetX,
    offsetY: offsetY,
    rotation: data.angle ?? 0,
  })

  const shape = new Konva.Shape({
    sceneFunc: (ctx, shape) => {
      const angleRad = degreesToRadians(arcAngle)
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + angleRad

      ctx.beginPath()

      if (arcAngle === 360) {
        // 完整圆环
        ctx.arc(0, 0, outerRadius, 0, Math.PI * 2, false)
        ctx.arc(0, 0, innerRadius, 0, Math.PI * 2, true)
      } else {
        // 扇形圆环
        ctx.arc(0, 0, outerRadius, startAngle, endAngle, false)
        ctx.arc(0, 0, innerRadius, endAngle, startAngle, true)
        ctx.closePath()
      }

      ctx.fillStrokeShape(shape)
    },
    fill: 'orange',
  })

  group.add(shape)
  return group
}

async function createCircleAoe(data: StrategyObject) {
  const scale = objectScale(data)
  const opacity = objectOpacity(data)
  const arcAngle = data.type === 'fan_aoe' ? (data.arcAngle ?? 90) : 360
  const { offsetX, offsetY } = getCircleOffset(arcAngle)

  const group = new Konva.Group({
    x: toSceneCoordinate(data.x),
    y: toSceneCoordinate(data.y),
    rotation: data.angle ?? 0,
    scaleX: flippedScale(scale, data.horizontalFlip),
    scaleY: flippedScale(scale, data.verticalFlip),
    opacity: opacity,
    offsetX: offsetX,
    offsetY: offsetY,
  })

  if (arcAngle !== 360) {
    group.clipFunc((ctx) => {
      const r = 512
      const angleRad = degreesToRadians(arcAngle)
      const startAngle = -Math.PI / 2
      const endAngle = -Math.PI / 2 + angleRad

      ctx.beginPath()
      ctx.moveTo(512, 512)
      ctx.arc(512, 512, r, startAngle, endAngle)
      ctx.closePath()
    })
  }

  const circleSrc = getIconUrl('circle_aoe')
  const imageObj = await loadImage(circleSrc)
  const konvaImage = new Konva.Image({
    image: imageObj,
    width: 1024,
    height: 1024,
  })
  group.add(konvaImage)

  return group
}

// From NormalIcon.tsx
async function createNormalIcon(data: StrategyObject): Promise<Konva.Image> {
  const config = getIconConfig(data)
  // We can't return null like React component, so return a dummy group or handle skipping upstream
  // But since this function is expected to return a Konva Node, let's just make an Empty one or return null and handle it.
  if (!config) {
    console.warn(`No icon config found for type: ${data.type}`)
    return new Konva.Image()
  }

  const scale = objectScale(data)
  const opacity = objectOpacity(data)
  const iconUrl = getIconUrl(config.src)

  const imageObj = await loadImage(iconUrl)
  const imageNode = new Konva.Image({
    image: imageObj,
    width: toSceneCoordinate(config.size),
    height: toSceneCoordinate(config.size),
    offsetX: config.size,
    offsetY: config.size,
    x: toSceneCoordinate(data.x),
    y: toSceneCoordinate(data.y),
    scaleX: flippedScale(scale, data.horizontalFlip),
    scaleY: flippedScale(scale, data.verticalFlip),
    rotation: data.angle ?? 0,
    opacity: opacity,
    crop: config.crop,
  })

  return imageNode
}

// --- Main Render Function ---

async function createIcon(data: StrategyObject) {
  switch (data.type as IconType) {
    case 'line_aoe':
      return createLineAoe(data)
    case 'donut':
      return createDonut(data)
    case 'text':
      return createTextBlock(data)
    case 'line':
      return createLineBlock(data)
    case 'circle_aoe':
    case 'fan_aoe':
      return createCircleAoe(data)
    default:
      return createNormalIcon(data)
  }
}

export async function renderBoard(
  boardData: DecodeResult,
  containerId?: string,
) {
  // Initialize Stage
  const stage = new Konva.Stage({
    container: containerId,
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
  })

  // Create Layers
  const boardLayer = await createBoardLayer(boardData.boardBackground)
  const iconLayer = new Konva.Layer()

  // Add Icons (reversed order as in App.tsx)
  const items = [...boardData.objects].reverse().map((obj) => createIcon(obj))
  const resolvedItems = await Promise.all(items)
  resolvedItems.forEach((iconNode) => {
    if (iconNode) {
      iconLayer.add(iconNode)
    }
  })

  stage.add(boardLayer)
  stage.add(iconLayer)

  return stage
}
