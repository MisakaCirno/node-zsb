const SCENE_WIDTH = 1024
const SCENE_HEIGHT = 768
const LOGICAL_SCALE = 2
const SNAP_STEP = 16
const GRID_STEP = SNAP_STEP * LOGICAL_SCALE
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5]
const STORAGE_KEY = 'node-zsb-editor-board-v1'

const state = {
  board: {
    name: '',
    boardBackground: 'checkered',
    objects: [],
  },
  selectedIndex: -1,
  iconConfigs: {},
  iconGroups: {},
  backgrounds: {},
  activeGroup: 'rolesAndJobs',
  snapToGrid: false,
  showGrid: false,
  zoom: 1,
  zoomMode: 'fit',
  images: new Map(),
  history: [],
  future: [],
  clipboard: null,
  statusTimer: 0,
}

const stage = new Konva.Stage({
  container: 'stage-host',
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

const els = {
  codeInput: document.querySelector('#code-input'),
  codeOutput: document.querySelector('#code-output'),
  loadCode: document.querySelector('#load-code'),
  exportCode: document.querySelector('#export-code'),
  renderPreview: document.querySelector('#render-preview'),
  background: document.querySelector('#background-select'),
  boardName: document.querySelector('#board-name'),
  paletteTabs: document.querySelector('#palette-tabs'),
  palette: document.querySelector('#palette'),
  layers: document.querySelector('#layers'),
  layerCount: document.querySelector('#layer-count'),
  stageHost: document.querySelector('#stage-host'),
  preview: document.querySelector('#preview-image'),
  status: document.querySelector('#status'),
  undo: document.querySelector('#undo-action'),
  redo: document.querySelector('#redo-action'),
  clearBoard: document.querySelector('#clear-board'),
  deleteObject: document.querySelector('#delete-object'),
  duplicateObject: document.querySelector('#duplicate-object'),
  moveUp: document.querySelector('#move-up'),
  moveDown: document.querySelector('#move-down'),
  centerObject: document.querySelector('#center-object'),
  zoomOut: document.querySelector('#zoom-out'),
  zoomSelect: document.querySelector('#zoom-select'),
  zoomIn: document.querySelector('#zoom-in'),
  fitStage: document.querySelector('#fit-stage'),
  snap: document.querySelector('#snap-toggle'),
  grid: document.querySelector('#grid-toggle'),
  emptyState: document.querySelector('#empty-state'),
  inspector: document.querySelector('#inspector-form'),
  type: document.querySelector('#object-type'),
  x: document.querySelector('#object-x'),
  y: document.querySelector('#object-y'),
  size: document.querySelector('#object-size'),
  angle: document.querySelector('#object-angle'),
  color: document.querySelector('#object-color'),
  transparency: document.querySelector('#object-transparency'),
  text: document.querySelector('#object-text'),
  endX: document.querySelector('#object-end-x'),
  endY: document.querySelector('#object-end-y'),
  arc: document.querySelector('#object-arc'),
  donut: document.querySelector('#object-donut'),
  hidden: document.querySelector('#object-hidden'),
  locked: document.querySelector('#object-locked'),
}

async function init() {
  const meta = await getJson('/editor-data')
  state.iconConfigs = meta.iconConfigs
  state.iconGroups = meta.iconGroups
  state.backgrounds = meta.backgrounds
  const codeFromUrl = new URLSearchParams(window.location.search).get('code')
  const savedBoard = loadSavedBoard()
  if (codeFromUrl) {
    els.codeInput.value = codeFromUrl
    await loadFromCode(codeFromUrl, { record: false })
  } else if (savedBoard) {
    state.board = normalizeBoard(savedBoard)
    els.boardName.value = state.board.name ?? ''
    renderBackgroundOptions()
  } else {
    els.codeInput.value = meta.defaultCode
    await loadFromCode(meta.defaultCode, { record: false })
  }
  bindEvents()
  renderPaletteTabs()
  renderAll()
  applyFitZoom({ silent: true })
  showStatus(codeFromUrl ? '已从链接导入战术板' : '编辑器已就绪')
}

function bindEvents() {
  els.loadCode.addEventListener('click', () =>
    runAction(() => loadFromCode(els.codeInput.value), '已导入战术板'),
  )
  els.exportCode.addEventListener('click', () =>
    runAction(exportCode, '已导出战术板代码'),
  )
  els.renderPreview.addEventListener('click', () =>
    runAction(renderPreview, '已渲染预览图'),
  )
  els.background.addEventListener('change', () => {
    recordHistory()
    state.board.boardBackground = els.background.value
    renderAll()
  })
  els.boardName.addEventListener('change', () => {
    recordHistory()
    state.board.name = els.boardName.value
  })
  els.undo.addEventListener('click', undo)
  els.redo.addEventListener('click', redo)
  els.clearBoard.addEventListener('click', clearBoard)
  els.deleteObject.addEventListener('click', deleteSelected)
  els.duplicateObject.addEventListener('click', duplicateSelected)
  els.moveUp.addEventListener('click', () => moveSelected(1))
  els.moveDown.addEventListener('click', () => moveSelected(-1))
  els.centerObject.addEventListener('click', centerSelected)
  els.zoomOut.addEventListener('click', () => stepZoom(-1))
  els.zoomIn.addEventListener('click', () => stepZoom(1))
  els.fitStage.addEventListener('click', () => applyFitZoom())
  els.zoomSelect.addEventListener('change', () => {
    if (els.zoomSelect.value === 'fit') {
      applyFitZoom()
      return
    }
    setStageZoom(Number(els.zoomSelect.value), { mode: 'manual' })
  })
  els.snap.addEventListener('change', () => {
    state.snapToGrid = els.snap.checked
    showStatus(state.snapToGrid ? '已开启网格吸附' : '已关闭网格吸附')
  })
  els.grid.addEventListener('change', () => {
    state.showGrid = els.grid.checked
    renderGrid()
    showStatus(state.showGrid ? '已显示辅助网格' : '已隐藏辅助网格')
  })
  window.addEventListener('resize', () => {
    if (state.zoomMode === 'fit') {
      applyFitZoom({ silent: true })
    }
  })
  document.addEventListener('keydown', handleKeyboard)
  stage.on('click tap', (event) => {
    if (event.target === stage || event.target.getLayer() === boardLayer) {
      selectObject(-1)
    }
  })

  for (const input of [
    els.x,
    els.y,
    els.size,
    els.angle,
    els.color,
    els.transparency,
    els.text,
    els.endX,
    els.endY,
    els.arc,
    els.donut,
    els.hidden,
    els.locked,
  ]) {
    input.addEventListener('input', updateSelectedFromInspector)
  }
}

async function loadFromCode(code, options = {}) {
  const payload = await postJson('/utils/code2json', { code })
  if (options.record !== false) {
    recordHistory()
  }
  state.board = normalizeBoard(payload.data)
  state.selectedIndex = -1
  els.boardName.value = state.board.name ?? ''
  renderBackgroundOptions()
  await renderAll()
}

function normalizeBoard(board) {
  return {
    name: board.name ?? '',
    boardBackground: board.boardBackground ?? 'checkered',
    objects: (board.objects ?? []).map((object) => ({
      size: 100,
      color: '#ff8000',
      transparency: 0,
      ...object,
    })),
  }
}

function renderBackgroundOptions() {
  els.background.innerHTML = ''
  for (const key of Object.keys(state.backgrounds)) {
    const option = document.createElement('option')
    option.value = key
    option.textContent = key
    option.selected = key === state.board.boardBackground
    els.background.append(option)
  }
}

function renderPaletteTabs() {
  const labels = {
    rolesAndJobs: '职能',
    mechanics: '机制',
    enemiesAndMarkers: '标记',
    shapes: '形状',
    backgrounds: '地面',
  }
  els.paletteTabs.innerHTML = ''
  for (const key of Object.keys(state.iconGroups)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = labels[key] ?? key
    button.classList.toggle('active', key === state.activeGroup)
    button.addEventListener('click', () => {
      state.activeGroup = key
      renderPaletteTabs()
      renderPalette()
    })
    els.paletteTabs.append(button)
  }
  renderPalette()
}

function renderPalette() {
  els.palette.innerHTML = ''
  const extras = state.activeGroup === 'shapes' ? ['text', 'line', 'line_aoe', 'circle_aoe', 'fan_aoe', 'donut'] : []
  const types = [...(state.iconGroups[state.activeGroup] ?? []), ...extras]
  for (const type of [...new Set(types)]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.title = type
    const config = state.iconConfigs[type]
    if (config) {
      const img = document.createElement('img')
      img.src = `/assets/objects/${config.src}.webp`
      img.alt = type
      button.append(img)
    } else {
      const span = document.createElement('span')
      span.className = 'text-swatch'
      span.textContent = type === 'text' ? 'T' : type.slice(0, 2)
      button.append(span)
    }
    button.addEventListener('click', () => addObject(type))
    els.palette.append(button)
  }
}

function addObject(type) {
  recordHistory()
  const object = createDefaultObject(type)
  state.board.objects.push(object)
  selectObject(state.board.objects.length - 1)
  renderAll()
}

function createDefaultObject(type) {
  const base = {
    type,
    x: 256,
    y: 192,
    size: 100,
    color: '#ff8000',
    transparency: 0,
  }
  if (type === 'text') return { ...base, text: '文字', color: '#ffffff' }
  if (type === 'line') return { ...base, endX: 320, endY: 192, height: 6 }
  if (type === 'line_aoe') return { ...base, width: 128, height: 128 }
  if (type === 'fan_aoe') return { ...base, arcAngle: 90 }
  if (type === 'donut') return { ...base, donutRadius: 80 }
  return base
}

async function renderAll() {
  await renderBoard()
  renderGrid()
  await renderObjects()
  renderLayers()
  renderInspector()
  persistBoard()
}

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
  const start = normalizePoint(
    Math.round((group.x() + startHandle.x()) / LOGICAL_SCALE),
    Math.round((group.y() + startHandle.y()) / LOGICAL_SCALE),
  )
  const end = normalizePoint(
    Math.round((group.x() + endHandle.x()) / LOGICAL_SCALE),
    Math.round((group.y() + endHandle.y()) / LOGICAL_SCALE),
  )
  object.x = start.x
  object.y = start.y
  object.endX = end.x
  object.endY = end.y
  renderAll()
  showStatus('已调整线段端点')
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

function selectObject(index) {
  state.selectedIndex = index
  renderAll()
}

function renderInspector() {
  const object = getSelected()
  els.emptyState.classList.toggle('hidden', Boolean(object))
  els.inspector.classList.toggle('hidden', !object)
  updateSelectionActions()
  if (!object) return
  updateInspectorVisibility(object)
  els.type.value = object.type
  els.x.value = object.x ?? 256
  els.y.value = object.y ?? 192
  els.size.value = object.size ?? 100
  els.angle.value = object.angle ?? 0
  els.color.value = object.color ?? '#ff8000'
  els.transparency.value = object.transparency ?? 0
  els.text.value = object.text ?? ''
  els.endX.value = object.endX ?? object.x ?? 256
  els.endY.value = object.endY ?? object.y ?? 192
  els.arc.value = object.arcAngle ?? (object.type === 'fan_aoe' ? 90 : 360)
  els.donut.value = object.donutRadius ?? 80
  els.hidden.checked = Boolean(object.hidden)
  els.locked.checked = Boolean(object.locked)
  updateInspectorLockState(object)
}

function updateSelectedFromInspector() {
  const object = getSelected()
  if (!object) return
  const capabilities = getObjectCapabilities(object.type)
  recordHistory()
  const point = normalizePoint(numberValue(els.x, 0, 512), numberValue(els.y, 0, 384))
  object.x = point.x
  object.y = point.y
  object.size = numberValue(els.size, 10, 300)
  object.angle = numberValue(els.angle, 0, 360)
  object.color = capabilities.appearance ? els.color.value : undefined
  object.transparency = capabilities.appearance
    ? numberValue(els.transparency, 0, 100)
    : undefined
  object.text = capabilities.text ? els.text.value || undefined : undefined
  object.endX = capabilities.line ? numberValue(els.endX, 0, 512) : undefined
  object.endY = capabilities.line ? numberValue(els.endY, 0, 384) : undefined
  object.arcAngle = capabilities.arcAngle ? numberValue(els.arc, 10, 360) : undefined
  object.donutRadius = capabilities.donutRadius
    ? numberValue(els.donut, 0, 240)
    : undefined
  object.hidden = els.hidden.checked || undefined
  object.locked = els.locked.checked || undefined
  renderAll()
}

function updateInspectorVisibility(object) {
  const capabilities = getObjectCapabilities(object.type)
  setFieldVisible('appearance', capabilities.appearance)
  setFieldVisible('text', capabilities.text)
  setFieldVisible('line', capabilities.line)
  setFieldVisible('arc', capabilities.arcAngle || capabilities.donutRadius)
  setFieldVisible('arc-angle', capabilities.arcAngle)
  setFieldVisible('donut-radius', capabilities.donutRadius)
}

function updateInspectorLockState(object) {
  const locked = Boolean(object.locked)
  for (const input of [
    els.x,
    els.y,
    els.size,
    els.angle,
    els.endX,
    els.endY,
    els.arc,
    els.donut,
  ]) {
    input.disabled = locked
  }
}

function setFieldVisible(field, visible) {
  const element = document.querySelector(`[data-field="${field}"]`)
  if (element) {
    element.classList.toggle('hidden', !visible)
  }
}

function getObjectCapabilities(type) {
  return {
    appearance: ['text', 'line', 'line_aoe', 'donut'].includes(type),
    text: type === 'text',
    line: type === 'line',
    arcAngle: type === 'fan_aoe',
    donutRadius: type === 'donut',
  }
}

function renderLayers() {
  els.layers.innerHTML = ''
  els.layerCount.textContent = String(state.board.objects.length)
  if (state.board.objects.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'layer-empty'
    empty.textContent = '暂无对象'
    els.layers.append(empty)
    return
  }
  state.board.objects.forEach((object, index) => {
    const row = document.createElement('div')
    row.className = 'layer-row'
    row.classList.toggle('active', index === state.selectedIndex)
    row.classList.toggle('muted', Boolean(object.hidden))
    row.innerHTML = `
      <button class="layer-toggle" type="button" data-action="hidden" title="${object.hidden ? '显示' : '隐藏'}">${object.hidden ? '隐' : '显'}</button>
      <button class="layer-toggle" type="button" data-action="locked" title="${object.locked ? '解锁' : '锁定'}">${object.locked ? '锁' : '开'}</button>
      <span class="layer-name">${index + 1}. ${object.type}</span>
      <span class="layer-position">${Math.round(object.x)}, ${Math.round(object.y)}</span>
    `
    row.querySelector('[data-action="hidden"]').addEventListener('click', (event) => {
      event.stopPropagation()
      toggleLayerFlag(index, 'hidden')
    })
    row.querySelector('[data-action="locked"]').addEventListener('click', (event) => {
      event.stopPropagation()
      toggleLayerFlag(index, 'locked')
    })
    row.addEventListener('click', () => selectObject(index))
    els.layers.append(row)
  })
}

function toggleLayerFlag(index, key) {
  const object = state.board.objects[index]
  if (!object) return
  recordHistory()
  object[key] = object[key] ? undefined : true
  state.selectedIndex = index
  renderAll()
}

function deleteSelected() {
  if (state.selectedIndex < 0) return
  recordHistory()
  const object = getSelected()
  state.board.objects.splice(state.selectedIndex, 1)
  state.selectedIndex = -1
  renderAll()
  showStatus(`已删除 ${object?.type ?? '对象'}`)
}

function clearBoard() {
  if (state.board.objects.length === 0) return
  if (!window.confirm('清空当前画板上的所有对象？')) return
  recordHistory()
  state.board.objects = []
  state.selectedIndex = -1
  renderAll()
  showStatus('已清空画板')
}

function duplicateSelected() {
  const object = getSelected()
  if (!object) return
  recordHistory()
  const copy = createPastedObject(object)
  state.board.objects.push(copy)
  selectObject(state.board.objects.length - 1)
}

function moveSelected(delta) {
  const index = state.selectedIndex
  const target = index + delta
  if (index < 0 || target < 0 || target >= state.board.objects.length) return
  recordHistory()
  const [object] = state.board.objects.splice(index, 1)
  state.board.objects.splice(target, 0, object)
  selectObject(target)
}

function centerSelected() {
  const object = getSelected()
  if (!object || object.locked) return
  recordHistory()
  const oldX = object.x
  const oldY = object.y
  object.x = 256
  object.y = 192
  if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
    object.endX = clamp(Math.round(object.endX + object.x - oldX), 0, 512)
    object.endY = clamp(Math.round(object.endY + object.y - oldY), 0, 384)
  }
  renderAll()
  showStatus('已居中选中对象')
}

function applyFitZoom(options = {}) {
  const styles = getComputedStyle(els.stageHost)
  const horizontalPadding =
    Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
  const verticalPadding =
    Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
  const availableWidth = Math.max(0, els.stageHost.clientWidth - horizontalPadding)
  const availableHeight = Math.max(0, els.stageHost.clientHeight - verticalPadding)
  const zoom = Math.min(1, availableWidth / SCENE_WIDTH, availableHeight / SCENE_HEIGHT)
  setStageZoom(zoom, { mode: 'fit', ...options })
}

function stepZoom(direction) {
  const current = state.zoom
  const target =
    direction > 0
      ? ZOOM_LEVELS.find((level) => level > current + 0.01) ?? ZOOM_LEVELS.at(-1)
      : ZOOM_LEVELS.findLast((level) => level < current - 0.01) ?? ZOOM_LEVELS[0]
  setStageZoom(target, { mode: 'manual' })
}

function setStageZoom(zoom, options = {}) {
  const nextZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 0.35, 1.5)
  state.zoom = nextZoom
  state.zoomMode = options.mode ?? 'manual'
  stage.scale({ x: nextZoom, y: nextZoom })
  stage.width(Math.round(SCENE_WIDTH * nextZoom))
  stage.height(Math.round(SCENE_HEIGHT * nextZoom))
  stage.batchDraw()
  updateZoomControls()
  if (!options.silent) {
    const action = state.zoomMode === 'fit' ? '已适配画布视图' : '已设置画布缩放'
    showStatus(`${action} ${formatZoom(nextZoom)}`)
  }
}

