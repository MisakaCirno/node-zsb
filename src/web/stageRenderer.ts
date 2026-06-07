import {
  LOGICAL_SCALE,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from './constants.js'
import {
  rotatePoint,
} from './geometry.js'
import {
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
import {
  createCircleAoeRenderSpec,
  createDonutRenderSpec,
  createIconRenderSpec,
  createLineAoeRenderSpec,
  createLineRenderSpec,
  createTextRenderSpec,
  traceCircleAoeClipPath,
  traceDonutPath,
} from '../shared/objectRendering.js'
import { DEFAULT_BOARD_BACKGROUND, getBoardBackgroundId } from '../shared/backgrounds.js'
import {
  applyMeasuredStrategyTextOffset,
  createStrategyTextStyle,
  getStrategyTextFontLoadSpec,
} from '../shared/textRendering.js'
import { getSelectedIndexes } from './editorState.js'
import { getObjectBounds } from './objectAlignment.js'
import {
  getConstrainedObjectsMoveDelta,
  moveObjectsBy,
} from './objectMovement.js'
import type {
  BoardObject,
  Bounds,
  EditorContext,
  EditorState,
  StageLike,
} from './types.js'
import {
  constrainObjectScale,
  constrainTransformBox,
  copyTransformBox,
  getSelectionScaleLimits,
  type TransformBox,
  type TransformScaleLimits,
} from './transformGeometry.js'

declare const Konva: KonvaFactory

const MARQUEE_DRAG_THRESHOLD = 4
const TRANSFORM_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]
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
    changedTouches?: ArrayLike<{ clientX: number, clientY: number }>
    clientX?: number
    clientY?: number
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    touches?: ArrayLike<{ clientX: number, clientY: number }>
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
  getActiveAnchor?(): string | null
  getLayer(): unknown
  getPointerPosition(): Point | null
  keepRatio(value: boolean): void
  nodes(nodes: KonvaNode[]): void
  on(eventName: string, handler: (event: KonvaEvent) => void): void
  opacity(value: number): void
  points(points: number[]): void
  position(value?: Point): Point
  rotation(): number
  rotateEnabled?(value: boolean): void
  scale(value: { x: number, y: number }): void
  scaleX(value?: number): number
  scaleY(value?: number): number
  setAttr(name: string, value: unknown): void
  setAttrs(attrs: Record<string, unknown>): void
  toDataURL(options?: { pixelRatio?: number }): string
  visible(value: boolean): void
  width(value?: number): number
  height(value?: number): number
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

interface ActiveDrag {
  indexes: number[]
  lastDelta: Point
  nodeSnapshots: Array<{
    node: KonvaNode
    x: number
    y: number
  }>
  objectSnapshots: BoardObject[]
  pointerStart: Point
  referenceIndex: number
  referenceStart: Point
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
  const stageHost = document.getElementById(container)
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
    flipEnabled: false,
    keepRatio: true,
    enabledAnchors: [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ],
    borderStroke: '#66c2a5',
    anchorStroke: '#66c2a5',
    boundBoxFunc: constrainTransformerBox,
  })
  const hoverOuterTransformer = new Konva.Transformer({
    rotateEnabled: false,
    enabledAnchors: [],
    borderDash: [5, 4],
    borderStroke: 'rgba(7, 16, 24, 0.88)',
    borderStrokeWidth: 4,
    listening: false,
  })
  const hoverInnerTransformer = new Konva.Transformer({
    rotateEnabled: false,
    enabledAnchors: [],
    borderDash: [5, 4],
    borderStroke: '#f3fbff',
    borderStrokeWidth: 1.5,
    listening: false,
  })

  stage.add(boardLayer)
  stage.add(gridLayer)
  stage.add(objectLayer)
  stage.add(transformerLayer)
  stage.add(marqueeLayer)
  transformerLayer.add(hoverOuterTransformer)
  transformerLayer.add(hoverInnerTransformer)
  transformerLayer.add(transformer)
  marqueeLayer.add(marqueeRect)

  let marqueeStart: Point | null = null
  let marqueeCurrent: Point | null = null
  let didMarqueeDrag = false
  let suppressNextStageClick = false
  let isTransformingSelection = false
  let pendingTransformCommit = 0
  let transformActiveAnchor: string | null = null
  let transformStartBox: TransformBox | null = null
  let transformScaleLimits: TransformScaleLimits | null = null
  let textFontReady: Promise<unknown> | null = null
  let activeDrag: ActiveDrag | null = null
  let ignoredDragEndIndexes = new Set<number>()
  let pendingDragPointerStart: Point | null = null
  let hoveredObjectIndex: number | null = null
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
  bindHostMarqueeEvents()

  stage.on('mousedown touchstart', (event: KonvaEvent) => {
    if (event.evt?.button && event.evt.button !== 0) return
    if (event.target !== stage && event.target.getLayer() !== boardLayer) return
    beginMarquee(getPointerScenePoint())
  })
  stage.on('mousemove touchmove', () => {
    if (!marqueeStart) return
    const current = getPointerScenePoint()
    updateMarquee(current)
  })
  stage.on('mouseup touchend', () => {
    if (!marqueeStart) return
    finishMarquee(getPointerScenePoint())
  })

  function bindHostMarqueeEvents() {
    if (!stageHost) return
    stageHost.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button !== 0 || isCanvasEventTarget(event.target)) return
      beginMarquee(getScenePointFromClient({ x: event.clientX, y: event.clientY }))
    })
    stageHost.addEventListener('mousemove', (event: MouseEvent) => {
      if (!marqueeStart) return
      updateMarquee(getScenePointFromClient({ x: event.clientX, y: event.clientY }))
    })
    stageHost.addEventListener('mouseup', (event: MouseEvent) => {
      if (!marqueeStart) return
      finishMarquee(getScenePointFromClient({ x: event.clientX, y: event.clientY }))
    })
    stageHost.addEventListener('touchstart', (event: TouchEvent) => {
      if (isCanvasEventTarget(event.target)) return
      beginMarquee(getScenePointFromTouchList(event.touches))
    })
    stageHost.addEventListener('touchmove', (event: TouchEvent) => {
      if (!marqueeStart) return
      updateMarquee(getScenePointFromTouchList(event.touches))
    })
    stageHost.addEventListener('touchend', (event: TouchEvent) => {
      if (!marqueeStart) return
      finishMarquee(getScenePointFromTouchList(event.changedTouches))
    })
  }

  function beginMarquee(point: Point | null) {
    if (!point) return
    marqueeStart = point
    marqueeCurrent = point
    didMarqueeDrag = false
    marqueeRect.visible(false)
  }

  function updateMarquee(current: Point | null) {
    if (!current || !marqueeStart) return
    marqueeCurrent = current
    updateMarqueeRect(marqueeStart, current)
  }

  function finishMarquee(currentPoint: Point | null) {
    const start = marqueeStart
    if (!start) return
    const current = currentPoint ?? marqueeCurrent
    if (current && didMarqueeDrag) {
      const rect = getLogicalRect(start, current)
      const mode = getMarqueeMode(start, current)
      selectObjects(getMarqueeSelectedIndexes(rect, mode))
      suppressNextStageClick = true
    } else {
      selectObject(-1)
    }
    marqueeStart = null
    marqueeCurrent = null
    didMarqueeDrag = false
    marqueeRect.visible(false)
    marqueeLayer.batchDraw()
  }

  async function renderBoard() {
    const backgroundId = state.backgrounds[state.board.boardBackground ?? DEFAULT_BOARD_BACKGROUND]
      ?? getBoardBackgroundId(state.board.boardBackground)
    const image = await loadImage(`/assets/background/${backgroundId}.webp`)
    boardLayer.destroyChildren()
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
    const nodes: KonvaNode[] = []
    const nextRenderedNodesByIndex = new Map<number, KonvaNode>()
    for (let index = state.board.objects.length - 1; index >= 0; index--) {
      const object = state.board.objects[index]
      if (!object) continue
      const node = await createNode(object, index)
      if (node) {
        nodes.push(node)
        nextRenderedNodesByIndex.set(index, node)
      }
    }
    objectLayer.destroyChildren()
    renderedNodesByIndex.clear()
    for (const [index, node] of nextRenderedNodesByIndex) {
      renderedNodesByIndex.set(index, node)
      objectLayer.add(node)
    }
    objectLayer.draw()
    const selectedIndexes = getSelectedIndexes(state)
    const selectedObjects = selectedIndexes.map((index) => state.board.objects[index])
    const canTransformSelection = selectedObjects.length > 0
      && selectedObjects.every((object) => object && !['line', 'text'].includes(object.type))
    const canShowSelectionBounds = selectedObjects.length > 0
      && selectedObjects.every((object) => object && object.type !== 'line')
    const selectedNodes = canShowSelectionBounds
      ? nodes.filter((node) => {
        const index = Number(node.getAttr('objectIndex'))
        return selectedIndexes.includes(index) && !state.board.objects[index]?.locked
      })
      : []
    transformer.keepRatio(!canFreeScaleSelection(selectedObjects))
    transformer.rotateEnabled?.(canTransformSelection)
    transformer.enabledAnchors(canTransformSelection ? TRANSFORM_ANCHORS : [])
    transformer.nodes(selectedNodes)
    syncHoverTransformer({ draw: false })
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
      if (object.locked) return
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
    node.on('mouseenter', () => {
      setHoveredObject(index)
    })
    node.on('mouseleave', () => {
      if (hoveredObjectIndex === index) setHoveredObject(null)
    })
    node.on('click tap', (event: KonvaEvent) => {
      if (event.evt?.button && event.evt.button !== 0) return
      event.cancelBubble = true
      if (object.locked) return
      selectObject(index, {
        revealInLayers: true,
        toggle: Boolean(event.evt?.shiftKey || event.evt?.ctrlKey || event.evt?.metaKey),
      })
    })
    node.on('mousedown touchstart', (event: KonvaEvent) => {
      if (event.evt?.button && event.evt.button !== 0) return
      pendingDragPointerStart = getLogicalPointerPoint(event)
    })
    node.on('dragstart', (event: KonvaEvent) => {
      if (activeDrag?.referenceIndex !== index && activeDrag?.indexes.includes(index)) return
      setHoveredObject(null)
      recordHistory()
      beginNodeDrag(object, index, event)
    })
    node.on('dragmove', (event: KonvaEvent) => {
      updateNodeDrag(node, object, index, event)
    })
    node.on('dragend', (event: KonvaEvent) => {
      handleDragEnd(node, object, index, event)
    })
    node.on('transformstart', () => {
      if (!isTransformingSelection) {
        recordHistory()
        transformActiveAnchor = null
        transformStartBox = null
        transformScaleLimits = getSelectionScaleLimits(
          getSelectedIndexes(state).map((selectedIndex) => state.board.objects[selectedIndex]),
        )
      }
      isTransformingSelection = true
    })
    node.on('transform', () => {
      constrainNodeTransform(node, object)
    })
    node.on('transformend', () => {
      scheduleSelectedTransformCommit()
    })
    return node
  }

  function setHoveredObject(index: number | null) {
    if (hoveredObjectIndex === index) return
    hoveredObjectIndex = index
    syncHoverTransformer()
  }

  function syncHoverTransformer({ draw = true }: { draw?: boolean } = {}) {
    const hoveredObject = hoveredObjectIndex === null
      ? undefined
      : state.board.objects[hoveredObjectIndex]
    const hoveredNode = hoveredObjectIndex === null
      ? undefined
      : renderedNodesByIndex.get(hoveredObjectIndex)
    const selectedIndexes = getSelectedIndexes(state)
    const canHighlight = Boolean(
      hoveredObject
      && hoveredNode
      && !hoveredObject.locked
      && !selectedIndexes.includes(hoveredObjectIndex ?? -1)
      && !activeDrag,
    )
    const nodes = canHighlight && hoveredNode ? [hoveredNode] : []
    hoverOuterTransformer.nodes(nodes)
    hoverInnerTransformer.nodes(nodes)
    if (draw) transformerLayer.batchDraw()
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
    transformActiveAnchor = null
    transformStartBox = null
    transformScaleLimits = null
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

  function constrainNodePosition(node: KonvaNode) {
    node.position({
      x: toSceneCoordinate(normalizeCoordinate(toLogicalCoordinate(node.x()), 0, 512)),
      y: toSceneCoordinate(normalizeCoordinate(toLogicalCoordinate(node.y()), 0, 384)),
    })
  }

  function beginNodeDrag(object: BoardObject, index: number, event?: KonvaEvent) {
    ignoredDragEndIndexes = new Set()
    const selectedIndexes = getSelectedIndexes(state)
    const dragIndexes = (selectedIndexes.includes(index) ? selectedIndexes : [index])
      .filter((selectedIndex) => !state.board.objects[selectedIndex]?.locked)
    const objectSnapshots = dragIndexes
      .map((selectedIndex) => state.board.objects[selectedIndex])
      .filter((entry): entry is BoardObject => Boolean(entry))
      .map(cloneMoveObject)
    const nodeSnapshots = dragIndexes
      .map((selectedIndex) => {
        const renderedNode = renderedNodesByIndex.get(selectedIndex)
        return renderedNode
          ? { node: renderedNode, x: renderedNode.x(), y: renderedNode.y() }
          : null
      })
      .filter((entry): entry is ActiveDrag['nodeSnapshots'][number] => Boolean(entry))
    activeDrag = {
      indexes: dragIndexes,
      lastDelta: { x: 0, y: 0 },
      nodeSnapshots,
      objectSnapshots,
      pointerStart: pendingDragPointerStart ?? getLogicalPointerPoint(event) ?? { x: object.x, y: object.y },
      referenceIndex: index,
      referenceStart: { x: object.x, y: object.y },
    }
    pendingDragPointerStart = null
  }

  function updateNodeDrag(node: KonvaNode, object: BoardObject, index: number, event?: KonvaEvent) {
    const dragState = activeDrag
    if (dragState?.referenceIndex !== index && dragState?.indexes.includes(index)) {
      return
    }
    if (!dragState || dragState.referenceIndex !== index) {
      constrainNodePosition(node)
      return
    }
    const delta = getNodeDragDelta(node, dragState, event)
    dragState.lastDelta = { x: delta.dx, y: delta.dy }
    for (const snapshot of dragState.nodeSnapshots) {
      snapshot.node.position({
        x: snapshot.x + toSceneCoordinate(delta.dx),
        y: snapshot.y + toSceneCoordinate(delta.dy),
      })
    }
    if (!dragState.indexes.includes(index)) {
      constrainNodePosition(node)
    }
    objectLayer.batchDraw()
    transformerLayer.batchDraw()
  }

  function getNodeDragDelta(node: KonvaNode, dragState: ActiveDrag, event?: KonvaEvent) {
    const pointer = getLogicalPointerPoint(event)
    if (pointer) {
      const point = normalizePoint(
        dragState.referenceStart.x + pointer.x - dragState.pointerStart.x,
        dragState.referenceStart.y + pointer.y - dragState.pointerStart.y,
      )
      return getConstrainedObjectsMoveDelta(
        dragState.objectSnapshots,
        state,
        point.x - dragState.referenceStart.x,
        point.y - dragState.referenceStart.y,
      )
    }
    return getNodePositionDragDelta(node, dragState)
  }

  function getNodePositionDragDelta(node: KonvaNode, dragState: ActiveDrag) {
    const point = normalizePoint(
      toLogicalCoordinate(node.x()),
      toLogicalCoordinate(node.y()),
    )
    return getConstrainedObjectsMoveDelta(
      dragState.objectSnapshots,
      state,
      point.x - dragState.referenceStart.x,
      point.y - dragState.referenceStart.y,
    )
  }

  function constrainNodeTransform(node: KonvaNode, object: BoardObject) {
    if (object.type === 'line' || object.type === 'text') return
    const scale = constrainObjectScale(object, node.scaleX(), node.scaleY())
    node.scaleX(scale.scaleX)
    node.scaleY(scale.scaleY)
  }

  function constrainTransformerBox(oldBox: TransformBox, newBox: TransformBox): TransformBox {
    const currentAnchor = transformer.getActiveAnchor?.() ?? ''
    if (!transformActiveAnchor && currentAnchor) {
      transformActiveAnchor = currentAnchor
    }
    transformStartBox ??= copyTransformBox(oldBox)
    transformScaleLimits ??= getSelectionScaleLimits(
      getSelectedIndexes(state).map((index) => state.board.objects[index]),
    )
    return constrainTransformBox({
      activeAnchor: transformActiveAnchor ?? currentAnchor,
      baseBox: transformStartBox,
      limits: transformScaleLimits,
      newBox,
      oldBox,
    })
  }

  function canFreeScaleSelection(objects: Array<BoardObject | undefined>): boolean {
    return objects.length > 0
      && objects.every((object) => object && !object.locked && object.type === 'line_aoe')
  }

  function createTextNode(object: BoardObject): KonvaNode {
    const style = createStrategyTextStyle(object.text ?? '', object.color ?? DEFAULT_TEXT_COLOR)
    const spec = createTextRenderSpec(object)
    const node = new Konva.Text({
      ...style,
      x: spec.x,
      y: spec.y,
    })
    return applyMeasuredStrategyTextOffset(node)
  }

  function createLineNode(object: BoardObject): KonvaNode {
    const spec = createLineRenderSpec(object)
    const group = new Konva.Group({
      x: spec.startX,
      y: spec.startY,
    })
    const line = new Konva.Line({
      points: [0, 0, spec.endLocalX, spec.endLocalY],
      stroke: spec.stroke,
      strokeWidth: spec.strokeWidth,
      lineCap: spec.lineCap,
    })
    const startHandle = createLineHandle(0, 0, !object.locked)
    const endHandle = createLineHandle(spec.endLocalX, spec.endLocalY, !object.locked)
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
    const spec = createLineAoeRenderSpec(object)
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
    })
  }

  async function createCircleAoeNode(object: BoardObject): Promise<KonvaNode> {
    const spec = createCircleAoeRenderSpec(object)
    const group = new Konva.Group({
      x: spec.x,
      y: spec.y,
      offsetX: spec.offsetX,
      offsetY: spec.offsetY,
      scaleX: spec.scaleX,
      scaleY: spec.scaleY,
      rotation: spec.rotation,
    })
    if (spec.arcAngle !== 360) {
      group.clipFunc((ctx: ClipContext) => {
        traceCircleAoeClipPath(ctx, spec)
      })
    }
    const image = await loadImage('/assets/objects/circle_aoe.webp')
    group.add(new Konva.Image({ image, width: spec.imageWidth, height: spec.imageHeight }))
    return group
  }

  function createDonutNode(object: BoardObject): KonvaNode {
    const spec = createDonutRenderSpec(object)
    const group = new Konva.Group({
      x: spec.x,
      y: spec.y,
      offsetX: spec.offsetX,
      offsetY: spec.offsetY,
      scaleX: spec.scaleX,
      scaleY: spec.scaleY,
      rotation: spec.rotation,
    })
    const shape = new Konva.Shape({
      fill: spec.fill,
      sceneFunc: (ctx: ShapeContext, shape: unknown) => {
        traceDonutPath(ctx, spec)
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
    const spec = createIconRenderSpec(object, config.size)
    return new Konva.Image({
      image,
      crop: config.crop,
      width: spec.width,
      height: spec.height,
      offsetX: spec.offsetX,
      offsetY: spec.offsetY,
      x: spec.x,
      y: spec.y,
      scaleX: spec.scaleX,
      scaleY: spec.scaleY,
      rotation: spec.rotation,
    })
  }

  function handleDragEnd(node: KonvaNode, object: BoardObject, index: number, event?: KonvaEvent) {
    if (ignoredDragEndIndexes.delete(index)) {
      return
    }
    const dragState = activeDrag
    if (dragState?.referenceIndex !== index && dragState?.indexes.includes(index)) {
      return
    }
    if (dragState?.referenceIndex === index) {
      ignoredDragEndIndexes = new Set(
        dragState.indexes.filter((dragIndex) => dragIndex !== index),
      )
    }
    activeDrag = null
    pendingDragPointerStart = null
    const objectsToMove = dragState?.referenceIndex === index
      ? dragState.indexes
        .map((selectedIndex) => state.board.objects[selectedIndex])
        .filter((entry): entry is BoardObject => Boolean(entry && !entry.locked))
      : [object]
    const delta = dragState?.referenceIndex === index
      ? getNodeDragDelta(node, dragState, event)
      : getNodePositionDragDelta(node, {
        indexes: [index],
        lastDelta: { x: 0, y: 0 },
        nodeSnapshots: [],
        objectSnapshots: [cloneMoveObject(object)],
        pointerStart: { x: object.x, y: object.y },
        referenceIndex: index,
        referenceStart: { x: object.x, y: object.y },
      })
    moveObjectsBy(objectsToMove, delta.dx, delta.dy)
    renderInspector()
    renderLayers()
    renderAll()
  }

  function cloneMoveObject(object: BoardObject): BoardObject {
    return {
      ...object,
    }
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    const cached = state.images.get(src)
    if (cached) return cached
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = src
    })
    state.images.set(src, promise)
    return promise
  }

  function getLogicalPointerPoint(event?: KonvaEvent): Point | null {
    const client = getEventClientPoint(event)
    return getLogicalPointFromClient(client)
  }

  function getLogicalPointFromClient(client: Point | null): Point | null {
    const scenePoint = getScenePointFromClient(client)
    return scenePoint
      ? {
        x: toLogicalCoordinate(scenePoint.x),
        y: toLogicalCoordinate(scenePoint.y),
      }
      : null
  }

  function getScenePointFromClient(client: Point | null): Point | null {
    if (!client) return null
    const canvas = document.querySelector<HTMLCanvasElement>('#stage-host canvas')
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: ((client.x - rect.left) / rect.width) * SCENE_WIDTH,
      y: ((client.y - rect.top) / rect.height) * SCENE_HEIGHT,
    }
  }

  function getScenePointFromTouchList(touches: ArrayLike<{ clientX: number, clientY: number }>): Point | null {
    const touch = touches[0]
    return touch ? getScenePointFromClient({ x: touch.clientX, y: touch.clientY }) : null
  }

  function isCanvasEventTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLCanvasElement
  }

  function getEventClientPoint(event?: KonvaEvent): Point | null {
    const source = event?.evt
    if (!source) return null
    if (typeof source.clientX === 'number' && typeof source.clientY === 'number') {
      return { x: source.clientX, y: source.clientY }
    }
    const touch = source.touches?.[0] ?? source.changedTouches?.[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function ensureStrategyTextFontLoaded(): Promise<unknown> {
    if (textFontReady) return textFontReady
    const fonts = document.fonts
    if (!fonts?.load) return Promise.resolve()
    textFontReady = fonts
      .load(getStrategyTextFontLoadSpec())
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
