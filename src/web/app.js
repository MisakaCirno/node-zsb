const SCENE_WIDTH = 1024
const SCENE_HEIGHT = 768
const LOGICAL_SCALE = 2

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
  images: new Map(),
  history: [],
  future: [],
  statusTimer: 0,
}

const stage = new Konva.Stage({
  container: 'stage-host',
  width: SCENE_WIDTH,
  height: SCENE_HEIGHT,
})
const boardLayer = new Konva.Layer()
const objectLayer = new Konva.Layer()
const transformerLayer = new Konva.Layer()
const transformer = new Konva.Transformer({
  rotateEnabled: true,
  enabledAnchors: [],
  borderStroke: '#66c2a5',
  anchorStroke: '#66c2a5',
})

stage.add(boardLayer)
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
  preview: document.querySelector('#preview-image'),
  status: document.querySelector('#status'),
  undo: document.querySelector('#undo-action'),
  redo: document.querySelector('#redo-action'),
  deleteObject: document.querySelector('#delete-object'),
  duplicateObject: document.querySelector('#duplicate-object'),
  moveUp: document.querySelector('#move-up'),
  moveDown: document.querySelector('#move-down'),
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
  els.codeInput.value = meta.defaultCode
  await loadFromCode(meta.defaultCode, { record: false })
  bindEvents()
  renderPaletteTabs()
  renderAll()
  showStatus('编辑器已就绪')
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
  els.deleteObject.addEventListener('click', deleteSelected)
  els.duplicateObject.addEventListener('click', duplicateSelected)
  els.moveUp.addEventListener('click', () => moveSelected(1))
  els.moveDown.addEventListener('click', () => moveSelected(-1))
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
  renderAll()
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
  await renderObjects()
  renderLayers()
  renderInspector()
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
  const group = new Konva.Group({
    x: startX,
    y: startY,
    rotation: object.angle ?? 0,
  })
  group.add(
    new Konva.Line({
      points: [0, 0, endX - startX, endY - startY],
      stroke: object.color ?? '#ff8000',
      strokeWidth: (object.height ?? 6) * LOGICAL_SCALE,
      lineCap: 'round',
    }),
  )
  group.add(new Konva.Circle({ x: 0, y: 0, radius: 8, fill: 'white', stroke: '#43A8D8', strokeWidth: 2 }))
  group.add(new Konva.Circle({ x: endX - startX, y: endY - startY, radius: 8, fill: 'white', stroke: '#43A8D8', strokeWidth: 2 }))
  return group
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
  object.x = clamp(Math.round(node.x() / LOGICAL_SCALE), 0, 512)
  object.y = clamp(Math.round(node.y() / LOGICAL_SCALE), 0, 384)
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
  if (!object) return
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
}

function updateSelectedFromInspector() {
  const object = getSelected()
  if (!object) return
  recordHistory()
  object.x = numberValue(els.x, 0, 512)
  object.y = numberValue(els.y, 0, 384)
  object.size = numberValue(els.size, 10, 300)
  object.angle = numberValue(els.angle, 0, 360)
  object.color = els.color.value
  object.transparency = numberValue(els.transparency, 0, 100)
  object.text = els.text.value || undefined
  object.endX = numberValue(els.endX, 0, 512)
  object.endY = numberValue(els.endY, 0, 384)
  object.arcAngle = numberValue(els.arc, 10, 360)
  object.donutRadius = numberValue(els.donut, 0, 240)
  object.hidden = els.hidden.checked || undefined
  object.locked = els.locked.checked || undefined
  renderAll()
}

function renderLayers() {
  els.layers.innerHTML = ''
  state.board.objects.forEach((object, index) => {
    const row = document.createElement('div')
    row.className = 'layer-row'
    row.classList.toggle('active', index === state.selectedIndex)
    row.innerHTML = `<span>${index + 1}. ${object.type}</span><span>${Math.round(object.x)}, ${Math.round(object.y)}</span>`
    row.addEventListener('click', () => selectObject(index))
    els.layers.append(row)
  })
}

function deleteSelected() {
  if (state.selectedIndex < 0) return
  recordHistory()
  state.board.objects.splice(state.selectedIndex, 1)
  state.selectedIndex = -1
  renderAll()
}

function duplicateSelected() {
  const object = getSelected()
  if (!object) return
  recordHistory()
  const copy = structuredClone(object)
  copy.x = clamp(copy.x + 18, 0, 512)
  copy.y = clamp(copy.y + 18, 0, 384)
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

async function exportCode() {
  const payload = await postJson('/utils/json2code', {
    board: cleanBoard(state.board),
    key: 14,
  })
  els.codeOutput.value = payload.code
  els.codeInput.value = payload.code
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
  return payload.code
}

function cleanBoard(board) {
  return {
    name: board.name || undefined,
    boardBackground: board.boardBackground,
    objects: board.objects.map((object) => {
      const copy = { ...object }
      for (const key of Object.keys(copy)) {
        if (copy[key] === undefined || copy[key] === '') delete copy[key]
      }
      return copy
    }),
  }
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

function handleKeyboard(event) {
  const target = event.target
  const isEditingText =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
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
  if (!isEditingText && event.key === 'Delete') {
    deleteSelected()
  }
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