function updateZoomControls() {
  els.zoomSelect.value = state.zoomMode === 'fit' ? 'fit' : String(state.zoom)
  els.zoomOut.disabled = state.zoom <= ZOOM_LEVELS[0]
  els.zoomIn.disabled = state.zoom >= ZOOM_LEVELS.at(-1)
}

function formatZoom(zoom) {
  return `${Math.round(zoom * 100)}%`
}

async function exportCode() {
  const payload = await postJson('/utils/json2code', {
    board: cleanBoard(state.board),
    key: 14,
  })
  els.codeOutput.value = payload.code
  els.codeInput.value = payload.code
  updateCodeUrl(payload.code)
}

async function renderPreview() {
  const code = await exportAndReturnCode()
  const payload = await postJson('/board/render', {
    code,
  })
  els.preview.src = `/preview/${payload.data.hash}.webp?${Date.now()}`
  els.preview.style.display = 'block'
}

async function exportAndReturnCode() {
  const payload = await postJson('/utils/json2code', {
    board: cleanBoard(state.board),
    key: 14,
  })
  els.codeOutput.value = payload.code
  els.codeInput.value = payload.code
  updateCodeUrl(payload.code)
  return payload.code
}

function cleanBoard(board) {
  return {
    name: board.name || undefined,
    boardBackground: board.boardBackground,
    objects: board.objects.map((object) => {
      const copy = sanitizeObject(object)
      for (const key of Object.keys(copy)) {
        if (copy[key] === undefined || copy[key] === '') delete copy[key]
      }
      return copy
    }),
  }
}

