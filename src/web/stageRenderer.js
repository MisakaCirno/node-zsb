import {
  GRID_STEP,
  LOGICAL_SCALE,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from './constants.js'
import {
  clamp,
  normalizeAngle,
  rotatePoint,
} from './geometry.js'

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
  const transformer = new Konva.Transformer({
    rotateEnabled: true,
    enabledAnchors: [],
    borderStroke: '#66c2a5',
    anchorStroke: '#66c2a5',
  })

  stage.add(boardLayer)
  stage.add(gridLayer)
  stage.add(objectLayer)
  stage.add(transformerLayer)
  transformerLayer.add(transformer)

  stage.on('click tap', (event) => {
    if (event.target === stage || event.target.getLayer() === boardLayer) {
      selectObject(-1)
    }
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

    for (let x = 0, index = 0; x <= SCENE_WIDTH; x += GRID_STEP, index++) {
      gridLayer.add(createGridLine([x, 0, x, SCENE_HEIGHT], index))
    }
    for (let y = 0, index = 0; y <= SCENE_HEIGHT; y += GRID_STEP, index++) {
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
    const selectedNode = nodes.find((node) => node.getAttr('objectIndex') === state.selectedIndex)
    transformer.nodes(selectedNode ? [selectedNode] : [])
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
    node.opacity(object.hidden ? 0.15 : getOpacity(object))
    node.on('click tap', (event) => {
      event.cancelBubble = true
      selectObject(index)
    })
    node.on('dragstart', () => {
      recordHistory()
    })
    node.on('dragend', () => {
      handleDragEnd(node, object)
    })
    node.on('transformend', () => {
      object.angle = normalizeAngle(node.rotation())
      renderInspector()
    })
    return node
  }

  function createTextNode(object) {
    return new Konva.Text({
      text: object.text ?? '',
      fill: object.color ?? '#ffffff',
      x: object.x * LOGICAL_SCALE,
      y: object.y * LOGICAL_SCALE,
      fontSize: 28,
      fontFamily: 'Arial',
      offsetX: calcTextWidth(object.text ?? '', 28) / 2,
      offsetY: 14,
      rotation: object.angle ?? 0,
      shadowEnabled: true,
      shadowColor: 'black',
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
    })
  }

  function createLineNode(object) {
    const startX = object.x * LOGICAL_SCALE
    const startY = object.y * LOGICAL_SCALE
    const endX = (object.endX ?? object.x) * LOGICAL_SCALE
    const endY = (object.endY ?? object.y) * LOGICAL_SCALE
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
      strokeWidth: (object.height ?? 6) * LOGICAL_SCALE,
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
      Math.round(point.x / LOGICAL_SCALE),
      Math.round(point.y / LOGICAL_SCALE),
    )
  }

  function createLineAoeNode(object) {
    const width = object.width ?? 128
    const height = object.height ?? 128
    return new Konva.Rect({
      x: object.x * LOGICAL_SCALE,
      y: object.y * LOGICAL_SCALE,
      offsetX: width,
      offsetY: height,
      width: width * LOGICAL_SCALE,
      height: height * LOGICAL_SCALE,
      fill: object.color ?? '#ff8000',
      scaleX: (object.size ?? 100) / 100,
      scaleY: (object.size ?? 100) / 100,
      rotation: object.angle ?? 0,
    })
  }

  async function createCircleAoeNode(object) {
    const arcAngle = object.type === 'fan_aoe' ? (object.arcAngle ?? 90) : 360
    const group = new Konva.Group({
      x: object.x * LOGICAL_SCALE,
      y: object.y * LOGICAL_SCALE,
      offsetX: 512,
      offsetY: 512,
      scaleX: (object.size ?? 100) / 100,
      scaleY: (object.size ?? 100) / 100,
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
      x: object.x * LOGICAL_SCALE,
      y: object.y * LOGICAL_SCALE,
      innerRadius: (object.donutRadius ?? 80) * LOGICAL_SCALE,
      outerRadius: 512,
      fill: object.color ?? '#ff8000',
      scaleX: (object.size ?? 100) / 100,
      scaleY: (object.size ?? 100) / 100,
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
      width: config.size * LOGICAL_SCALE,
      height: config.size * LOGICAL_SCALE,
      offsetX: config.size,
      offsetY: config.size,
      x: object.x * LOGICAL_SCALE,
      y: object.y * LOGICAL_SCALE,
      scaleX: (object.size ?? 100) / 100,
      scaleY: (object.size ?? 100) / 100,
      rotation: object.angle ?? 0,
    })
  }

  function handleDragEnd(node, object) {
    const oldX = object.x
    const oldY = object.y
    const point = normalizePoint(
      Math.round(node.x() / LOGICAL_SCALE),
      Math.round(node.y() / LOGICAL_SCALE),
    )
    object.x = point.x
    object.y = point.y
    if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
      object.endX = clamp(Math.round(object.endX + object.x - oldX), 0, 512)
      object.endY = clamp(Math.round(object.endY + object.y - oldY), 0, 384)
    }
    renderInspector()
    renderLayers()
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

  function getOpacity(object) {
    return (100 - (object.transparency ?? 0)) / 100
  }

  function calcTextWidth(text, fontSize) {
    let width = 0
    for (const char of text) {
      width += char.charCodeAt(0) < 128 ? fontSize * 0.6 : fontSize * 1.2
    }
    return width
  }

  return {
    stage,
    renderBoard,
    renderGrid,
    renderObjects,
  }
}
