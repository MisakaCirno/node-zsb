const FALLBACK_LABELS = {
  text: 'T',
  line: 'Ln',
  line_aoe: 'LA',
  circle_aoe: 'CA',
  fan_aoe: 'FA',
  donut: 'Dn',
}

export function createObjectPreview({
  iconConfigs,
  size = 28,
  type,
}) {
  const config = iconConfigs[type]
  if (!config) {
    const span = document.createElement('span')
    span.className = 'object-preview text-swatch'
    span.textContent = FALLBACK_LABELS[type] ?? type.slice(0, 2)
    return span
  }

  const preview = document.createElement('span')
  preview.className = 'object-preview'
  preview.setAttribute('aria-hidden', 'true')
  preview.style.width = `${size}px`
  preview.style.height = `${size}px`
  preview.style.backgroundImage = `url("/assets/objects/${config.src}.webp")`
  const scale = size / config.crop.width
  const spriteWidth = getSpriteWidth(iconConfigs, config.src)
  const spriteHeight = getSpriteHeight(iconConfigs, config.src)
  preview.style.backgroundSize = `${spriteWidth * scale}px ${spriteHeight * scale}px`
  preview.style.backgroundPosition = `${-config.crop.x * scale}px ${-config.crop.y * scale}px`
  return preview
}

function getSpriteWidth(iconConfigs, src) {
  return Math.max(
    1,
    ...Object.values(iconConfigs)
      .filter((config) => config.src === src)
      .map((config) => config.crop.x + config.crop.width),
  )
}

function getSpriteHeight(iconConfigs, src) {
  return Math.max(
    1,
    ...Object.values(iconConfigs)
      .filter((config) => config.src === src)
      .map((config) => config.crop.y + config.crop.height),
  )
}