function sanitizeObject(object) {
  const capabilities = getObjectCapabilities(object.type)
  const copy = { ...object }
  if (!capabilities.appearance) {
    delete copy.color
    delete copy.transparency
  }
  if (!capabilities.text) {
    delete copy.text
  }
  if (!capabilities.line) {
    delete copy.endX
    delete copy.endY
  }
  if (!capabilities.arcAngle) {
    delete copy.arcAngle
  }
  if (!capabilities.donutRadius) {
    delete copy.donutRadius
  }
  return copy
}

function recordHistory() {
  state.history.push({
    board: structuredClone(state.board),
    selectedIndex: state.selectedIndex,
  })
  if (state.history.length > 80) {
    state.history.shift()
  }
  state.future = []
  updateHistoryButtons()
}

function undo() {
  const snapshot = state.history.pop()
  if (!snapshot) return
  state.future.push({
    board: structuredClone(state.board),
    selectedIndex: state.selectedIndex,
  })
  restoreSnapshot(snapshot)
  showStatus('已撤销')
}

function redo() {
  const snapshot = state.future.pop()
  if (!snapshot) return
  state.history.push({
    board: structuredClone(state.board),
    selectedIndex: state.selectedIndex,
  })
  restoreSnapshot(snapshot)
  showStatus('已重做')
}

