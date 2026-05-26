import { createObjectPreview } from './iconPreview.js'
import type {
  EditorState,
} from './types.js'

declare const document: DocumentLike

interface PalettePanelDeps {
  state: EditorState
  elements: PaletteElements
  onAddObject(type: string): void
}

interface PaletteElements {
  paletteTabs: PaletteContainer
  palette: PaletteContainer
}

interface PaletteContainer {
  innerHTML: string
  append(...nodes: unknown[]): void
  setAttribute(name: string, value: string): void
}

interface PaletteButton {
  draggable: boolean
  id: string
  textContent: string | null
  title: string
  type: string
  classList: {
    toggle(className: string, force?: boolean): void
  }
  append(...nodes: unknown[]): void
  addEventListener(type: 'click', listener: () => void): void
  addEventListener(type: 'dragstart', listener: (event: DragEventLike) => void): void
  setAttribute(name: string, value: string): void
}

interface DragEventLike {
  dataTransfer: {
    effectAllowed: string
    setData(format: string, data: string): void
  }
}

interface DocumentLike {
  createElement(tagName: 'button'): PaletteButton
}

const PALETTE_LABELS: Record<string, string> = {
  rolesAndJobs: '职能',
  mechanics: '机制',
  enemiesAndMarkers: '标记',
  shapes: '形状',
  backgrounds: '地面',
}

const EXTRA_SHAPE_TYPES = [
  'text',
  'line',
  'line_aoe',
  'circle_aoe',
  'fan_aoe',
  'donut',
]

export function renderPaletteTabs({ state, elements, onAddObject }: PalettePanelDeps) {
  elements.paletteTabs.innerHTML = ''
  elements.paletteTabs.setAttribute('role', 'tablist')
  elements.paletteTabs.setAttribute('aria-label', '对象分类')
  for (const key of Object.keys(state.iconGroups)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.id = `palette-tab-${key}`
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-selected', String(key === state.activeGroup))
    button.setAttribute('aria-controls', 'palette')
    button.textContent = PALETTE_LABELS[key] ?? key
    button.classList.toggle('active', key === state.activeGroup)
    button.addEventListener('click', () => {
      state.activeGroup = key
      renderPaletteTabs({ state, elements, onAddObject })
    })
    elements.paletteTabs.append(button)
  }
  renderPalette({ state, elements, onAddObject })
}

function renderPalette({ state, elements, onAddObject }: PalettePanelDeps) {
  elements.palette.innerHTML = ''
  const extras = state.activeGroup === 'shapes' ? EXTRA_SHAPE_TYPES : []
  const types = [...(state.iconGroups[state.activeGroup] ?? []), ...extras]
  for (const type of [...new Set(types)]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.draggable = true
    button.title = type
    button.append(createObjectPreview({
      iconConfigs: state.iconConfigs,
      type,
    }))
    button.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData('application/x-node-zsb-object-type', type)
      event.dataTransfer.setData('text/plain', type)
    })
    button.addEventListener('click', () => onAddObject(type))
    elements.palette.append(button)
  }
}
