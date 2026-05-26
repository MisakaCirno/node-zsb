const LAYOUT_KEY = 'node-zsb-editor-layout-v1'
const DEFAULT_LEFT_WIDTH = 390
const DEFAULT_RIGHT_WIDTH = 300
const MIN_LEFT_WIDTH = 276
const MIN_RIGHT_WIDTH = 300
const MIN_STAGE_WIDTH = 620
const RESIZER_WIDTH = 6
const KEYBOARD_STEP = 16

declare const document: DocumentLike
declare const window: WindowLike
declare function getComputedStyle(element: LayoutShellElement): StyleDeclarationLike

type PanelSide = 'left' | 'right'

interface LayoutResizerDeps {
  elements: LayoutElements
  onResize(): void
}

interface LayoutElements {
  shell: LayoutShellElement
  leftPanelResizer: ResizerElement
  rightPanelResizer: ResizerElement
}

interface LayoutShellElement {
  clientWidth: number
  style: {
    setProperty(name: string, value: string): void
  }
  getBoundingClientRect(): { left: number, right: number }
}

interface ResizerElement {
  addEventListener(
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    listener: (event: PointerEventLike) => void,
  ): void
  addEventListener(type: 'keydown', listener: (event: KeyboardEventLike) => void): void
  addEventListener(type: string, listener: () => void): void
  hasPointerCapture(pointerId: number): boolean
  releasePointerCapture(pointerId: number): void
  setAttribute(name: string, value: string): void
  setPointerCapture(pointerId: number): void
}

interface DocumentLike {
  body: {
    classList: {
      add(className: string): void
      remove(className: string): void
    }
  }
}

interface WindowLike {
  innerWidth: number
  localStorage: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }
}

interface StyleDeclarationLike {
  getPropertyValue(name: string): string
}

interface PointerEventLike {
  clientX: number
  key?: string
  pointerId: number
  preventDefault(): void
}

interface KeyboardEventLike {
  key: string
  clientX?: number
  pointerId?: number
  preventDefault(): void
}

interface NormalizedLayout {
  left: number
  right: number
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
}

function bindResizer({
  elements,
  onResize,
  side,
  trigger,
}: LayoutResizerDeps & { side: PanelSide, trigger: ResizerElement }) {
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
}: LayoutResizerDeps & { side: PanelSide, x: number }) {
  const shellRect = elements.shell.getBoundingClientRect()
  const layout = getCurrentLayout(elements)
  layout[side] = side === 'left'
    ? x - shellRect.left
    : shellRect.right - x
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
  elements.leftPanelResizer.setAttribute('aria-valuenow', String(next.left))
  elements.rightPanelResizer.setAttribute('aria-valuenow', String(next.right))
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
  return { left, right }
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
  }
}

function getKeyboardDelta(event: KeyboardEventLike | PointerEventLike, side: PanelSide) {
  if (event.key === 'ArrowLeft') return side === 'left' ? -KEYBOARD_STEP : KEYBOARD_STEP
  if (event.key === 'ArrowRight') return side === 'left' ? KEYBOARD_STEP : -KEYBOARD_STEP
  return 0
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