function restoreSnapshot(snapshot) {
  state.board = structuredClone(snapshot.board)
  state.selectedIndex = Math.min(
    snapshot.selectedIndex,
    state.board.objects.length - 1,
  )
  els.boardName.value = state.board.name ?? ''
  renderBackgroundOptions()
  renderAll()
  updateHistoryButtons()
}

function updateHistoryButtons() {
  els.undo.disabled = state.history.length === 0
  els.redo.disabled = state.future.length === 0
}

function updateSelectionActions() {
  const object = getSelected()
  const hasSelection = Boolean(object)
  els.clearBoard.disabled = state.board.objects.length === 0
  els.deleteObject.disabled = !hasSelection
  els.duplicateObject.disabled = !hasSelection
  els.centerObject.disabled = !hasSelection || Boolean(object?.locked)
  els.moveUp.disabled =
    !hasSelection || state.selectedIndex >= state.board.objects.length - 1
  els.moveDown.disabled = !hasSelection || state.selectedIndex <= 0
}

function handleKeyboard(event) {
  const target = event.target
  const isEditingText = isTextEditingTarget(target)
  if (handleZoomShortcut(event)) {
    return
  }
  if (!isEditingText && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copySelected()
    return
  }
  if (!isEditingText && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelected()
    return
  }
  if (!isEditingText && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    pasteObject()
    return
  }
  if (!isEditingText && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault()
    nudgeSelected(event.key, event.shiftKey ? 10 : 1)
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redo()
    } else {
      undo()
    }
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if (!isEditingText && event.key === 'Escape') {
    event.preventDefault()
    selectObject(-1)
    showStatus('已取消选择')
    return
  }
  if (!isEditingText && ['Backspace', 'Delete'].includes(event.key)) {
    event.preventDefault()
    deleteSelected()
    return
  }
}

