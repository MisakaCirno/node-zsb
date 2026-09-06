import type {
  IconConfig,
} from './types.js'
import { toAssetUrl } from './assetUrl.js'
import {
  DEFAULT_AOE_COLOR,
  DEFAULT_DONUT_COLOR,
  DEFAULT_LINE_COLOR,
} from '../shared/boardGeometry.js'

type ShapePreviewTag = 'circle' | 'path' | 'rect'
type ShapePreviewEntry = [ShapePreviewTag, Record<string, string>]

interface ObjectPreviewOptions {
  iconConfigs: Record<string, IconConfig>
  size?: number
  type: string
}

const SHAPE_PREVIEWS: Record<string, ShapePreviewEntry[]> = {
  line: [
    ['path', { d: 'M6 22L22 6', class: 'shape-stroke' }],
  ],
  line_aoe: [
    ['rect', {
      x: '9',
      y: '4',
      width: '10',
      height: '20',
      class: 'shape-fill',
      transform: 'rotate(45 14 14)',
    }],
  ],
  circle_aoe: [
    ['circle', { cx: '14', cy: '14', r: '9', class: 'shape-fill' }],
  ],
  fan_aoe: [
    ['path', { d: 'M14 14L14 4A10 10 0 0 1 23.5 17.2Z', class: 'shape-fill' }],
    ['path', { d: 'M14 14L14 4M14 14L23.5 17.2', class: 'shape-stroke' }],
  ],
  donut: [
    ['path', {
      d: 'M14 3A11 11 0 1 1 14 25A11 11 0 1 1 14 3Z M14 9A5 5 0 1 1 14 19A5 5 0 1 1 14 9Z',
      class: 'shape-fill',
      'fill-rule': 'evenodd',
    }],
  ],
}

export function createObjectPreview({
  iconConfigs,
  size = 28,
  type,
}: ObjectPreviewOptions) {
  const config = iconConfigs[type]
  if (!config) {
    return createFallbackPreview(type, size)
  }

  const preview = document.createElement('span')
  preview.className = 'object-preview'
  preview.setAttribute('aria-hidden', 'true')
  preview.style.width = `${size}px`
  preview.style.height = `${size}px`
  preview.style.backgroundImage = `url("${toAssetUrl(`/assets/objects/${config.src}.webp`)}")`
  const scale = size / config.crop.width
  const spriteWidth = getSpriteWidth(iconConfigs, config.src)
  const spriteHeight = getSpriteHeight(iconConfigs, config.src)
  preview.style.backgroundSize = `${spriteWidth * scale}px ${spriteHeight * scale}px`
  preview.style.backgroundPosition = `${-config.crop.x * scale}px ${-config.crop.y * scale}px`
  return preview
}

function createFallbackPreview(type: string, size: number) {
  const preview = document.createElement('span')
  preview.className = 'object-preview text-swatch'
  preview.style.width = `${size}px`
  preview.style.height = `${size}px`

  if (type === 'text') {
    preview.textContent = 'T'
    return preview
  }

  const shapePreview = SHAPE_PREVIEWS[type]
  if (!shapePreview) {
    preview.textContent = type.slice(0, 2)
    return preview
  }

  preview.classList.add('shape-swatch')
  preview.style.setProperty('--shape-color', type === 'donut'
    ? DEFAULT_DONUT_COLOR
    : type === 'line' || type === 'line_aoe' ? DEFAULT_LINE_COLOR : DEFAULT_AOE_COLOR)
  preview.classList.remove('text-swatch')
  preview.setAttribute('aria-hidden', 'true')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 28 28')
  for (const [tag, attributes] of shapePreview) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value)
    }
    svg.append(node)
  }
  preview.append(svg)
  return preview
}

function getSpriteWidth(iconConfigs: Record<string, IconConfig>, src: string) {
  return Math.max(
    1,
    ...Object.values(iconConfigs)
      .filter((config) => config.src === src)
      .map((config) => config.crop.x + config.crop.width),
  )
}

function getSpriteHeight(iconConfigs: Record<string, IconConfig>, src: string) {
  return Math.max(
    1,
    ...Object.values(iconConfigs)
      .filter((config) => config.src === src)
      .map((config) => config.crop.y + config.crop.height),
  )
}
