export function bindColorPicker({
  elements,
  onChange,
}) {
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

export function setColorValue(elements, value, onChange) {
  const color = normalizeHexColor(value)
  if (!color) return
  elements.color.value = color
  syncColorControl(elements)
  onChange?.()
}

export function syncColorControl(elements) {
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
      swatch.dataset.color.toLowerCase() === color,
    )
  }
}

export function normalizeHexColor(value) {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`
  return ''
}

function updateSaturationFromPointer(elements, event, onChange) {
  const rect = elements.colorSaturation.getBoundingClientRect()
  const hsv = hexToHsv(elements.color.value)
  setColorValue(elements, hsvToHex({
    h: hsv.h,
    s: clamp01((event.clientX - rect.left) / rect.width),
    v: clamp01(1 - ((event.clientY - rect.top) / rect.height)),
  }), onChange)
}

function hexToHsv(hex) {
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
}) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] = getRgbPrime(h, c, x).map((value) =>
    Math.round((value + m) * 255))
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function getRgbPrime(h, c, x) {
  if (h < 60) return [c, x, 0]
  if (h < 120) return [x, c, 0]
  if (h < 180) return [0, c, x]
  if (h < 240) return [0, x, c]
  if (h < 300) return [x, 0, c]
  return [c, 0, x]
}

function toHex(value) {
  return value.toString(16).padStart(2, '0')
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}