function isTextEditingTarget(target) {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }
  if (!(target instanceof HTMLInputElement)) {
    return false
  }
  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(
    target.type,
  )
}

function handleZoomShortcut(event) {
  if (!(event.ctrlKey || event.metaKey)) return false

  const key = event.key.toLowerCase()
  if (key === '+' || key === '=' || event.code === 'Equal' || event.code === 'NumpadAdd') {
    event.preventDefault()
    stepZoom(1)
    return true
  }
  if (key === '-' || key === '_' || event.code === 'Minus' || event.code === 'NumpadSubtract') {
    event.preventDefault()
    stepZoom(-1)
    return true
  }
  if (key === '0' || event.code === 'Digit0' || event.code === 'Numpad0') {
    event.preventDefault()
    applyFitZoom()
    return true
  }

  return false
}

function copySelected() {
  const object = getSelected()
  if (!object) return
  state.clipboard = structuredClone(object)
  showStatus(`已复制 ${object.type}`)
}

function pasteObject() {
  if (!state.clipboard) return
  recordHistory()
  const object = createPastedObject(state.clipboard)
  state.board.objects.push(object)
  selectObject(state.board.objects.length - 1)
  showStatus(`已粘贴 ${object.type}`)
}

function createPastedObject(object) {
  const copy = structuredClone(object)
  copy.x = clamp((copy.x ?? 256) + 18, 0, 512)
  copy.y = clamp((copy.y ?? 192) + 18, 0, 384)
  if (copy.type === 'line' && copy.endX !== undefined && copy.endY !== undefined) {
    copy.endX = clamp(copy.endX + 18, 0, 512)
    copy.endY = clamp(copy.endY + 18, 0, 384)
  }
  return copy
}

