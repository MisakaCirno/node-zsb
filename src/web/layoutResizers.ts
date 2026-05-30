const LAYOUT_KEY = 'node-zsb-editor-layout-v1'
const DEFAULT_LEFT_WIDTH = 390
const DEFAULT_RIGHT_WIDTH = 300
const MIN_LEFT_WIDTH = 276
const MIN_RIGHT_WIDTH = 300
const MIN_STAGE_WIDTH = 620
const DEFAULT_RIGHT_PROPERTY_HEIGHT = 46
const MIN_RIGHT_SECTION_HEIGHT = 220
const RESIZER_WIDTH = 6
const KEYBOARD_STEP = 16
const SPLIT_KEYBOARD_STEP = 4

type PanelSide = 'left' | 'right'

interface LayoutResizerDeps {
  elements: LayoutElements
  onResize(): void
}

interface LayoutElements {
  shell: HTMLElement
  leftPanelResizer: HTMLElement
  rightPanelResizer: HTMLElement
  rightPanelHeightResizer: HTMLElement
}

interface NormalizedLayout {
  left: number
  right: number
  rightPropertyHeight: number
}

type LayoutState = Partial<NormalizedLayout>

export function bindLayoutResizers({
  elements,
  onResize,
}: LayoutResizerDeps) {
  const state = loadLayout()
  applyLayout(elements, state)
  bindResizer({
    elements,
    onResize,
    side: 'left',
    trigger: elements.leftPanelResizer,
  })
  bindResizer({
    elements,
    onResize,
    side: 'right',
    trigger: elements.rightPanelResizer,
  })
  bindHeightResizer({
    elements,
    onResize,
    trigger: elements.rightPanelHeightResizer,
  })
}

function bindResizer({
  elements,
  onResize,
  side,
  trigger,
}: LayoutResizerDeps & { side: PanelSide, trigger: HTMLElement }) {
  trigger.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    trigger.setPointerCapture(event.pointerId)
    document.body.classList.add('resizing-panels')
    updatePanelWidth({
      elements,
      onResize,
      side,
      x: event.clientX,
    })
  })
  trigger.addEventListener('pointermove', (event) => {
    if (!trigger.hasPointerCapture(event.pointerId)) return
    updatePanelWidth({
      elements,
      onResize,
      side,
      x: event.clientX,
    })
  })
  trigger.addEventListener('pointerup', (event) => {
    if (trigger.hasPointerCapture(event.pointerId)) {
      trigger.releasePointerCapture(event.pointerId)
    }
    document.body.classList.remove('resizing-panels')
  })
  trigger.addEventListener('pointercancel', () => {
    document.body.classList.remove('resizing-panels')
  })
  trigger.addEventListener('dblclick', () => {
    const layout = getCurrentLayout(elements)
    layout[side] = side === 'left' ? DEFAULT_LEFT_WIDTH : DEFAULT_RIGHT_WIDTH
    saveAndApplyLayout(elements, layout, onResize)
  })
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Home') {
      event.preventDefault()
      const layout = getCurrentLayout(elements)
      layout[side] = side === 'left' ? DEFAULT_LEFT_WIDTH : DEFAULT_RIGHT_WIDTH
      saveAndApplyLayout(elements, layout, onResize)
      return
    }
    const delta = getKeyboardDelta(event, side)
    if (!delta) return
    event.preventDefault()
    const layout = getCurrentLayout(elements)
    layout[side] += delta
    saveAndApplyLayout(elements, layout, onResize)
  })
}

function bindHeightResizer({
  elements,
  onResize,
  trigger,
}: LayoutResizerDeps & { trigger: HTMLElement }) {
  trigger.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    trigger.setPointerCapture(event.pointerId)
    document.body.classList.add('resizing-panel-height')
    updateRightPanelHeight({
      elements,
      onResize,
      y: event.clientY,
    })
  })
  trigger.addEventListener('pointermove', (event) => {
    if (!trigger.hasPointerCapture(event.pointerId)) return
    updateRightPanelHeight({
      elements,
      onResize,
      y: event.clientY,
    })
  })
  trigger.addEventListener('pointerup', (event) => {
    if (trigger.hasPointerCapture(event.pointerId)) {
      trigger.releasePointerCapture(event.pointerId)
    }
    document.body.classList.remove('resizing-panel-height')
  })
  trigger.addEventListener('pointercancel', () => {
    document.body.classList.remove('resizing-panel-height')
  })
  trigger.addEventListener('dblclick', () => {
    const layout = getCurrentLayout(elements)
    layout.rightPropertyHeight = DEFAULT_RIGHT_PROPERTY_HEIGHT
    saveAndApplyLayout(elements, layout, onResize)
  })
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Home') {
      event.preventDefault()
      const layout = getCurrentLayout(elements)
      layout.rightPropertyHeight = DEFAULT_RIGHT_PROPERTY_HEIGHT
      saveAndApplyLayout(elements, layout, onResize)
      return
    }
    const delta = getSplitKeyboardDelta(event)
    if (!delta) return
    event.preventDefault()
    const layout = getCurrentLayout(elements)
    layout.rightPropertyHeight += delta
    saveAndApplyLayout(elements, layout, onResize)
  })
}

