import { MAX_BOARD_OBJECTS, MAX_LOCAL_PRESETS } from './constants.js'
import { getBrowserDocument } from './browser.js'
import {
  canSavePresetFromSelection,
  createPresetFromSelection,
  insertPresetIntoBoard,
} from './localPresets.js'
import { getPresetPreviewUrl } from './presetPreviewCache.js'
import { renderPresetPreviewBlob } from './presetPreviewRenderer.js'
import { loadLocalPresets, persistLocalPresets } from './storage.js'
import type {
  EditorState,
  LocalLayerPreset,
} from './types.js'

interface LocalPresetsPanelDeps {
  state: EditorState
  elements: LocalPresetsPanelElements
  recordHistory(): void
  renderAll(): Promise<void>
  showStatus(message: string, options?: { type?: string }): void
  confirmAction(message: string): boolean
}

interface LocalPresetsPanelElements {
  presetList: ListElement
  presetNameDialog: DialogElement
  presetNameInput: InputElement
  presetNameError: TextElement
  savePreset: ButtonElement
}

interface DialogElement {
  returnValue: string
  close(): void
  showModal(): void
  addEventListener(type: string, listener: () => void): void
  querySelector(selector: 'form'): FormElement
}

interface FormElement {
  addEventListener(type: 'submit', listener: (event: SubmitLike) => void): void
}

interface SubmitLike {
  preventDefault(): void
  submitter?: { value?: string } | null
}

interface ListElement {
  innerHTML: string
  append(...nodes: unknown[]): void
}

interface InputElement {
  value: string
  focus(): void
  select(): void
  setAttribute(name: string, value: string): void
  addEventListener(type: string, listener: () => void): void
}

interface TextElement {
  textContent: string | null
}

interface ButtonElement {
  disabled: boolean
}

interface PendingNameRequest {
  resolve(name: string): void
}

const PRESET_DRAG_TYPE = 'application/x-node-zsb-preset-id'
const INSERT_CENTER = {
  x: 256,
  y: 192,
}

