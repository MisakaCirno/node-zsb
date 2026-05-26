declare const document: DocumentLike

interface ColorPickerDeps {
  elements: ColorPickerElements
  onChange?: () => void
}

export interface ColorPickerElements {
  color: ValueElement
  colorTrigger: EventElement
  colorText: ValueElement & EventElement
  colorHue: ValueElement & EventElement
  colorPopover: ClassListElement
  colorPreview: {
    style: {
      background: string
    }
  }
  colorSaturation: SaturationElement
  colorSaturationHandle: {
    style: {
      left: string
      top: string
    }
  }
  colorSwatches: QueryElement
}

interface ValueElement {
  value: string
}

interface EventElement {
  addEventListener(type: string, listener: (event: EventLike) => void): void
}

interface ClassListElement {
  classList: {
    add(className: string): void
    contains(className: string): boolean
    remove(className: string): void
    toggle(className: string, force?: boolean): void
  }
}

interface SaturationElement extends EventElement {
  style: {
    setProperty(name: string, value: string): void
  }
  getBoundingClientRect(): RectLike
  hasPointerCapture(pointerId: number): boolean
  querySelectorAll?(selector: string): SwatchElement[]
  setAttribute(name: string, value: string): void
  setPointerCapture(pointerId: number): void
}

interface QueryElement {
  addEventListener(type: string, listener: (event: EventLike) => void): void
  querySelectorAll(selector: string): SwatchElement[]
}

interface SwatchElement {
  dataset: { color?: string }
  classList: {
    toggle(className: string, force?: boolean): void
  }
}

interface EventLike {
  clientX: number
  clientY: number
  key: string
  pointerId: number
  target: {
    closest(selector: string): (SwatchElement & { dataset: { color?: string } }) | null
  }
  preventDefault(): void
  stopPropagation(): void
}

interface DocumentLike {
  addEventListener(type: string, listener: (event: EventLike) => void): void
}

interface RectLike {
  height: number
  left: number
  top: number
  width: number
}

interface HsvColor {
  h: number
  s: number
  v: number
}

export function bindColorPicker({
  elements,
  onChange,
}: ColorPickerDeps) {
  elements.colorTrigger.addEventListener('click', (event) => {
    event.stopPropagation()
    elements.colorPopover.classList.toggle('hidden')
  })
  elements.colorText.addEventListener('input', () => {
    setColorValue(elements, elements.colorText.value, onChange)
  })
  elements.colorHue.addEventListener('input', () => {
    const hsv = hexToHsv(elements.color.value)
    setColorValue(elements, hsvToHex({
      h: Number(elements.colorHue.value),
      s: hsv.s,
      v: hsv.v,
    }), onChange)
  })
  elements.colorSaturation.addEventListener('pointerdown', (event) => {
    elements.colorSaturation.setPointerCapture(event.pointerId)
    updateSaturationFromPointer(elements, event, onChange)
  })
  elements.colorSaturation.addEventListener('pointermove', (event) => {
    if (!elements.colorSaturation.hasPointerCapture(event.pointerId)) return
    updateSaturationFromPointer(elements, event, onChange)
  })
  elements.colorSaturation.addEventListener('keydown', (event) => {
    const delta = {
      ArrowUp: { s: 0, v: 0.03 },
      ArrowDown: { s: 0, v: -0.03 },
      ArrowLeft: { s: -0.03, v: 0 },
      ArrowRight: { s: 0.03, v: 0 },
    }[event.key]
    if (!delta) return
    event.preventDefault()
    const hsv = hexToHsv(elements.color.value)
    setColorValue(elements, hsvToHex({
      h: hsv.h,
      s: clamp01(hsv.s + delta.s),
      v: clamp01(hsv.v + delta.v),
    }), onChange)
  })
  elements.colorSwatches.addEventListener('click', (event) => {
    const button = event.target.closest('[data-color]')
    if (!button) return
    setColorValue(elements, button.dataset.color, onChange)
  })
  document.addEventListener('click', (event) => {
    if (elements.colorPopover.classList.contains('hidden')) return
    if (event.target.closest('.color-control')) return
    elements.colorPopover.classList.add('hidden')
  })
}

export function setColorValue(
  elements: ColorPickerElements,
  value: string | undefined,
  onChange?: () => void,
) {
  const color = normalizeHexColor(value)
  if (!color) return
  elements.color.value = color
  syncColorControl(elements)
  onChange?.()
}

export function syncColorControl(elements: ColorPickerElements) {
  const color = normalizeHexColor(elements.color.value) || '#ff8000'
  const hsv = hexToHsv(color)
  elements.color.value = color
  elements.colorText.value = color
  elements.colorPreview.style.background = color
  elements.colorHue.value = String(Math.round(hsv.h))
  elements.colorSaturation.style.setProperty('--picker-hue-color', hsvToHex({
    h: hsv.h,
    s: 1,
    v: 1,
  }))
  elements.colorSaturationHandle.style.left = `${hsv.s * 100}%`
  elements.colorSaturationHandle.style.top = `${(1 - hsv.v) * 100}%`
  elements.colorSaturation.setAttribute('aria-valuetext', color)
  for (const swatch of elements.colorSwatches.querySelectorAll('[data-color]')) {
    swatch.classList.toggle(
      'active',
      swatch.dataset.color?.toLowerCase() === color,
    )
  }
}

export function normalizeHexColor(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`
  return ''
}

function updateSaturationFromPointer(
  elements: ColorPickerElements,
  event: EventLike,
  onChange?: () => void,
) {
  const rect = elements.colorSaturation.getBoundingClientRect()
  const hsv = hexToHsv(elements.color.value)
  setColorValue(elements, hsvToHex({
    h: hsv.h,
    s: clamp01((event.clientX - rect.left) / rect.width),
    v: clamp01(1 - ((event.clientY - rect.top) / rect.height)),
  }), onChange)
}

function hexToHsv(hex: string | undefined): HsvColor {
  const normalized = normalizeHexColor(hex) || '#ff8000'
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
  }
  if (h < 0) h += 360
  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  }
}

function hsvToHex({
  h,
  s,
  v,
}: HsvColor) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const rgb = getRgbPrime(h, c, x).map((value) =>
    Math.round((value + m) * 255))
  const [r = 0, g = 0, b = 0] = rgb
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function getRgbPrime(h: number, c: number, x: number): [number, number, number] {
  if (h < 60) return [c, x, 0]
  if (h < 120) return [x, c, 0]
  if (h < 180) return [0, c, x]
  if (h < 240) return [0, x, c]
  if (h < 300) return [x, 0, c]
  return [c, 0, x]
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0')
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}
