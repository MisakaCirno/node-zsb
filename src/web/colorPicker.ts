interface ColorPickerDeps {
  elements: ColorPickerElements
  onChange?: () => void
  onCommit?: () => void
}

export interface ColorPickerElements {
  color: HTMLInputElement
  colorTrigger: HTMLButtonElement
  colorText: HTMLInputElement
  colorHue: HTMLInputElement
  colorPopover: HTMLElement
  colorPreview: HTMLElement
  colorRed: HTMLInputElement
  colorGreen: HTMLInputElement
  colorBlue: HTMLInputElement
  colorSaturation: HTMLElement
  colorSaturationHandle: HTMLElement
}

interface HsvColor {
  h: number
  s: number
  v: number
}

interface SyncColorOptions {
  hsv?: HsvColor
}

const pickerStates = new WeakMap<ColorPickerElements, HsvColor>()

export function bindColorPicker({
  elements,
  onChange,
  onCommit = () => {},
}: ColorPickerDeps) {
  mountColorPopover(elements)
  elements.colorTrigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (elements.colorPopover.classList.contains('hidden')) {
      showColorPopover(elements)
    } else {
      hideColorPopover(elements)
    }
  })
  elements.colorText.addEventListener('input', () => {
    setColorValue(elements, elements.colorText.value, onChange)
  })
  bindTextCommit(elements.colorText, onCommit)
  for (const input of [elements.colorRed, elements.colorGreen, elements.colorBlue]) {
    input.addEventListener('input', () => {
      setColorValue(elements, rgbInputsToHex(elements), onChange)
    })
    bindTextCommit(input, onCommit)
  }
  elements.colorHue.addEventListener('input', () => {
    const hsv = getPickerState(elements)
    const nextHsv = {
      h: Number(elements.colorHue.value),
      s: hsv.s,
      v: hsv.v,
    }
    setColorValue(elements, hsvToHex(nextHsv), onChange, { hsv: nextHsv })
  })
  elements.colorHue.addEventListener('change', onCommit)
  elements.colorHue.addEventListener('pointercancel', onCommit)
  elements.colorHue.addEventListener('pointerup', onCommit)
  elements.colorHue.addEventListener('blur', onCommit)
  elements.colorSaturation.addEventListener('pointerdown', (event) => {
    elements.colorSaturation.setPointerCapture(event.pointerId)
    updateSaturationFromPointer(elements, event, onChange)
  })
  elements.colorSaturation.addEventListener('pointermove', (event) => {
    if (!elements.colorSaturation.hasPointerCapture(event.pointerId)) return
    updateSaturationFromPointer(elements, event, onChange)
  })
  elements.colorSaturation.addEventListener('pointercancel', onCommit)
  elements.colorSaturation.addEventListener('pointerup', onCommit)
  elements.colorSaturation.addEventListener('keydown', (event) => {
    const delta = {
      ArrowUp: { s: 0, v: 0.03 },
      ArrowDown: { s: 0, v: -0.03 },
      ArrowLeft: { s: -0.03, v: 0 },
      ArrowRight: { s: 0.03, v: 0 },
    }[event.key]
    if (!delta) return
    event.preventDefault()
    const hsv = getPickerState(elements)
    const nextHsv = {
      h: hsv.h,
      s: clamp01(hsv.s + delta.s),
      v: clamp01(hsv.v + delta.v),
    }
    setColorValue(elements, hsvToHex(nextHsv), onChange, { hsv: nextHsv })
  })
  elements.colorSaturation.addEventListener('keyup', (event) => {
    if (event.key.startsWith('Arrow')) onCommit()
  })
  document.addEventListener('click', (event) => {
    if (elements.colorPopover.classList.contains('hidden')) return
    if (getClosestHTMLElement(event.target, '.color-control, .color-popover')) return
    hideColorPopover(elements)
  })
  window.addEventListener('resize', () => {
    if (!elements.colorPopover.classList.contains('hidden')) positionColorPopover(elements)
  })
  document.addEventListener('scroll', () => {
    if (!elements.colorPopover.classList.contains('hidden')) positionColorPopover(elements)
  }, true)
  elements.colorPopover.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideColorPopover(elements)
  })
}

function bindTextCommit(input: HTMLInputElement, onCommit: () => void) {
  input.addEventListener('change', onCommit)
  input.addEventListener('blur', onCommit)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') input.blur()
  })
}

