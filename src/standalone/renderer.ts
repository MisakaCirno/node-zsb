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

// From TextBlock.tsx
function calcTextWidth(text: string, fontSize: number) {
  const averageCharWidth = fontSize * 0.6
  let width = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const isAscii = char!.charCodeAt(0) < 128
    width += isAscii ? averageCharWidth : averageCharWidth * 2
  }
  return width
}

function createTextBlock(data: StrategyObject): Konva.Text {
  const text = data.text ?? ''
  const fontSize = 28
  const textWidth = calcTextWidth(text, fontSize)
  const offsetX = textWidth / 2
  const offsetY = fontSize / 2

  FontLibrary.use('AlibabaPuHuiTi', [
    'src/assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf',
  ])

  return new Konva.Text({
    text: data.text,
    fill: data.color,
    x: data.x * 2,
    y: data.y * 2,
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
  const startX = data.x * 2
  const startY = data.y * 2
  const endX = (data.endX ?? data.x) * 2
  const endY = (data.endY ?? data.y) * 2
  const opacity = data.hidden ? 0 : (100 - (data.transparency ?? 0)) / 100

  const group = new Konva.Group()

  const line = new Konva.Line({
    points: [startX, startY, endX, endY],
    stroke: data.color ?? '#ff8000',
    strokeWidth: (data.height ?? 6) * 2,
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
  const scale = (data.size ?? 100) / 100
  const opacity = data.hidden ? 0 : (100 - (data.transparency ?? 0)) / 100

  return new Konva.Rect({
    x: data.x * 2,
    y: data.y * 2,
    offsetX: width,
    offsetY: height,
    width: width * 2,
    height: height * 2,
    fill: data.color ?? '#ff8000',
    scaleX: scale,
    scaleY: scale,
    rotation: data.angle ?? 0,
    opacity: opacity,
  })
}

// From Donut.tsx
function calculateDonutOffset({
  arcAngle,
  outerRadius,
  innerRadius,
}: {
  arcAngle: number
  outerRadius: number
  innerRadius: number
}) {
  if (arcAngle === 360) {
    return { offsetX: 0, offsetY: 0 }
  }

  const angleRad = (arcAngle * Math.PI) / 180
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + angleRad

  // 计算扇形的边界框
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const points = []

  // 外圆弧端点
  points.push({
    x: outerRadius * Math.cos(startAngle),
    y: outerRadius * Math.sin(startAngle),
  })
  points.push({
    x: outerRadius * Math.cos(endAngle),
    y: outerRadius * Math.sin(endAngle),
  })

  // 内圆弧端点
  points.push({
    x: innerRadius * Math.cos(startAngle),
    y: innerRadius * Math.sin(startAngle),
  })
  points.push({
    x: innerRadius * Math.cos(endAngle),
    y: innerRadius * Math.sin(endAngle),
  })

  // 检查圆弧是否穿过关键角度点（0°, 90°, 180°, 270°）
  const checkAngle = (angle: number) => {
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const start = ((startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    let end = ((endAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

    if (end < start) end += 2 * Math.PI
    const check = normalized < start ? normalized + 2 * Math.PI : normalized

    return check >= start && check <= end
  }

  // 0° (右)
  if (checkAngle(0)) points.push({ x: outerRadius, y: 0 })
  // 90° (下)
  if (checkAngle(Math.PI / 2)) points.push({ x: 0, y: outerRadius })
  // 180° (左)
  if (checkAngle(Math.PI)) points.push({ x: -outerRadius, y: 0 })
  // 270° (上)
  if (checkAngle((3 * Math.PI) / 2)) points.push({ x: 0, y: -outerRadius })

  points.forEach((p) => {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  })

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return { offsetX: centerX, offsetY: centerY }
}

function createDonut(data: StrategyObject): Konva.Group {
  const scale = (data.size ?? 100) / 100
  const opacity = data.hidden ? 0 : (100 - (data.transparency ?? 0)) / 100
  const outerRadius = 512
  const innerRadius = (data.donutRadius ?? 0) * 2
  const arcAngle = data.arcAngle ?? 360

  const { offsetX, offsetY } = calculateDonutOffset({
    arcAngle,
    outerRadius,
    innerRadius,
  })

  const group = new Konva.Group({
    x: data.x * 2,
    y: data.y * 2 - 10,
    scaleX: scale * (data.horizontalFlip ? -1 : 1),
    scaleY: scale * (data.verticalFlip ? -1 : 1),
    opacity: opacity,
    offsetX: offsetX,
    offsetY: offsetY,
    rotation: data.angle ?? 0,
  })

  const shape = new Konva.Shape({
    sceneFunc: (ctx, shape) => {
      const angleRad = (arcAngle * Math.PI) / 180
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

// From CircleAoe.tsx
function calculateCircleOffset(arcAngle: number) {
  if (arcAngle === 360) {
    return { offsetX: 512, offsetY: 512 }
  }

  const r = 512
  const angleRad = (arcAngle * Math.PI) / 180
  const startAngle = -Math.PI / 2
  const endAngle = -Math.PI / 2 + angleRad

  let minX = 512
  let maxX = 512
  let minY = 512
  let maxY = 512

  const startX = 512 + r * Math.cos(startAngle)
  const startY = 512 + r * Math.sin(startAngle)
  const endX = 512 + r * Math.cos(endAngle)
  const endY = 512 + r * Math.sin(endAngle)

  minX = Math.min(minX, startX, endX)
  maxX = Math.max(maxX, startX, endX)
  minY = Math.min(minY, startY, endY)
  maxY = Math.max(maxY, startY, endY)

  const checkAngle = (angle: number) => {
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const start = ((startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    let end = ((endAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

    if (end < start) end += 2 * Math.PI
    const check = normalized < start ? normalized + 2 * Math.PI : normalized

    return check >= start && check <= end
  }

  if (checkAngle(0)) maxX = Math.max(maxX, 512 + r)
  if (checkAngle(Math.PI / 2)) maxY = Math.max(maxY, 512 + r)
  if (checkAngle(Math.PI)) minX = Math.min(minX, 512 - r)
  if (checkAngle((3 * Math.PI) / 2)) minY = Math.min(minY, 512 - r)

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return { offsetX: centerX, offsetY: centerY }
}

async function createCircleAoe(data: StrategyObject) {
  const scale = (data.size ?? 100) / 100
  const opacity = data.hidden ? 0 : (100 - (data.transparency ?? 0)) / 100
  const arcAngle = data.type === 'fan_aoe' ? (data.arcAngle ?? 90) : 360
  const { offsetX, offsetY } = calculateCircleOffset(arcAngle)

  const group = new Konva.Group({
    x: data.x * 2,
    y: data.y * 2,
    rotation: data.angle ?? 0,
    scaleX: scale * (data.horizontalFlip ? -1 : 1),
    scaleY: scale * (data.verticalFlip ? -1 : 1),
    opacity: opacity,
    offsetX: offsetX,
    offsetY: offsetY,
  })

  if (arcAngle !== 360) {
    group.clipFunc((ctx) => {
      const r = 512
      const angleRad = (arcAngle * Math.PI) / 180
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

  const scale = (data.size ?? 100) / 100
  const opacity = data.hidden ? 0 : (100 - (data.transparency ?? 0)) / 100
  const iconUrl = getIconUrl(config.src)

  const imageObj = await loadImage(iconUrl)
  const imageNode = new Konva.Image({
    image: imageObj,
    width: config.size * 2,
    height: config.size * 2,
    offsetX: config.size,
    offsetY: config.size,
    x: data.x * 2,
    y: data.y * 2,
    scaleX: scale * (data.horizontalFlip ? -1 : 1),
    scaleY: scale * (data.verticalFlip ? -1 : 1),
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
  const items = boardData.objects.reverse().map((obj) => createIcon(obj))
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
