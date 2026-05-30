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
  DEFAULT_TEXT_COLOR,
  STRATEGY_TEXT_FONT_PRIMARY,
} from '../../shared/boardGeometry.js'
import {
  createCircleAoeRenderSpec,
  createDonutRenderSpec,
  createIconRenderSpec,
  createLineAoeRenderSpec,
  createLineRenderSpec,
  createTextRenderSpec,
  traceCircleAoeClipPath,
  traceDonutPath,
} from '../../shared/objectRendering.js'
import { createStrategyTextStyle } from '../../shared/textRendering.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'assets',
  'fonts',
  'AlibabaPuHuiTi-3-55-Regular.ttf',
)

FontLibrary.use(STRATEGY_TEXT_FONT_PRIMARY, [FONT_PATH])

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
  const style = createStrategyTextStyle(data.text ?? '', data.color ?? DEFAULT_TEXT_COLOR)
  const spec = createTextRenderSpec(data)
  return new Konva.Text({
    ...style,
    x: spec.x,
    y: spec.y,
    opacity: spec.opacity,
    shadowOpacity: 1,
  })
}

// From LineBlock.tsx
function createLineBlock(data: StrategyObject): Konva.Group {
  const spec = createLineRenderSpec(data)
  const group = new Konva.Group({
    x: spec.startX,
    y: spec.startY,
    opacity: spec.opacity,
  })

  const line = new Konva.Line({
    points: [0, 0, spec.endLocalX, spec.endLocalY],
    stroke: spec.stroke,
    strokeWidth: spec.strokeWidth,
    lineCap: spec.lineCap,
  })

  const startCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: 8,
    fill: 'white',
    stroke: '#43A8D8',
    strokeWidth: 2,
  })

  const endCircle = new Konva.Circle({
    x: spec.endLocalX,
    y: spec.endLocalY,
    radius: 8,
    fill: 'white',
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
  const spec = createLineAoeRenderSpec(data)

  return new Konva.Rect({
    x: spec.x,
    y: spec.y,
    offsetX: spec.offsetX,
    offsetY: spec.offsetY,
    width: spec.width,
    height: spec.height,
    fill: spec.fill,
    scaleX: spec.scaleX,
    scaleY: spec.scaleY,
    rotation: spec.rotation,
    opacity: spec.opacity,
  })
}

function createDonut(data: StrategyObject): Konva.Group {
  const spec = createDonutRenderSpec(data)

  const group = new Konva.Group({
    x: spec.x,
    y: spec.y,
    scaleX: spec.scaleX,
    scaleY: spec.scaleY,
    opacity: spec.opacity,
    offsetX: spec.offsetX,
    offsetY: spec.offsetY,
    rotation: spec.rotation,
  })

  const shape = new Konva.Shape({
    sceneFunc: (ctx, shape) => {
      traceDonutPath(ctx, spec)

      ctx.fillStrokeShape(shape)
    },
    fill: spec.fill,
  })

  group.add(shape)
  return group
}

async function createCircleAoe(data: StrategyObject) {
  const spec = createCircleAoeRenderSpec(data)

  const group = new Konva.Group({
    x: spec.x,
    y: spec.y,
    rotation: spec.rotation,
    scaleX: spec.scaleX,
    scaleY: spec.scaleY,
    opacity: spec.opacity,
    offsetX: spec.offsetX,
    offsetY: spec.offsetY,
  })

  if (spec.arcAngle !== 360) {
    group.clipFunc((ctx) => {
      traceCircleAoeClipPath(ctx, spec)
    })
  }

  const circleSrc = getIconUrl('circle_aoe')
  const imageObj = await loadImage(circleSrc)
  const konvaImage = new Konva.Image({
    image: imageObj,
    width: spec.imageWidth,
    height: spec.imageHeight,
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

  const iconUrl = getIconUrl(config.src)

  const imageObj = await loadImage(iconUrl)
  const spec = createIconRenderSpec(data, config.size)
  const imageNode = new Konva.Image({
    image: imageObj,
    width: spec.width,
    height: spec.height,
    offsetX: spec.offsetX,
    offsetY: spec.offsetY,
    x: spec.x,
    y: spec.y,
    scaleX: spec.scaleX,
    scaleY: spec.scaleY,
    rotation: spec.rotation,
    opacity: spec.opacity,
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
