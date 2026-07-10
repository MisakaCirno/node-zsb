import { ZOOM_LEVELS } from './constants.js'
import { clamp } from './geometry.js'

const MIN_ZOOM = ZOOM_LEVELS[0]
const MAX_ZOOM = ZOOM_LEVELS.at(-1) ?? 2
const WHEEL_ZOOM_SENSITIVITY = 0.0015

interface ViewportNavigationOptions {
  host: HTMLElement
  getZoom(): number
  setZoom(zoom: number): void
}

interface RectLike {
  height: number
  left: number
  top: number
  width: number
}

interface PointLike {
  x: number
  y: number
}

interface PanState {
  pointerId: number
  pointerX: number
  pointerY: number
  scrollLeft: number
  scrollTop: number
}

export function bindViewportNavigation({
  host,
  getZoom,
  setZoom,
}: ViewportNavigationOptions): void {
  const document = host.ownerDocument
  const window = document.defaultView
  let spacePressed = false
  let panState: PanState | null = null

  document.addEventListener('keydown', (event) => {
    if (
      event.code !== 'Space'
      || event.repeat
      || isTextEditingTarget(event.target)
      || document.querySelector('dialog[open]')
    ) return
    spacePressed = true
    host.classList.add('can-pan')
    event.preventDefault()
  })
  document.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return
    spacePressed = false
    if (!panState) host.classList.remove('can-pan')
  })
  window?.addEventListener('blur', resetNavigationState)

  host.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return
    const canvas = host.querySelector('canvas')
    if (!canvas) return
    event.preventDefault()
    const before = canvas.getBoundingClientRect()
    const nextZoom = getWheelZoom(getZoom(), event.deltaY)
    if (Math.abs(nextZoom - getZoom()) < 0.0001) return
    const pointer = { x: event.clientX, y: event.clientY }
    const beforeScroll = {
      left: host.scrollLeft,
      top: host.scrollTop,
    }
    setZoom(nextZoom)
    const after = canvas.getBoundingClientRect()
    const nextScroll = getAnchoredScrollPosition({
      after,
      before,
      pointer,
      scrollLeft: beforeScroll.left,
      scrollTop: beforeScroll.top,
    })
    host.scrollLeft = nextScroll.left
    host.scrollTop = nextScroll.top
  }, { passive: false })

  host.addEventListener('pointerdown', (event) => {
    const shouldPan = event.button === 1 || (event.button === 0 && spacePressed)
    if (!shouldPan) return
    event.preventDefault()
    event.stopPropagation()
    panState = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollLeft: host.scrollLeft,
      scrollTop: host.scrollTop,
    }
    host.setPointerCapture(event.pointerId)
    host.classList.add('is-panning')
  }, { capture: true })
  host.addEventListener('pointermove', (event) => {
    if (!panState || event.pointerId !== panState.pointerId) return
    event.preventDefault()
    const scroll = getPannedScrollPosition({
      startPointer: { x: panState.pointerX, y: panState.pointerY },
      currentPointer: { x: event.clientX, y: event.clientY },
      startScrollLeft: panState.scrollLeft,
      startScrollTop: panState.scrollTop,
    })
    host.scrollLeft = scroll.left
    host.scrollTop = scroll.top
  })
  host.addEventListener('pointerup', finishPan)
  host.addEventListener('pointercancel', finishPan)

  function finishPan(event: PointerEvent) {
    if (!panState || event.pointerId !== panState.pointerId) return
    if (host.hasPointerCapture(event.pointerId)) {
      host.releasePointerCapture(event.pointerId)
    }
    panState = null
    host.classList.remove('is-panning')
    if (!spacePressed) host.classList.remove('can-pan')
  }

  function resetNavigationState() {
    if (panState && host.hasPointerCapture(panState.pointerId)) {
      host.releasePointerCapture(panState.pointerId)
    }
    spacePressed = false
    panState = null
    host.classList.remove('can-pan', 'is-panning')
  }
}

export function getWheelZoom(currentZoom: number, deltaY: number): number {
  const current = Number.isFinite(currentZoom) ? currentZoom : 1
  const next = current * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY)
  return Number(clamp(next, MIN_ZOOM, MAX_ZOOM).toFixed(3))
}

export function getAnchoredScrollPosition({
  after,
  before,
  pointer,
  scrollLeft,
  scrollTop,
}: {
  after: RectLike
  before: RectLike
  pointer: PointLike
  scrollLeft: number
  scrollTop: number
}): { left: number, top: number } {
  const ratioX = before.width > 0 ? (pointer.x - before.left) / before.width : 0.5
  const ratioY = before.height > 0 ? (pointer.y - before.top) / before.height : 0.5
  return {
    left: scrollLeft + after.left + ratioX * after.width - pointer.x,
    top: scrollTop + after.top + ratioY * after.height - pointer.y,
  }
}

export function getPannedScrollPosition({
  startPointer,
  currentPointer,
  startScrollLeft,
  startScrollTop,
}: {
  startPointer: PointLike
  currentPointer: PointLike
  startScrollLeft: number
  startScrollTop: number
}): { left: number, top: number } {
  return {
    left: startScrollLeft - (currentPointer.x - startPointer.x),
    top: startScrollTop - (currentPointer.y - startPointer.y),
  }
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLInputElement && ![
      'button',
      'checkbox',
      'color',
      'file',
      'radio',
      'range',
      'reset',
      'submit',
    ].includes(target.type))
}