export function setColorValue(
  elements: ColorPickerElements,
  value: string | undefined,
  onChange?: () => void,
  options: SyncColorOptions = {},
) {
  const color = normalizeHexColor(value)
  if (!color) return
  elements.color.value = color
  syncColorControl(elements, options)
  onChange?.()
}

export function syncColorControl(elements: ColorPickerElements, options: SyncColorOptions = {}) {
  const color = normalizeHexColor(elements.color.value) || '#FF7F00'
  const hsv = options.hsv ?? getSyncHsv(elements, color)
  pickerStates.set(elements, hsv)
  elements.color.value = color
  elements.colorText.value = color
  elements.colorPreview.style.background = color
  const rgb = hexToRgb(color)
  elements.colorRed.value = String(rgb.r)
  elements.colorGreen.value = String(rgb.g)
  elements.colorBlue.value = String(rgb.b)
  elements.colorHue.value = String(Math.round(normalizeHue(hsv.h)))
  elements.colorSaturation.style.setProperty('--picker-hue-color', hsvToHex({
    h: hsv.h,
    s: 1,
    v: 1,
  }))
  elements.colorSaturationHandle.style.left = `${hsv.s * 100}%`
  elements.colorSaturationHandle.style.top = `${(1 - hsv.v) * 100}%`
  elements.colorSaturation.setAttribute('aria-valuetext', color)
}

export function normalizeHexColor(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`
  return ''
}

function updateSaturationFromPointer(
  elements: ColorPickerElements,
  event: PointerEvent,
  onChange?: () => void,
) {
  const rect = elements.colorSaturation.getBoundingClientRect()
  const hsv = getPickerState(elements)
  const nextHsv = {
    h: hsv.h,
    s: clamp01((event.clientX - rect.left) / rect.width),
    v: clamp01(1 - ((event.clientY - rect.top) / rect.height)),
  }
  setColorValue(elements, hsvToHex(nextHsv), onChange, { hsv: nextHsv })
}

function mountColorPopover(elements: ColorPickerElements) {
  const mount = document.querySelector('#editor-dialog-root') ?? document.body
  if (elements.colorPopover.parentElement !== mount) {
    mount.append(elements.colorPopover)
  }
}

function showColorPopover(elements: ColorPickerElements) {
  elements.colorPopover.classList.remove('hidden')
  positionColorPopover(elements)
}

function hideColorPopover(elements: ColorPickerElements) {
  elements.colorPopover.classList.add('hidden')
}

function positionColorPopover(elements: ColorPickerElements) {
  const triggerRect = elements.colorTrigger.getBoundingClientRect()
  const popoverRect = elements.colorPopover.getBoundingClientRect()
  const gap = 8
  const margin = 8
  const width = popoverRect.width
  const height = popoverRect.height
  const left = clampNumber(
    triggerRect.right - width,
    margin,
    window.innerWidth - width - margin,
  )
  const belowTop = triggerRect.bottom + gap
  const aboveTop = triggerRect.top - height - gap
  const top = belowTop + height <= window.innerHeight - margin
    ? belowTop
    : Math.max(margin, aboveTop)
  elements.colorPopover.style.left = `${Math.round(left)}px`
  elements.colorPopover.style.top = `${Math.round(top)}px`
}

function hexToHsv(hex: string | undefined): HsvColor {
  const normalized = normalizeHexColor(hex) || '#FF7F00'
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

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function rgbInputsToHex(elements: ColorPickerElements) {
  const channels = [
    Number(elements.colorRed.value),
    Number(elements.colorGreen.value),
    Number(elements.colorBlue.value),
  ]
  if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) return ''
  const [r = 0, g = 0, b = 0] = channels
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hsvToHex({
  h,
  s,
  v,
}: HsvColor) {
  h = normalizeHue(h)
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

function getPickerState(elements: ColorPickerElements) {
  return pickerStates.get(elements) ?? hexToHsv(elements.color.value)
}

function getSyncHsv(elements: ColorPickerElements, color: string) {
  const state = pickerStates.get(elements)
  if (state && hsvToHex(state) === color) return state
  return hexToHsv(color)
}

function normalizeHue(value: number) {
  if (!Number.isFinite(value)) return 0
  if (value === 360) return 360
  const hue = value % 360
  return hue < 0 ? hue + 360 : hue
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getClosestHTMLElement(target: EventTarget | null, selector: string): HTMLElement | null {
  const element = target instanceof Element ? target.closest(selector) : null
  return element instanceof HTMLElement ? element : null
}
