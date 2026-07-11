import { createObjectPreview } from './iconPreview.js'
import {
  BUILT_IN_OBJECT_TYPES,
  getObjectDisplayName,
  matchesObjectSearch,
} from './objectCatalog.js'
import { loadRecentObjectTypes } from './palettePreferences.js'
import type {
  EditorState,
} from './types.js'

interface PalettePanelDeps {
  state: EditorState
  elements: PaletteElements
  onAddObject(type: string): void
}

interface PaletteElements {
  paletteTabs: PaletteContainer
  palette: PaletteContainer
  paletteSearch: ValueElement
  clearPaletteSearch: HiddenElement
  paletteResultStatus: TextElement
}

interface PaletteContainer {
  innerHTML: string
  append(...nodes: unknown[]): void
  setAttribute(name: string, value: string): void
}

interface ValueElement {
  value: string
}

interface HiddenElement {
  hidden: boolean
}

interface TextElement {
  textContent: string | null
}

const PALETTE_LABELS: Record<string, string> = {
  rolesAndJobs: '职业/特职',
  mechanics: '攻击范围',
  enemiesAndMarkers: '图标/标记',
  shapes: '图形/记号',
  backgrounds: '场地',
  recent: '最近',
}

const BUILT_IN_TYPES_BY_GROUP: Record<string, readonly string[]> = {
  mechanics: BUILT_IN_OBJECT_TYPES.slice(2),
  shapes: BUILT_IN_OBJECT_TYPES.slice(0, 2),
}

export function renderPaletteTabs({ state, elements, onAddObject }: PalettePanelDeps) {
  const recentTypes = getAvailableRecentTypes(state)
  const searching = Boolean(elements.paletteSearch.value.trim())
  const groupKeys = [
    ...(recentTypes.length > 0 ? ['recent'] : []),
    ...Object.keys(state.iconGroups),
  ]
  if (!groupKeys.includes(state.activeGroup)) {
    state.activeGroup = groupKeys[0] ?? 'rolesAndJobs'
  }
  elements.paletteTabs.innerHTML = ''
  elements.paletteTabs.setAttribute('role', 'tablist')
  elements.paletteTabs.setAttribute('aria-label', '对象分类')
  for (const key of groupKeys) {
    const button = document.createElement('button')
    button.type = 'button'
    button.id = `palette-tab-${key}`
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-selected', String(!searching && key === state.activeGroup))
    button.setAttribute('aria-controls', 'palette')
    button.textContent = PALETTE_LABELS[key] ?? key
    button.classList.toggle('active', !searching && key === state.activeGroup)
    button.addEventListener('click', () => {
      state.activeGroup = key
      elements.paletteSearch.value = ''
      renderPaletteTabs({ state, elements, onAddObject })
    })
    elements.paletteTabs.append(button)
  }
  renderPalette({ state, elements, onAddObject })
}

function renderPalette({ state, elements, onAddObject }: PalettePanelDeps) {
  elements.palette.innerHTML = ''
  const query = elements.paletteSearch.value.trim()
  elements.clearPaletteSearch.hidden = !query
  const types = query
    ? getAllPaletteTypes(state).filter((type) => matchesObjectSearch(type, query))
    : state.activeGroup === 'recent'
      ? getAvailableRecentTypes(state)
      : getTypesForGroup(state, state.activeGroup)
  const uniqueTypes = [...new Set(types)]
  elements.paletteResultStatus.textContent = query
    ? `找到 ${uniqueTypes.length} 个对象`
    : `${PALETTE_LABELS[state.activeGroup] ?? state.activeGroup} · ${uniqueTypes.length} 个`
  elements.palette.setAttribute(
    'aria-label',
    query ? `对象搜索结果，共 ${uniqueTypes.length} 个` : `${PALETTE_LABELS[state.activeGroup] ?? state.activeGroup}对象`,
  )
  if (uniqueTypes.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty-state palette-empty'
    empty.textContent = query ? '没有匹配的对象' : '暂无最近使用对象'
    elements.palette.append(empty)
    return
  }
  for (const type of uniqueTypes) {
    const displayName = getObjectDisplayName(type)
    const button = document.createElement('button')
    button.type = 'button'
    button.draggable = true
    button.className = 'palette-item'
    button.dataset.objectType = type
    button.title = `${displayName}（${type}）`
    button.setAttribute('aria-label', displayName)
    button.append(createObjectPreview({
      iconConfigs: state.iconConfigs,
      type,
    }))
    const label = document.createElement('span')
    label.className = 'palette-item-label'
    label.textContent = displayName
    button.append(label)
    button.addEventListener('dragstart', (event) => {
      if (!event.dataTransfer) return
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData('application/x-node-zsb-object-type', type)
      event.dataTransfer.setData('text/plain', type)
    })
    button.addEventListener('click', () => onAddObject(type))
    elements.palette.append(button)
  }
}

function getTypesForGroup(state: EditorState, group: string): string[] {
  return [
    ...(state.iconGroups[group] ?? []),
    ...(BUILT_IN_TYPES_BY_GROUP[group] ?? []),
  ]
}

function getAllPaletteTypes(state: EditorState): string[] {
  return [...new Set(Object.keys(state.iconGroups).flatMap((group) =>
    getTypesForGroup(state, group)))]
}

function getAvailableRecentTypes(state: EditorState): string[] {
  const availableTypes = new Set(getAllPaletteTypes(state))
  return loadRecentObjectTypes().filter((type) => availableTypes.has(type))
}
