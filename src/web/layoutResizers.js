const LAYOUT_KEY = 'node-zsb-editor-layout-v1'
const DEFAULT_LEFT_WIDTH = 340
const DEFAULT_RIGHT_WIDTH = 300
const MIN_LEFT_WIDTH = 230
const MIN_RIGHT_WIDTH = 300
const MIN_STAGE_WIDTH = 620
const RESIZER_WIDTH = 6
const KEYBOARD_STEP = 16

export function bindLayoutResizers({
  elements,
  onResize,
}) {
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
}

function bindResizer({
  elements,
  onResize,
  side,
  trigger,
}) {
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

function updatePanelWidth({
  elements,
  onResize,
  side,
  x,
}) {
  const shellRect = elements.shell.getBoundingClientRect()
  const layout = getCurrentLayout(elements)
  layout[side] = side === 'left'
    ? x - shellRect.left
    : shellRect.right - x
  saveAndApplyLayout(elements, layout, onResize)
}

function saveAndApplyLayout(elements, layout, onResize) {
  const next = normalizeLayout(elements, layout)
  saveLayout(next)
  applyLayout(elements, next)
  onResize()
}

function applyLayout(elements, layout) {
  const next = normalizeLayout(elements, layout)
  elements.shell.style.setProperty('--left-panel-width', `${next.left}px`)
  elements.shell.style.setProperty('--right-panel-width', `${next.right}px`)
  elements.leftPanelResizer.setAttribute('aria-valuenow', String(next.left))
  elements.rightPanelResizer.setAttribute('aria-valuenow', String(next.right))
}

function normalizeLayout(elements, layout) {
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
  return { left, right }
}

function getMaxPanelWidth(shellWidth, oppositeWidth) {
  return Math.max(
    MIN_LEFT_WIDTH,
    shellWidth - oppositeWidth - MIN_STAGE_WIDTH - (RESIZER_WIDTH * 2),
  )
}

function getCurrentLayout(elements) {
  const styles = getComputedStyle(elements.shell)
  return {
    left: Number.parseFloat(styles.getPropertyValue('--left-panel-width')),
    right: Number.parseFloat(styles.getPropertyValue('--right-panel-width')),
  }
}

function getKeyboardDelta(event, side) {
  if (event.key === 'ArrowLeft') return side === 'left' ? -KEYBOARD_STEP : KEYBOARD_STEP
  if (event.key === 'ArrowRight') return side === 'left' ? KEYBOARD_STEP : -KEYBOARD_STEP
  return 0
}

function loadLayout() {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLayout(layout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    // Layout persistence is a convenience; resizing should still work without storage.
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