function nudgeSelected(key, step) {
  const object = getSelected()
  if (!object || object.locked) return
  const delta = {
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
  }[key]
  if (!delta) return
  recordHistory()
  const [dx, dy] = delta
  const point = normalizePoint(object.x + dx, object.y + dy)
  object.x = point.x
  object.y = point.y
  if (object.type === 'line' && object.endX !== undefined && object.endY !== undefined) {
    object.endX = clamp(Math.round(object.endX + dx), 0, 512)
    object.endY = clamp(Math.round(object.endY + dy), 0, 384)
  }
  renderAll()
}

async function runAction(action, successMessage) {
  try {
    await action()
    showStatus(successMessage)
  } catch (error) {
    handleError(error)
  }
}

function handleError(error) {
  console.error(error)
  showStatus(error.message ?? '操作失败', { type: 'error' })
}

function showStatus(message, options = {}) {
  clearTimeout(state.statusTimer)
  els.status.textContent = message
  els.status.classList.toggle('error', options.type === 'error')
  els.status.classList.add('visible')
  state.statusTimer = window.setTimeout(() => {
    els.status.classList.remove('visible')
  }, 2200)
}

function loadSavedBoard() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('Failed to load saved board', error)
    return null
  }
}

function persistBoard() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanBoard(state.board)))
  } catch (error) {
    console.warn('Failed to save board', error)
  }
}

function updateCodeUrl(code) {
  const url = new URL(window.location.href)
  url.searchParams.set('code', code)
  window.history.replaceState(null, '', url)
}

function getSelected() {
  return state.board.objects[state.selectedIndex]
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

function numberValue(input, min, max) {
  return clamp(Number(input.value || 0), min, max)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeAngle(value) {
  return Math.round(((value % 360) + 360) % 360)
}

function normalizePoint(x, y) {
  return {
    x: normalizeCoordinate(x, 0, 512),
    y: normalizeCoordinate(y, 0, 384),
  }
}

function normalizeCoordinate(value, min, max) {
  const rounded = state.snapToGrid
    ? Math.round(value / SNAP_STEP) * SNAP_STEP
    : Math.round(value)
  return clamp(rounded, min, max)
}

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? '请求失败')
  }
  return payload
}

init().catch((error) => {
  console.error(error)
  alert(error.message)
})
