import {
  LOGICAL_SCALE,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from './constants.js'
import {
  rotatePoint,
} from './geometry.js'
import {
  DEFAULT_TEXT_FONT_SIZE,
  STRATEGY_TEXT_FONT_FAMILY,
  STRATEGY_TEXT_SHADOW_BLUR,
  STRATEGY_TEXT_SHADOW_OFFSET,
  STRATEGY_TEXT_STROKE_WIDTH,
  calcTextWidth,
  calculateCircleOffset,
  calculateDonutOffset,
  DEFAULT_DONUT_COLOR,
  DEFAULT_LINE_COLOR,
  DEFAULT_TEXT_COLOR,
  flippedScale,
  normalizeLineAoeHeight,
  normalizeLineAoeWidth,
  normalizeObjectAngle,
  normalizeObjectSize,
  objectOpacity,
  objectScale,
  toLogicalCoordinate,
  toSceneCoordinate,
} from '../shared/boardGeometry.js'
import { getSelectedIndexes } from './editorState.js'
import { getObjectBounds, getSelectionBounds } from './objectAlignment.js'
import {
  getConstrainedMoveDelta,
  moveObjectBy,
} from './objectMovement.js'
import type {
  BoardObject,
  Bounds,
  EditorContext,
  EditorState,
  StageLike,
} from './types.js'

declare const Konva: KonvaFactory

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

type MarqueeMode = 'contained' | 'intersect'

interface Point {
  x: number
  y: number
}

interface KonvaEvent {
  cancelBubble?: boolean
  evt?: {
    button?: number
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
  }
  target: KonvaNode
}

interface KonvaNode {
  add(...nodes: KonvaNode[]): void
  batchDraw(): void
  clipFunc(callback: (context: ClipContext) => void): void
  destroyChildren(): void
  draw(): void
  draggable(value: boolean): void
  enabledAnchors(anchors: string[]): void
  getAbsoluteTransform(): KonvaTransform
  getAttr(name: string): unknown
  getLayer(): unknown
  getPointerPosition(): Point | null
  nodes(nodes: KonvaNode[]): void
  on(eventName: string, handler: (event: KonvaEvent) => void): void
  opacity(value: number): void
  points(points: number[]): void
  rotation(): number
  scale(value: { x: number, y: number }): void
  scaleX(value?: number): number
  scaleY(value?: number): number
  setAttr(name: string, value: unknown): void
  setAttrs(attrs: Record<string, unknown>): void
  toDataURL(options?: { pixelRatio?: number }): string
  visible(value: boolean): void
  width(value: number): void
  height(value: number): void
  x(): number
  y(): number
}

interface KonvaFactory {
  Circle: KonvaConstructor
  Group: KonvaConstructor
  Image: KonvaConstructor
  Layer: KonvaConstructor
  Line: KonvaConstructor
  Rect: KonvaConstructor
  Ring: KonvaConstructor
  Shape: KonvaConstructor
  Stage: KonvaConstructor
  Text: KonvaConstructor
  Transformer: KonvaConstructor
}

interface KonvaConstructor {
  new (options?: Record<string, unknown>): KonvaNode
}

interface KonvaTransform {
  copy(): KonvaTransform
  invert(): KonvaTransform
  point(point: Point): Point
}

interface ClipContext {
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
}

interface ShapeContext extends ClipContext {
  fillStrokeShape(shape: unknown): void
}

interface StageRendererDeps {
  container: string
  state: EditorState
  normalizePoint: EditorContext['normalizePoint']
  normalizeCoordinate: EditorContext['normalizeCoordinate']
  recordHistory: () => void
  renderAll: () => Promise<void> | void
  renderInspector: () => void
  renderLayers: () => void
  selectObject: EditorContext['selectObject']
  selectObjects: EditorContext['selectObjects']
  showStatus: (message: string) => void
}

export interface StageRenderer {
  stage: StageLike & { toDataURL(options?: { pixelRatio?: number }): string }
  renderBoard(): Promise<void>
  renderGrid(): void
  renderObjects(): Promise<void>
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
}: StageRendererDeps): StageRenderer {
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

  let marqueeStart: Point | null = null
  let marqueeCurrent: Point | null = null
  let didMarqueeDrag = false
  let suppressNextStageClick = false
  let isTransformingSelection = false
  let pendingTransformCommit = 0
  let textFontReady: Promise<unknown> | null = null
  const renderedNodesByIndex = new Map<number, KonvaNode>()

  void ensureStrategyTextFontLoaded()

  stage.on('click tap', (event: KonvaEvent) => {
    if (event.evt?.button && event.evt.button !== 0) return
    if (suppressNextStageClick) {
      suppressNextStageClick = false
      return
    }
    if (event.target === stage || event.target.getLayer() === boardLayer) {
      selectObject(-1)
    }
  })
  stage.on('mousedown touchstart', (event: KonvaEvent) => {
    if (event.evt?.button && event.evt.button !== 0) return
    if (event.target !== stage && event.target.getLayer() !== boardLayer) return
    marqueeStart = getPointerScenePoint()
    marqueeCurrent = marqueeStart
    didMarqueeDrag = false
    marqueeRect.visible(false)
  })
  stage.on('mousemove touchmove', () => {
    if (!marqueeStart) return
    const current = getPointerScenePoint()
    if (!current) return
    marqueeCurrent = current
    updateMarqueeRect(marqueeStart, current)
  })
  stage.on('mouseup touchend', () => {
    if (!marqueeStart) return
    const current = getPointerScenePoint() ?? marqueeCurrent
    if (current && didMarqueeDrag) {
      const rect = getLogicalRect(marqueeStart, current)
      const mode = getMarqueeMode(marqueeStart, current)
      selectObjects(getMarqueeSelectedIndexes(rect, mode))
      suppressNextStageClick = true
    }
    marqueeStart = null
    marqueeCurrent = null
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
    if (state.board.objects.some((object) => object.type === 'text')) {
      await ensureStrategyTextFontLoaded()
    }
    objectLayer.destroyChildren()
    renderedNodesByIndex.clear()
    const nodes: KonvaNode[] = []
    for (let index = state.board.objects.length - 1; index >= 0; index--) {
      const object = state.board.objects[index]
      if (!object) continue
      const node = await createNode(object, index)
      if (node) {
        nodes.push(node)
        renderedNodesByIndex.set(index, node)
        objectLayer.add(node)
      }
    }
    objectLayer.draw()
    const selectedIndexes = getSelectedIndexes(state)
    const selectedObjects = selectedIndexes.map((index) => state.board.objects[index])
    const canTransformSelection = selectedObjects.length > 0
      && selectedObjects.every((object) => object && !['line', 'text'].includes(object.type))
    const selectedNodes = canTransformSelection
      ? nodes.filter((node) => {
        const index = Number(node.getAttr('objectIndex'))
        return selectedIndexes.includes(index) && !state.board.objects[index]?.locked
      })
      : []
    const canScaleSelection = canTransformSelection
    transformer.enabledAnchors(canScaleSelection ? [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ] : [])
    transformer.nodes(selectedNodes)
    transformerLayer.draw()
  }

  function createGridLine(points: number[], index: number): KonvaNode {
    const major = index % 4 === 0
    return new Konva.Line({
      points,
      stroke: '#e7fbff',
      strokeScaleEnabled: false,
      strokeWidth: major ? 1.25 : 1,
      opacity: (major ? 0.42 : 0.24) * state.gridOpacity,
      listening: false,
    })
  }

  function updateMarqueeRect(start: Point, current: Point) {
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

  function getMarqueeSelectedIndexes(rect: Bounds, mode: MarqueeMode): number[] {
    const selected: number[] = []
    state.board.objects.forEach((object, index) => {
      if (objectMatchesMarquee(getObjectBounds(object, state), rect, mode)) {
        selected.push(index)
      }
    })
    return selected
  }

  function objectMatchesMarquee(objectBounds: Bounds, rect: Bounds, mode: MarqueeMode) {
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

  function getMarqueeMode(start: Point, current: Point): MarqueeMode {
    return current.x >= start.x ? 'contained' : 'intersect'
  }

  function getMarqueeTheme(start: Point, current: Point) {
    return MARQUEE_THEMES[getMarqueeMode(start, current)]
  }

  function getLogicalRect(start: Point, current: Point): Bounds {
    const left = toLogicalCoordinate(Math.min(start.x, current.x))
    const right = toLogicalCoordinate(Math.max(start.x, current.x))
    const top = toLogicalCoordinate(Math.min(start.y, current.y))
    const bottom = toLogicalCoordinate(Math.max(start.y, current.y))
    return { left, right, top, bottom }
  }

  function getPointerScenePoint(): Point | null {
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    return stage.getAbsoluteTransform().copy().invert().point(pointer)
  }

  async function createNode(object: BoardObject, index: number): Promise<KonvaNode> {
    let node: KonvaNode
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
    node.on('click tap', (event: KonvaEvent) => {
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
      handleDragEnd(node, object, index)
    })
    node.on('transformstart', () => {
      if (!isTransformingSelection) {
        recordHistory()
      }
      isTransformingSelection = true
    })
    node.on('transformend', () => {
      scheduleSelectedTransformCommit()
    })
    return node
  }

  function scheduleSelectedTransformCommit() {
    if (pendingTransformCommit) {
      return
    }
    pendingTransformCommit = window.requestAnimationFrame(() => {
      pendingTransformCommit = 0
      commitSelectedNodeTransforms()
    })
  }

  function commitSelectedNodeTransforms() {
    const selectedIndexes = getSelectedIndexes(state)
    let hasCommittedTransform = false
    for (const index of selectedIndexes) {
      const object = state.board.objects[index]
      const node = renderedNodesByIndex.get(index)
      if (!object || !node) continue
      applyNodeTransform(node, object)
      hasCommittedTransform = true
    }
    isTransformingSelection = false
    if (!hasCommittedTransform) {
      return
    }
    renderInspector()
    renderLayers()
    renderAll()
  }

  function applyNodeTransform(node: KonvaNode, object: BoardObject) {
    if (object.type === 'line_aoe') {
      object.width = normalizeLineAoeWidth((object.width ?? 128) * Math.abs(node.scaleX()))
      object.height = normalizeLineAoeHeight((object.height ?? 128) * Math.abs(node.scaleY()))
      const scale = objectScale(object)
      node.scaleX(flippedScale(scale, Boolean(object.horizontalFlip)))
      node.scaleY(flippedScale(scale, Boolean(object.verticalFlip)))
    } else if (object.type !== 'line' && object.type !== 'text') {
      object.size = normalizeObjectSize(
        Math.round(Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY())) * 100),
        object.type,
      )
      const scale = objectScale(object)
      node.scaleX(flippedScale(scale, Boolean(object.horizontalFlip)))
      node.scaleY(flippedScale(scale, Boolean(object.verticalFlip)))
    }
    if (object.type === 'line' || object.type === 'text') {
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
    object.angle = ['line', 'text'].includes(object.type)
      ? undefined
      : normalizeObjectAngle(node.rotation())
  }

  function createTextNode(object: BoardObject): KonvaNode {
    return new Konva.Text({
      text: object.text ?? '',
      fill: object.color ?? DEFAULT_TEXT_COLOR,
      stroke: 'black',
      strokeWidth: STRATEGY_TEXT_STROKE_WIDTH,
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      fontSize: DEFAULT_TEXT_FONT_SIZE,
      fontFamily: STRATEGY_TEXT_FONT_FAMILY,
      offsetX: calcTextWidth(object.text ?? '', DEFAULT_TEXT_FONT_SIZE) / 2,
      offsetY: DEFAULT_TEXT_FONT_SIZE / 2,
      shadowEnabled: true,
      shadowColor: 'black',
      shadowBlur: STRATEGY_TEXT_SHADOW_BLUR,
      shadowOffsetX: STRATEGY_TEXT_SHADOW_OFFSET,
      shadowOffsetY: STRATEGY_TEXT_SHADOW_OFFSET,
    })
  }

  function createLineNode(object: BoardObject): KonvaNode {
    const startX = toSceneCoordinate(object.x)
    const startY = toSceneCoordinate(object.y)
    const endX = toSceneCoordinate(object.endX ?? object.x)
    const endY = toSceneCoordinate(object.endY ?? object.y)
    const endLocalX = endX - startX
    const endLocalY = endY - startY
    const group = new Konva.Group({
      x: startX,
      y: startY,
    })
    const line = new Konva.Line({
      points: [0, 0, endLocalX, endLocalY],
      stroke: object.color ?? DEFAULT_LINE_COLOR,
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

  function createLineHandle(x: number, y: number, draggable: boolean): KonvaNode {
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

  function bindLineHandleDrag({
    object,
    group,
    line,
    startHandle,
    endHandle,
  }: {
    object: BoardObject
    group: KonvaNode
    line: KonvaNode
    startHandle: KonvaNode
    endHandle: KonvaNode
  }) {
    for (const handle of [startHandle, endHandle]) {
      handle.on('dragstart', (event: KonvaEvent) => {
        event.cancelBubble = true
        recordHistory()
      })
      handle.on('dragmove', (event: KonvaEvent) => {
        event.cancelBubble = true
        line.points([startHandle.x(), startHandle.y(), endHandle.x(), endHandle.y()])
        objectLayer.batchDraw()
      })
      handle.on('dragend', (event: KonvaEvent) => {
        event.cancelBubble = true
        commitLineEndpointDrag(object, group, startHandle, endHandle)
      })
    }
  }

  function commitLineEndpointDrag(
    object: BoardObject,
    group: KonvaNode,
    startHandle: KonvaNode,
    endHandle: KonvaNode,
  ) {
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

  function getLineHandleScenePoint(group: KonvaNode, handle: KonvaNode, rotation: number): Point {
    const point = rotatePoint({ x: handle.x(), y: handle.y() }, rotation)
    return {
      x: group.x() + point.x,
      y: group.y() + point.y,
    }
  }

  function normalizePointFromScene(point: Point): Point {
    return normalizePoint(
      toLogicalCoordinate(point.x),
      toLogicalCoordinate(point.y),
    )
  }

  function createLineAoeNode(object: BoardObject): KonvaNode {
    const width = object.width ?? 128
    const height = object.height ?? 128
    return new Konva.Rect({
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      offsetX: width,
      offsetY: height,
      width: toSceneCoordinate(width),
      height: toSceneCoordinate(height),
      fill: object.color ?? DEFAULT_LINE_COLOR,
      scaleX: flippedScale(objectScale(object), Boolean(object.horizontalFlip)),
      scaleY: flippedScale(objectScale(object), Boolean(object.verticalFlip)),
      rotation: object.angle ?? 0,
    })
  }

  async function createCircleAoeNode(object: BoardObject): Promise<KonvaNode> {
    const arcAngle = object.type === 'fan_aoe' ? (object.arcAngle ?? 90) : 360
    const { offsetX, offsetY } = calculateCircleOffset(arcAngle)
    const scale = objectScale(object)
    const group = new Konva.Group({
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      offsetX,
      offsetY,
      scaleX: flippedScale(scale, Boolean(object.horizontalFlip)),
      scaleY: flippedScale(scale, Boolean(object.verticalFlip)),
      rotation: object.angle ?? 0,
    })
    if (arcAngle !== 360) {
      group.clipFunc((ctx: ClipContext) => {
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

  function createDonutNode(object: BoardObject): KonvaNode {
    const scale = objectScale(object)
    const outerRadius = 512
    const innerRadius = toSceneCoordinate(object.donutRadius ?? 80)
    const arcAngle = object.arcAngle ?? 360
    const { offsetX, offsetY } = calculateDonutOffset({
      arcAngle,
      outerRadius,
      innerRadius,
    })
    const group = new Konva.Group({
      x: toSceneCoordinate(object.x),
      y: toSceneCoordinate(object.y),
      offsetX,
      offsetY,
      scaleX: flippedScale(scale, Boolean(object.horizontalFlip)),
      scaleY: flippedScale(scale, Boolean(object.verticalFlip)),
      rotation: object.angle ?? 0,
    })
    const shape = new Konva.Shape({
      fill: DEFAULT_DONUT_COLOR,
      sceneFunc: (ctx: ShapeContext, shape: unknown) => {
        const startAngle = -Math.PI / 2
        const endAngle = startAngle + (arcAngle * Math.PI) / 180
        ctx.beginPath()
        if (arcAngle >= 360) {
          ctx.arc(0, 0, outerRadius, 0, Math.PI * 2)
          ctx.arc(0, 0, innerRadius, 0, Math.PI * 2, true)
        } else {
          ctx.arc(0, 0, outerRadius, startAngle, endAngle)
          ctx.arc(0, 0, innerRadius, endAngle, startAngle, true)
          ctx.closePath()
        }
        ctx.fillStrokeShape(shape)
      },
    })
    group.add(shape)
    return group
  }

  async function createIconNode(object: BoardObject): Promise<KonvaNode> {
    const config = state.iconConfigs[object.type]
    if (!config) {
      return createTextNode({ ...object, text: object.type, color: DEFAULT_TEXT_COLOR })
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
      scaleX: flippedScale(objectScale(object), Boolean(object.horizontalFlip)),
      scaleY: flippedScale(objectScale(object), Boolean(object.verticalFlip)),
      rotation: object.angle ?? 0,
    })
  }

  function handleDragEnd(node: KonvaNode, object: BoardObject, index: number) {
    const oldX = object.x
    const oldY = object.y
    const point = normalizePoint(
      toLogicalCoordinate(node.x()),
      toLogicalCoordinate(node.y()),
    )
    const selectedIndexes = getSelectedIndexes(state)
    const selectedObjects = selectedIndexes
      .map((selectedIndex) => state.board.objects[selectedIndex])
      .filter((entry): entry is BoardObject => Boolean(entry && !entry.locked))
    const shouldMoveSelection = selectedIndexes.includes(index) && selectedObjects.length > 1
    let delta = { dx: point.x - oldX, dy: point.y - oldY }
    if (shouldMoveSelection) {
      delta = getConstrainedMoveDelta(getSelectionBounds(selectedObjects, state), delta.dx, delta.dy)
      for (const selectedObject of selectedObjects) {
        moveObjectBy(selectedObject, delta.dx, delta.dy)
      }
    } else {
      moveObjectBy(object, delta.dx, delta.dy)
    }
    renderInspector()
    renderLayers()
    renderAll()
  }

  function loadImage(src: string): Promise<unknown> {
    const cached = state.images.get(src)
    if (cached) return cached
    const promise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = src
    })
    state.images.set(src, promise)
    return promise
  }

  function ensureStrategyTextFontLoaded(): Promise<unknown> {
    if (textFontReady) return textFontReady
    const fonts = document.fonts
    if (!fonts?.load) return Promise.resolve()
    textFontReady = fonts
      .load(`${DEFAULT_TEXT_FONT_SIZE}px ${STRATEGY_TEXT_FONT_FAMILY}`)
      .catch(() => undefined)
    return textFontReady
  }

  return {
    stage,
    renderBoard,
    renderGrid,
    renderObjects,
  }
}
