import {
  LOGICAL_SCALE,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from './constants.js'
import {
  clamp,
  normalizeAngle,
  rotatePoint,
} from './geometry.js'
import {
  calcTextWidth,
  calculateCircleOffset,
  objectOpacity,
  objectScale,
  toLogicalCoordinate,
  toSceneCoordinate,
} from '../shared/boardGeometry.js'
import { getSelectedIndexes } from './editorState.js'
import { getObjectBounds } from './objectAlignment.js'

const MARQUEE_DRAG_THRESHOLD = 4
const MARQUEE_THEMES = {
  contained: {
    fill: 'rgba(85, 170, 255, 0.16)',
    stroke: '#55aaff',
  },
  intersect: {
    fill: 'rgba(102, 194, 165, 0.16)',
    stroke: '#66c2a5',
  },
}

export function createStageRenderer({
  container,
  state,
  normalizePoint,
  normalizeCoordinate,
  recordHistory,
  renderAll,
  renderInspector,
  renderLayers,
  selectObject,
  selectObjects,
  showStatus,
}) {
  const stage = new Konva.Stage({
    container,
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
  })
  const boardLayer = new Konva.Layer()
  const gridLayer = new Konva.Layer({ listening: false })
  const objectLayer = new Konva.Layer()
  const transformerLayer = new Konva.Layer()
  const marqueeLayer = new Konva.Layer()
  const marqueeRect = new Konva.Rect({
    fill: MARQUEE_THEMES.contained.fill,
    listening: false,
    stroke: MARQUEE_THEMES.contained.stroke,
    strokeWidth: 1.5,
    visible: false,
  })
  const transformer = new Konva.Transformer({
    rotateEnabled: true,
    keepRatio: true,
    enabledAnchors: [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ],
    borderStroke: '#66c2a5',
    anchorStroke: '#66c2a5',
  })

  stage.add(boardLayer)
  stage.add(gridLayer)
  stage.add(objectLayer)
  stage.add(transformerLayer)
  stage.add(marqueeLayer)
  transformerLayer.add(transformer)
  marqueeLayer.add(marqueeRect)

  let marqueeStart = null
  let didMarqueeDrag = false
  let suppressNextStageClick = false

  stage.on('click tap', (event) => {
    if (event.evt?.button && event.evt.button !== 0) return
    if (suppressNextStageClick) {
      suppressNextStageClick = false
      return
    }
    if (event.target === stage || event.target.getLayer() === boardLayer) {
      selectObject(-1)
    }
  })
  stage.on('mousedown touchstart', (event) => {
    if (event.evt?.button && event.evt.button !== 0) return
    if (event.target !== stage && event.target.getLayer() !== boardLayer) return
    marqueeStart = getPointerScenePoint()
    didMarqueeDrag = false
    marqueeRect.visible(false)
  })
  stage.on('mousemove touchmove', () => {
    if (!marqueeStart) return
    const current = getPointerScenePoint()
    if (!current) return
    updateMarqueeRect(marqueeStart, current)
  })
  stage.on('mouseup touchend', () => {
    if (!marqueeStart) return
    const current = getPointerScenePoint()
    if (current && didMarqueeDrag) {
      selectObjects(getMarqueeSelectedIndexes(
        getLogicalRect(marqueeStart, current),
        getMarqueeMode(marqueeStart, current),
      ))
      suppressNextStageClick = true
    }
    marqueeStart = null
    didMarqueeDrag = false
    marqueeRect.visible(false)
    marqueeLayer.batchDraw()
  })

  async function renderBoard() {
    boardLayer.destroyChildren()
    const backgroundId = state.backgrounds[state.board.boardBackground ?? 'checkered'] ?? '2'
    const image = await loadImage(`/assets/background/${backgroundId}.webp`)
    boardLayer.add(
      new Konva.Image({
        image,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
      }),
    )
    boardLayer.draw()
  }

  function renderGrid() {
    gridLayer.destroyChildren()
    if (!state.showGrid) {
      gridLayer.draw()
      return
    }

    const gridStep = state.gridSize * LOGICAL_SCALE
    for (let x = 0, index = 0; x <= SCENE_WIDTH; x += gridStep, index++) {
      gridLayer.add(createGridLine([x, 0, x, SCENE_HEIGHT], index))
    }
    for (let y = 0, index = 0; y <= SCENE_HEIGHT; y += gridStep, index++) {
      gridLayer.add(createGridLine([0, y, SCENE_WIDTH, y], index))
    }
    gridLayer.draw()
  }

  async function renderObjects() {
    objectLayer.destroyChildren()
    const nodes = []
    for (let index = state.board.objects.length - 1; index >= 0; index--) {
      const object = state.board.objects[index]
      const node = await createNode(object, index)
      if (node) {
        nodes.push(node)
        objectLayer.add(node)
      }
    }
    objectLayer.draw()
    const selectedIndexes = getSelectedIndexes(state)
    const selectedObjects = selectedIndexes.map((index) => state.board.objects[index])
    const selectedNodes = nodes.filter((node) => {
      const index = node.getAttr('objectIndex')
      return selectedIndexes.includes(index) && !state.board.objects[index]?.locked
    })
    const canScaleSelection = selectedObjects.length > 0
      && selectedObjects.every((object) => object?.type !== 'line')
    transformer.enabledAnchors(canScaleSelection ? [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ] : [])
    transformer.nodes(selectedNodes)
    transformerLayer.draw()
  }

  function createGridLine(points, index) {
    const major = index % 4 === 0
    return new Konva.Line({
      points,
      stroke: '#d9f3ff',
      strokeWidth: major ? 1.1 : 0.7,
      opacity: major ? 0.28 : 0.14,
      listening: false,
    })
  }

  function updateMarqueeRect(start, current) {
    const width = current.x - start.x
    const height = current.y - start.y
    didMarqueeDrag = didMarqueeDrag
      || Math.abs(width) > MARQUEE_DRAG_THRESHOLD
      || Math.abs(height) > MARQUEE_DRAG_THRESHOLD
    if (!didMarqueeDrag) return
    const theme = getMarqueeTheme(start, current)
    marqueeRect.setAttrs({
      fill: theme.fill,
      height: Math.abs(height),
      stroke: theme.stroke,
      visible: true,
      width: Math.abs(width),
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
    })
    marqueeLayer.batchDraw()
  }

  function getMarqueeSelectedIndexes(rect, mode) {
    const selected = []
    state.board.objects.forEach((object, index) => {
      if (objectMatchesMarquee(getObjectBounds(object, state), rect, mode)) {
        selected.push(index)
      }
    })
    return selected
  }

  function objectMatchesMarquee(objectBounds, rect, mode) {
    if (mode === 'intersect') {
      return objectBounds.right >= rect.left
        && objectBounds.left <= rect.right
        && objectBounds.bottom >= rect.top
        && objectBounds.top <= rect.bottom
    }
    return objectBounds.left >= rect.left
      && objectBounds.right <= rect.right
      && objectBounds.top >= rect.top
      && objectBounds.bottom <= rect.bottom
  }

  function getMarqueeMode(start, current) {
    return current.x >= start.x ? 'contained' : 'intersect'
  }

  function getMarqueeTheme(start, current) {
    return MARQUEE_THEMES[getMarqueeMode(start, current)]
  }

  function getLogicalRect(start, current) {
    const left = toLogicalCoordinate(Math.min(start.x, current.x))
    const right = toLogicalCoordinate(Math.max(start.x, current.x))
    const top = toLogicalCoordinate(Math.min(start.y, current.y))
    const bottom = toLogicalCoordinate(Math.max(start.y, current.y))
    return { left, right, top, bottom }
  }

  function getPointerScenePoint() {
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    return stage.getAbsoluteTransform().copy().invert().point(pointer)
  }

  async function createNode(object, index) {
    let node
    switch (object.type) {
      case 'text':
        node = createTextNode(object)
        break
      case 'line':
        node = createLineNode(object)
        break
      case 'line_aoe':
        node = createLineAoeNode(object)
        break
      case 'circle_aoe':
      case 'fan_aoe':
        node = await createCircleAoeNode(object)
        break
      case 'donut':
        node = createDonutNode(object)
        break
      default:
        node = await createIconNode(object)
    }
    node.setAttr('objectIndex', index)
    node.draggable(!object.locked)
    node.opacity(objectOpacity(object, { hiddenOpacity: 0.15 }))
    node.on('click tap', (event) => {
      if (event.evt?.button && event.evt.button !== 0) return
      event.cancelBubble = true
      selectObject(index, {
        revealInLayers: true,
        toggle: Boolean(event.evt?.shiftKey || event.evt?.ctrlKey || event.evt?.metaKey),
      })
    })
    node.on('dragstart', () => {
      recordHistory()
    })
    node.on('dragend', () => {
      handleDragEnd(node, object)
    })
    node.on('transformstart', () => {
      recordHistory()
    })
    node.on('transformend', () => {
      commitNodeTransform(node, object)
    })
    return node
  }

  function commitNodeTransform(node, object) {
    if (object.type !== 'line') {
      object.size = clamp(
        Math.round(Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY())) * 100),
        10,
        300,
      )
      node.scaleX(objectScale(object))
      node.scaleY(objectScale(object))
    }
    if (object.type === 'line') {
      node.scaleX(1)
      node.scaleY(1)
    }
    if (node.x() !== undefined && node.y() !== undefined) {
      const point = normalizePoint(
        toLogicalCoordinate(node.x()),
        toLogicalCoordinate(node.y()),
      )
      object.x = point.x
      object.y = point.y
    }
    object.angle = normalizeAngle(node.rotation())
    renderInspector()
    renderLayers()
    renderAll()
  }

  function createTextNode(object) {
    return new Konva.Text({
      text: object.text ?? '',
      fill: object.color ?? '#ffffff',
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      fontSize: 28,
      fontFamily: 'Arial',
      offsetX: calcTextWidth(object.text ?? '', 28) / 2,
      offsetY: 14,
      rotation: object.angle ?? 0,
      scaleX: objectScale(object),
      scaleY: objectScale(object),
      shadowEnabled: true,
      shadowColor: 'black',
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
    })
  }

  function createLineNode(object) {
    const startX = toSceneCoordinate(object.x)
    const startY = toSceneCoordinate(object.y)
    const endX = toSceneCoordinate(object.endX ?? object.x)
    const endY = toSceneCoordinate(object.endY ?? object.y)
    const endLocalX = endX - startX
    const endLocalY = endY - startY
    const group = new Konva.Group({
      x: startX,
      y: startY,
      rotation: object.angle ?? 0,
    })
    const line = new Konva.Line({
      points: [0, 0, endLocalX, endLocalY],
      stroke: object.color ?? '#ff8000',
      strokeWidth: toSceneCoordinate(object.height ?? 6),
      lineCap: 'round',
    })
    const startHandle = createLineHandle(0, 0, !object.locked)
    const endHandle = createLineHandle(endLocalX, endLocalY, !object.locked)
    bindLineHandleDrag({
      object,
      group,
      line,
      startHandle,
      endHandle,
    })
    group.add(line)
    group.add(startHandle)
    group.add(endHandle)
    return group
  }

  function createLineHandle(x, y, draggable) {
    return new Konva.Circle({
      x,
      y,
      radius: 8,
      fill: 'white',
      stroke: '#43A8D8',
      strokeWidth: 2,
      draggable,
    })
  }

  function bindLineHandleDrag({ object, group, line, startHandle, endHandle }) {
    for (const handle of [startHandle, endHandle]) {
      handle.on('dragstart', (event) => {
        event.cancelBubble = true
        recordHistory()
      })
      handle.on('dragmove', (event) => {
        event.cancelBubble = true
        line.points([startHandle.x(), startHandle.y(), endHandle.x(), endHandle.y()])
        objectLayer.batchDraw()
      })
      handle.on('dragend', (event) => {
        event.cancelBubble = true
        commitLineEndpointDrag(object, group, startHandle, endHandle)
      })
    }
  }

  function commitLineEndpointDrag(object, group, startHandle, endHandle) {
    const rotation = group.rotation()
    const start = normalizePointFromScene(
      getLineHandleScenePoint(group, startHandle, rotation),
    )
    const visualEnd = normalizePointFromScene(
      getLineHandleScenePoint(group, endHandle, rotation),
    )
    const endpointVector = rotatePoint(
      {
        x: visualEnd.x - start.x,
        y: visualEnd.y - start.y,
      },
      -rotation,
    )
    object.x = start.x
    object.y = start.y
    object.endX = normalizeCoordinate(start.x + endpointVector.x, 0, 512)
    object.endY = normalizeCoordinate(start.y + endpointVector.y, 0, 384)
    renderAll()
    showStatus('已调整线段端点')
  }

  function getLineHandleScenePoint(group, handle, rotation) {
    const point = rotatePoint({ x: handle.x(), y: handle.y() }, rotation)
    return {
      x: group.x() + point.x,
      y: group.y() + point.y,
    }
  }

  function normalizePointFromScene(point) {
    return normalizePoint(
      toLogicalCoordinate(point.x),
      toLogicalCoordinate(point.y),
    )
  }

  function createLineAoeNode(object) {
    const width = object.width ?? 128
    const height = object.height ?? 128
    return new Konva.Rect({
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      offsetX: width,
      offsetY: height,
      width: toSceneCoordinate(width),
      height: toSceneCoordinate(height),
      fill: object.color ?? '#ff8000',
      scaleX: objectScale(object),
      scaleY: objectScale(object),
      rotation: object.angle ?? 0,
    })
  }

  async function createCircleAoeNode(object) {
    const arcAngle = object.type === 'fan_aoe' ? (object.arcAngle ?? 90) : 360
    const { offsetX, offsetY } = calculateCircleOffset(arcAngle)
    const group = new Konva.Group({
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      offsetX,
      offsetY,
      scaleX: objectScale(object),
      scaleY: objectScale(object),
      rotation: object.angle ?? 0,
    })
    if (arcAngle !== 360) {
      group.clipFunc((ctx) => {
        const r = 512
        const startAngle = -Math.PI / 2
        const endAngle = startAngle + (arcAngle * Math.PI) / 180
        ctx.beginPath()
        ctx.moveTo(512, 512)
        ctx.arc(512, 512, r, startAngle, endAngle)
        ctx.closePath()
      })
    }
    const image = await loadImage('/assets/objects/circle_aoe.webp')
    group.add(new Konva.Image({ image, width: 1024, height: 1024 }))
    return group
  }

  function createDonutNode(object) {
    return new Konva.Ring({
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      innerRadius: toSceneCoordinate(object.donutRadius ?? 80),
      outerRadius: 512,
      fill: object.color ?? '#ff8000',
      scaleX: objectScale(object),
      scaleY: objectScale(object),
      rotation: object.angle ?? 0,
    })
  }

  async function createIconNode(object) {
    const config = state.iconConfigs[object.type]
    if (!config) {
      return createTextNode({ ...object, text: object.type, color: '#ffffff' })
    }
    const image = await loadImage(`/assets/objects/${config.src}.webp`)
    return new Konva.Image({
      image,
      crop: config.crop,
      width: toSceneCoordinate(config.size),
      height: toSceneCoordinate(config.size),
      offsetX: config.size,
      offsetY: config.size,
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      scaleX: objectScale(object),
      scaleY: objectScale(object),
      rotation: object.angle ?? 0,
    })
  }

  function handleDragEnd(node, object) {
    const oldX = object.x
    const oldY = object.y
    const point = normalizePoint(
      toLogicalCoordinate(node.x()),
      toLogicalCoordinate(node.y()),
    )
    object.x = point.x
    object.y = point.y
    if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
      object.endX = clamp(Math.round(object.endX + object.x - oldX), 0, 512)
      object.endY = clamp(Math.round(object.endY + object.y - oldY), 0, 384)
    }
    renderInspector()
    renderLayers()
    renderAll()
  }

  function loadImage(src) {
    if (state.images.has(src)) return state.images.get(src)
    const promise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = src
    })
    state.images.set(src, promise)
    return promise
  }

  return {
    stage,
    renderBoard,
    renderGrid,
    renderObjects,
  }
}