export function createLocalPresetsPanel({
  state,
  elements,
  recordHistory,
  renderAll,
  showStatus,
  confirmAction,
}: LocalPresetsPanelDeps) {
  const browserDocument = getBrowserDocument()
  let pendingNameRequest: PendingNameRequest | null = null

  function renderLocalPresets() {
    const presets = loadLocalPresets()
    elements.presetList.innerHTML = ''
    if (presets.length === 0) {
      const empty = browserDocument.createElement('p')
      empty.className = 'empty-state preset-empty'
      empty.textContent = '暂无预设'
      elements.presetList.append(empty)
      updatePresetButtons()
      return
    }
    for (const preset of presets) {
      elements.presetList.append(createPresetCard(preset))
    }
    updatePresetButtons()
  }

  function updatePresetButtons() {
    elements.savePreset.disabled = !canSavePresetFromSelection(state)
  }

  async function saveSelectedPreset() {
    if (!canSavePresetFromSelection(state)) {
      showStatus('请先选择要保存的图层或组', { type: 'error' })
      return false
    }
    const name = await requestPresetName()
    if (!name) return false
    const preset = createPresetFromSelection(state, name)
    if (!preset) return false
    const presets = loadLocalPresets()
    const nextPresets = [preset, ...presets.filter((entry) => entry.id !== preset.id)]
      .slice(0, MAX_LOCAL_PRESETS)
    if (!persistLocalPresets(nextPresets)) {
      showStatus('保存预设失败', { type: 'error' })
      return false
    }
    renderLocalPresets()
    showStatus(`已保存预设 ${preset.name}`)
    return true
  }

  async function insertPresetAt(id: string, point = INSERT_CENTER) {
    const preset = loadLocalPresets().find((entry) => entry.id === id)
    if (!preset) return false
    if (state.board.objects.length + preset.objectCount > MAX_BOARD_OBJECTS) {
      showStatus(`对象数量将超过上限 ${MAX_BOARD_OBJECTS}`, { type: 'error' })
      return false
    }
    recordHistory()
    const result = insertPresetIntoBoard(state, preset, { point })
    if (!result) return false
    await renderAll()
    showStatus(`已插入预设 ${preset.name}`)
    return true
  }

  function deletePreset(id: string) {
    const presets = loadLocalPresets()
    const preset = presets.find((entry) => entry.id === id)
    if (!preset) return false
    if (!confirmAction(`删除预设“${preset.name}”？`)) return false
    if (!persistLocalPresets(presets.filter((entry) => entry.id !== id))) {
      showStatus('删除预设失败', { type: 'error' })
      return false
    }
    renderLocalPresets()
    showStatus('已删除预设')
    return true
  }

  elements.presetNameDialog.querySelector('form').addEventListener('submit', (event) => {
    if (!pendingNameRequest) return
    if (event.submitter?.value === 'cancel') return
    const error = validatePresetName(elements.presetNameInput.value)
    if (!error) return
    event.preventDefault()
    showPresetNameError(error)
  })

  elements.presetNameInput.addEventListener('input', () => {
    if (!pendingNameRequest) return
    showPresetNameError(validatePresetName(elements.presetNameInput.value))
  })

  elements.presetNameDialog.addEventListener('close', () => {
    if (!pendingNameRequest) return
    const name = elements.presetNameDialog.returnValue === 'confirm'
      ? normalizePresetName(elements.presetNameInput.value)
      : ''
    pendingNameRequest.resolve(name)
    pendingNameRequest = null
    showPresetNameError('')
  })

  return {
    deletePreset,
    insertPresetAt,
    renderLocalPresets,
    saveSelectedPreset,
    updatePresetButtons,
  }

  function createPresetCard(preset: LocalLayerPreset) {
    const card = browserDocument.createElement('article')
    card.className = 'preset-card'

    const preview = browserDocument.createElement('button')
    preview.type = 'button'
    preview.className = 'preset-preview'
    preview.draggable = true
    preview.title = `插入 ${preset.name}`
    preview.setAttribute('aria-label', `插入预设 ${preset.name}`)
    preview.addEventListener('click', () => insertPresetAt(preset.id))
    preview.addEventListener('dragstart', (event) => {
      if (!event.dataTransfer) return
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData(PRESET_DRAG_TYPE, preset.id)
      event.dataTransfer.setData('text/plain', preset.name)
    })
    const placeholder = browserDocument.createElement('span')
    placeholder.className = 'preset-preview-placeholder'
    placeholder.textContent = '预览'
    preview.append(placeholder)
    loadPreviewImage(preset, preview)

    const meta = browserDocument.createElement('div')
    meta.className = 'preset-meta'
    const name = browserDocument.createElement('strong')
    name.textContent = preset.name
    const count = browserDocument.createElement('span')
    count.textContent = `${preset.objectCount} 个对象`
    meta.append(name, count)

    const actions = browserDocument.createElement('div')
    actions.className = 'preset-actions'
    const deleteButton = browserDocument.createElement('button')
    deleteButton.type = 'button'
    deleteButton.textContent = '删除'
    deleteButton.className = 'danger-text-button'
    deleteButton.addEventListener('click', () => deletePreset(preset.id))
    actions.append(deleteButton)

    card.append(preview, meta, actions)
    return card
  }

  async function loadPreviewImage(preset: LocalLayerPreset, preview: HTMLElement) {
    try {
      const cacheKey = `${preset.id}:${preset.contentHash}`
      const url = await getPresetPreviewUrl(cacheKey, () =>
        renderPresetPreviewBlob(preset, state.iconConfigs))
      const image = browserDocument.createElement('img')
      image.src = url
      image.alt = ''
      preview.replaceChildren(image)
    } catch (error) {
      console.warn('Failed to render preset preview', error)
    }
  }

  function requestPresetName() {
    return new Promise<string>((resolve) => {
      pendingNameRequest = { resolve }
      elements.presetNameInput.value = createDefaultPresetName()
      showPresetNameError('')
      elements.presetNameDialog.showModal()
      elements.presetNameInput.focus()
      elements.presetNameInput.select()
    })
  }

  function createDefaultPresetName() {
    return state.selectedGroupId
      ? '新预设组'
      : '新预设'
  }

  function validatePresetName(name: unknown) {
    return normalizePresetName(name) ? '' : '请输入预设名称'
  }

  function showPresetNameError(message: string) {
    elements.presetNameError.textContent = message
    elements.presetNameInput.setAttribute('aria-invalid', message ? 'true' : 'false')
  }
}

export function getPresetDragType(): string {
  return PRESET_DRAG_TYPE
}

function normalizePresetName(name: unknown) {
  return String(name ?? '').trim()
}