function updatePanelWidth({
  elements,
  onResize,
  side,
  x,
}: LayoutResizerDeps & { side: PanelSide, x: number }) {
  const shellRect = elements.shell.getBoundingClientRect()
  const layout = getCurrentLayout(elements)
  layout[side] = side === 'left'
    ? x - shellRect.left
    : shellRect.right - x
  saveAndApplyLayout(elements, layout, onResize)
}

function updateRightPanelHeight({
  elements,
  onResize,
  y,
}: LayoutResizerDeps & { y: number }) {
  const inspectorRect = getInspectorContentRect(elements)
  const layout = getCurrentLayout(elements)
  layout.rightPropertyHeight = ((y - inspectorRect.top) / inspectorRect.height) * 100
  saveAndApplyLayout(elements, layout, onResize)
}

function saveAndApplyLayout(elements: LayoutElements, layout: LayoutState, onResize: () => void) {
  const next = normalizeLayout(elements, layout)
  saveLayout(next)
  applyLayout(elements, next)
  onResize()
}

function applyLayout(elements: LayoutElements, layout: LayoutState) {
  const next = normalizeLayout(elements, layout)
  elements.shell.style.setProperty('--left-panel-width', `${next.left}px`)
  elements.shell.style.setProperty('--right-panel-width', `${next.right}px`)
  elements.shell.style.setProperty('--right-property-height', `${next.rightPropertyHeight}%`)
  elements.leftPanelResizer.setAttribute('aria-valuenow', String(next.left))
  elements.rightPanelResizer.setAttribute('aria-valuenow', String(next.right))
  const splitBounds = getRightPropertyHeightBounds(elements)
  elements.rightPanelHeightResizer.setAttribute('aria-valuemin', String(Math.round(splitBounds.min)))
  elements.rightPanelHeightResizer.setAttribute('aria-valuemax', String(Math.round(splitBounds.max)))
  elements.rightPanelHeightResizer.setAttribute('aria-valuenow', String(Math.round(next.rightPropertyHeight)))
  elements.rightPanelHeightResizer.setAttribute('aria-valuetext', `${Math.round(next.rightPropertyHeight)}%`)
}

function normalizeLayout(elements: LayoutElements, layout: LayoutState): NormalizedLayout {
  const shellWidth = elements.shell.clientWidth || window.innerWidth
  const left = clamp(
    Number(layout.left) || DEFAULT_LEFT_WIDTH,
    MIN_LEFT_WIDTH,
    getMaxPanelWidth(shellWidth, Number(layout.right) || DEFAULT_RIGHT_WIDTH),
  )
  const right = clamp(
    Number(layout.right) || DEFAULT_RIGHT_WIDTH,
    MIN_RIGHT_WIDTH,
    getMaxPanelWidth(shellWidth, left),
  )
  const rightPropertyHeight = clamp(
    Number(layout.rightPropertyHeight) || DEFAULT_RIGHT_PROPERTY_HEIGHT,
    getRightPropertyHeightBounds(elements).min,
    getRightPropertyHeightBounds(elements).max,
  )
  return { left, right, rightPropertyHeight }
}

function getMaxPanelWidth(shellWidth: number, oppositeWidth: number) {
  return Math.max(
    MIN_LEFT_WIDTH,
    shellWidth - oppositeWidth - MIN_STAGE_WIDTH - (RESIZER_WIDTH * 2),
  )
}

function getCurrentLayout(elements: LayoutElements): NormalizedLayout {
  const styles = getComputedStyle(elements.shell)
  return {
    left: Number.parseFloat(styles.getPropertyValue('--left-panel-width')),
    right: Number.parseFloat(styles.getPropertyValue('--right-panel-width')),
    rightPropertyHeight: Number.parseFloat(styles.getPropertyValue('--right-property-height')),
  }
}

function getKeyboardDelta(event: KeyboardEvent, side: PanelSide) {
  if (event.key === 'ArrowLeft') return side === 'left' ? -KEYBOARD_STEP : KEYBOARD_STEP
  if (event.key === 'ArrowRight') return side === 'left' ? KEYBOARD_STEP : -KEYBOARD_STEP
  return 0
}

function getSplitKeyboardDelta(event: KeyboardEvent) {
  if (event.key === 'ArrowUp') return -SPLIT_KEYBOARD_STEP
  if (event.key === 'ArrowDown') return SPLIT_KEYBOARD_STEP
  return 0
}

function getRightPropertyHeightBounds(elements: LayoutElements) {
  const inspectorHeight = getInspectorContentRect(elements).height
  const resizerHeight = elements.rightPanelHeightResizer.getBoundingClientRect().height || 10
  const availableHeight = Math.max(1, inspectorHeight - resizerHeight)
  const minPanelHeight = Math.min(
    MIN_RIGHT_SECTION_HEIGHT,
    Math.max(140, (availableHeight / 2) - 8),
  )
  const min = (minPanelHeight / availableHeight) * 100
  return {
    min,
    max: 100 - min,
  }
}

function getInspectorContentRect(elements: LayoutElements) {
  const inspector = elements.rightPanelHeightResizer.parentElement
  const element = inspector ?? elements.shell
  const rect = element.getBoundingClientRect()
  const styles = getComputedStyle(element)
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  return {
    top: rect.top + element.clientTop + paddingTop,
    height: Math.max(1, element.clientHeight - paddingTop - paddingBottom),
  }
}

function loadLayout(): LayoutState {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLayout(layout: NormalizedLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    // Layout persistence is a convenience; resizing should still work without storage.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
