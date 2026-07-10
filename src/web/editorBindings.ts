import { handleEditorKeyboard } from './keyboardShortcuts.js'
import { bindColorPicker } from './colorPicker.js'
import {
  LOGICAL_SCALE,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from './constants.js'
import { bindLayoutResizers } from './layoutResizers.js'
import { bindAdaptiveSidebarTabs } from './sidebarTabLayout.js'
import { bindMenuBar } from './menuBar.js'
import { normalizeCoordinate } from './geometry.js'
import { getPresetDragType } from './localPresetsPanel.js'
import { bindTextInput } from './textInputControl.js'
import type {
  EditorActionRegistry,
} from './types.js'
import type {
  EditorElements,
} from './editorElements.js'

interface EditorBindingsDeps {
  elements: EditorElements
  runAction: RunAction
  actions: EditorActionRegistry
}

type RunAction = (
  action: () => unknown | Promise<unknown>,
  successMessage?: string,
  options?: { busyMessage?: string },
) => Promise<void> | void

interface Point {
  x: number
  y: number
}

export function bindEditorEvents({
  elements,
  runAction,
  actions,
}: EditorBindingsDeps) {
  bindMenuBar()
  syncDocumentNameCounters(elements)
  elements.openLocalBoardDialog.addEventListener('click', () => {
    actions.renderLocalBoards()
    openDialog(elements.localBoardDialog)
  })
  elements.manageLocalBoards.addEventListener('click', () => {
    actions.renderLocalBoards()
    openDialog(elements.localBoardDialog)
  })
  elements.openImportDialog.addEventListener('click', () => openImportDialog(elements))
  elements.quickOpenImportDialog.addEventListener('click', () => openImportDialog(elements))
  elements.importProjectFile.addEventListener('click', () => {
    elements.projectFileInput.value = ''
    elements.projectFileInput.click()
  })
  elements.projectFileInput.addEventListener('change', () => {
    const file = elements.projectFileInput.files?.[0]
    if (!file) return
    runAction(async () => {
      await actions.importProjectFile(file)
    }, '已导入工程文件', {
      busyMessage: '正在导入工程文件...',
    })
  })
  elements.openExportCodeDialog.addEventListener('click', () =>
    runAction(async () => {
      await actions.exportCode()
      openDialog(elements.exportCodeDialog)
    }, '已生成分享码', {
      busyMessage: '正在生成分享码...',
    }))
  elements.quickOpenExportCodeDialog.addEventListener('click', () =>
    runAction(async () => {
      await actions.exportCode()
      openDialog(elements.exportCodeDialog)
    }, '已生成分享码', {
      busyMessage: '正在生成分享码...',
    }))
  elements.exportProjectFile.addEventListener('click', actions.downloadProjectFile)
  elements.openExportImageDialog.addEventListener('click', () =>
    runAction(async () => {
      await actions.renderPreview()
      openDialog(elements.exportImageDialog)
    }, '已生成预览图', {
      busyMessage: '正在生成预览图...',
    }))
  elements.quickOpenExportImageDialog.addEventListener('click', () =>
    runAction(async () => {
      await actions.renderPreview()
      openDialog(elements.exportImageDialog)
    }, '已生成预览图', {
      busyMessage: '正在生成预览图...',
    }))
  elements.assetTabBackground.addEventListener('click', () => selectAssetTab(elements, 'background'))
  elements.assetTabObjects.addEventListener('click', () => selectAssetTab(elements, 'objects'))
  elements.assetTabPresets.addEventListener('click', () => {
    selectAssetTab(elements, 'presets')
    actions.renderLocalPresets()
  })
  bindColorPicker({
    elements,
    onChange: () => actions.updateSelectedFromInspector({ continuous: true }),
    onCommit: actions.finishInspectorEdit,
  })
  elements.loadCode.addEventListener('click', () =>
    runAction(async () => {
      await actions.loadFromCode(elements.codeInput.value)
      elements.importDialog.close()
    }, '已导入战术板', {
      busyMessage: '正在导入战术板...',
    }),
  )
  elements.copyExportCode.addEventListener('click', () =>
    runAction(actions.copyExportCode, '已复制分享码'))
  elements.copyExportImage.addEventListener('click', () =>
    runAction(actions.copyExportImage, '已复制图片'))
  elements.downloadPreviewImage.addEventListener('click', actions.downloadPreviewImage)
  elements.boardName.addEventListener('change', actions.onBoardNameChange)
  elements.boardName.addEventListener('input', () =>
    syncNameCounter(elements.boardName, elements.shareNameCount))
  elements.fileName.addEventListener('input', actions.onFileNameInput)
  elements.newLocalBoard.addEventListener('click', actions.newLocalBoard)
  elements.saveLocalBoard.addEventListener('click', actions.saveLocalBoard)
  elements.saveAsLocalBoard.addEventListener('click', actions.saveLocalBoardAs)
  elements.quickSaveLocalBoard.addEventListener('click', actions.saveLocalBoard)
  elements.quickSaveAsLocalBoard.addEventListener('click', actions.saveLocalBoardAs)
  elements.undo.addEventListener('click', actions.undo)
  elements.menuUndo.addEventListener('click', actions.undo)
  elements.redo.addEventListener('click', actions.redo)
  elements.menuRedo.addEventListener('click', actions.redo)
  elements.clearBoard.addEventListener('click', actions.clearBoard)
  elements.menuClearBoard.addEventListener('click', actions.clearBoard)
  elements.deleteObject.addEventListener('click', actions.deleteSelected)
  elements.menuDeleteObject.addEventListener('click', actions.deleteSelected)
  elements.copyObject.addEventListener('click', actions.copySelected)
  elements.menuCopyObject.addEventListener('click', actions.copySelected)
  elements.duplicateObject.addEventListener('click', actions.duplicateSelected)
  elements.menuDuplicateObject.addEventListener('click', actions.duplicateSelected)
  elements.pasteObject.addEventListener('click', actions.pasteObject)
  elements.menuPasteObject.addEventListener('click', actions.pasteObject)
  elements.moveTop.addEventListener('click', () => actions.moveSelectedTo(0))
  elements.moveUp.addEventListener('click', () => actions.moveSelected(-1))
  elements.moveDown.addEventListener('click', () => actions.moveSelected(1))
  elements.moveBottom.addEventListener('click', () =>
    actions.moveSelectedTo(actions.getLastLayerIndex()))
  elements.groupLayers.addEventListener('click', actions.groupSelected)
  elements.ungroupLayers.addEventListener('click', actions.ungroupSelectedGroup)
  elements.savePreset.addEventListener('click', actions.saveSelectedPreset)
  elements.savePresetFromLayers.addEventListener('click', actions.saveSelectedPreset)
  elements.toolGroupLayers.addEventListener('click', actions.groupSelected)
  elements.toolUngroupLayers.addEventListener('click', actions.ungroupSelectedGroup)
  elements.toolSavePreset.addEventListener('click', actions.saveSelectedPreset)
  elements.alignLeft.addEventListener('click', () => actions.alignSelected('left'))
  elements.alignCenterX.addEventListener('click', () => actions.alignSelected('center-x'))
  elements.alignRight.addEventListener('click', () => actions.alignSelected('right'))
  elements.alignTop.addEventListener('click', () => actions.alignSelected('top'))
  elements.alignCenterY.addEventListener('click', () => actions.alignSelected('center-y'))
  elements.alignBottom.addEventListener('click', () => actions.alignSelected('bottom'))
  elements.zoomOut.addEventListener('click', () => actions.stepZoom(-1))
  elements.zoomIn.addEventListener('click', () => actions.stepZoom(1))
  elements.fitStage.addEventListener('click', () => actions.applyFitZoom())
  elements.zoomSelect.addEventListener('input', () => {
    actions.setStageZoom(Number(elements.zoomSelect.value), { mode: 'manual' })
  })
  elements.gridDensity.addEventListener('input', () => {
    actions.setGridDensity(Number(elements.gridDensity.value))
  })
  elements.gridOpacity.addEventListener('input', () => {
    actions.setGridOpacity(Number(elements.gridOpacity.value))
  })
  elements.snap.addEventListener('change', actions.toggleSnapToGrid)
  elements.grid.addEventListener('change', actions.toggleGrid)
  bindLayoutResizers({
    elements,
    onResize: actions.applyFitZoomOnResize,
  })
  bindAdaptiveSidebarTabs({ elements })
  bindPaletteDrop(elements, actions)
  bindContextMenu(elements, actions)
  window.addEventListener('resize', actions.applyFitZoomOnResize)
  document.addEventListener('keydown', (event: KeyboardEvent) =>
    handleEditorKeyboard(event, {
      applyFitZoom: actions.applyFitZoom,
      copySelected: actions.copySelected,
      deleteSelected: actions.deleteSelected,
      deselect: actions.deselect,
      duplicateSelected: actions.duplicateSelected,
      nudgeSelected: actions.nudgeSelected,
      pasteObject: actions.pasteObject,
      redo: actions.redo,
      saveLocalBoard: actions.saveLocalBoard,
      saveLocalBoardAs: actions.saveLocalBoardAs,
      stepZoom: actions.stepZoom,
      undo: actions.undo,
    }),
  )
  const updateInspectorContinuously = () =>
    actions.updateSelectedFromInspector({ continuous: true })
  for (const input of [
    elements.x,
    elements.y,
    elements.endX,
    elements.endY,
  ]) {
    bindContinuousValueInput(
      input,
      updateInspectorContinuously,
      actions.finishInspectorEdit,
    )
  }
  for (const input of [elements.hidden, elements.locked]) {
    input.addEventListener('input', () => actions.updateSelectedFromInspector())
  }
  bindTextInput(elements, updateInspectorContinuously, actions.finishInspectorEdit)
  bindSyncedSlider(elements.size, elements.sizeRange, updateInspectorContinuously, actions.finishInspectorEdit)
  bindSyncedSlider(elements.angle, elements.angleRange, updateInspectorContinuously, actions.finishInspectorEdit)
  bindSyncedSlider(elements.transparency, elements.transparencyRange, updateInspectorContinuously, actions.finishInspectorEdit)
  bindSyncedSlider(elements.objectWidth, elements.objectWidthRange, updateInspectorContinuously, actions.finishInspectorEdit)
  bindSyncedSlider(elements.objectHeight, elements.objectHeightRange, updateInspectorContinuously, actions.finishInspectorEdit)
  bindSyncedSlider(elements.arc, elements.arcRange, updateInspectorContinuously, actions.finishInspectorEdit)
  bindSyncedSlider(elements.donut, elements.donutRange, updateInspectorContinuously, actions.finishInspectorEdit)
}

function bindContinuousValueInput(
  input: HTMLInputElement,
  onChange: () => void,
  onCommit: () => void,
) {
  input.addEventListener('input', onChange)
  input.addEventListener('change', onCommit)
  input.addEventListener('blur', onCommit)
  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') input.blur()
  })
}

function bindSyncedSlider(
  numberInput: HTMLInputElement,
  rangeInput: HTMLInputElement,
  onChange: () => void,
  onCommit: () => void,
) {
  numberInput.addEventListener('input', () => {
    const value = getNumericInputValue(numberInput)
    if (value === undefined) return
    rangeInput.value = clampNumericValue(numberInput, value)
    if (value !== rangeInput.value) return
    onChange()
  })
  numberInput.addEventListener('change', () => {
    const value = getNumericInputValue(numberInput)
    if (value === undefined) return
    const clamped = clampNumericValue(numberInput, value)
    numberInput.value = clamped
    rangeInput.value = clamped
    onChange()
    onCommit()
  })
  numberInput.addEventListener('blur', onCommit)
  numberInput.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') numberInput.blur()
  })
  rangeInput.addEventListener('input', () => {
    numberInput.value = rangeInput.value
    onChange()
  })
  rangeInput.addEventListener('change', () => {
    const valueChangedWithoutInput = numberInput.value !== rangeInput.value
    numberInput.value = rangeInput.value
    if (valueChangedWithoutInput) onChange()
    onCommit()
  })
  rangeInput.addEventListener('pointercancel', onCommit)
  rangeInput.addEventListener('pointerup', onCommit)
  rangeInput.addEventListener('blur', onCommit)
}

function getNumericInputValue(input: HTMLInputElement): string | undefined {
  const raw = input.value.trim()
  if (raw === '' || raw === '-') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value)) return undefined
  return String(value)
}

function clampNumericValue(input: HTMLInputElement, raw: string): string {
  const value = Number(raw)
  const min = Number(input.min)
  const max = Number(input.max)
  const lower = Number.isFinite(min) ? min : -Infinity
  const upper = Number.isFinite(max) ? max : Infinity
  const clamped = Math.min(upper, Math.max(lower, value))
  return String(clamped)
}

function bindPaletteDrop(elements: EditorElements, actions: EditorActionRegistry) {
  const presetDragType = getPresetDragType()
  elements.stageHost.addEventListener('dragover', (event: DragEvent) => {
    if (!event.dataTransfer) return
    const types = Array.from(event.dataTransfer.types)
    if (
      !types.includes('application/x-node-zsb-object-type')
      && !types.includes(presetDragType)
    ) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    elements.stageHost.classList.add('drag-target')
  })
  elements.stageHost.addEventListener('dragleave', (event: DragEvent) => {
    if (event.relatedTarget instanceof Node && elements.stageHost.contains(event.relatedTarget)) return
    elements.stageHost.classList.remove('drag-target')
  })
  elements.stageHost.addEventListener('drop', (event: DragEvent) => {
    if (!event.dataTransfer) return
    const type = event.dataTransfer.getData('application/x-node-zsb-object-type')
    const presetId = event.dataTransfer.getData(presetDragType)
    if (!type && !presetId) return
    event.preventDefault()
    elements.stageHost.classList.remove('drag-target')
    const point = getStageDropPoint(elements, event)
    if (!point) return
    if (presetId) {
      actions.insertPresetAt(presetId, point)
      return
    }
    actions.addObjectAt(type, point)
  })
}

function getStageDropPoint(elements: EditorElements, event: DragEvent): Point | null {
  const canvas = elements.stageHost.querySelector('canvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return {
    x: normalizeCoordinate(((event.clientX - rect.left) / rect.width) * (SCENE_WIDTH / LOGICAL_SCALE), 0, 512),
    y: normalizeCoordinate(((event.clientY - rect.top) / rect.height) * (SCENE_HEIGHT / LOGICAL_SCALE), 0, 384),
  }
}

function bindContextMenu(elements: EditorElements, actions: EditorActionRegistry) {
  elements.stageHost.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault()
    openContextMenu(elements, 'canvas', event.clientX, event.clientY)
  })
  elements.layers.addEventListener('contextmenu', (event: MouseEvent) => {
    const row = getClosestElement(event.target, '.layer-row')
    if (!row) return
    event.preventDefault()
    if (row.dataset.groupId) {
      actions.selectLayerGroup(row.dataset.groupId)
      closeContextMenu(elements)
      return
    }
    if (!row.dataset.index) return
    actions.selectObject(Number(row.dataset.index))
    openContextMenu(elements, 'layer', event.clientX, event.clientY)
  })
  elements.contextMenu.addEventListener('click', (event: MouseEvent) => {
    const button = getClosestElement(event.target, '[data-action]')
    if (!button) return
    if (button.dataset.action) runContextAction(button.dataset.action, actions)
    closeContextMenu(elements)
  })
  document.addEventListener('click', (event: MouseEvent) => {
    if (event.target instanceof Node && !elements.contextMenu.contains(event.target)) closeContextMenu(elements)
  })
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeContextMenu(elements)
  })
}

function openContextMenu(elements: EditorElements, context: 'canvas' | 'layer', x: number, y: number) {
  for (const item of elements.contextMenu.querySelectorAll('[data-context]')) {
    const contexts = item instanceof HTMLElement ? item.dataset.context : undefined
    item.classList.toggle('hidden', !contexts?.split(' ').includes(context))
  }
  elements.contextMenu.classList.remove('hidden')
  const { offsetWidth, offsetHeight } = elements.contextMenu
  const left = Math.min(x, window.innerWidth - offsetWidth - 8)
  const top = Math.min(y, window.innerHeight - offsetHeight - 8)
  elements.contextMenu.style.left = `${Math.max(8, left)}px`
  elements.contextMenu.style.top = `${Math.max(8, top)}px`
}

function closeContextMenu(elements: EditorElements) {
  elements.contextMenu.classList.add('hidden')
}

function runContextAction(action: string, actions: EditorActionRegistry) {
  const map: Record<string, () => void> = {
    copy: () => actions.copySelected(),
    paste: () => actions.pasteObject(),
    duplicate: () => actions.duplicateSelected(),
    delete: () => actions.deleteSelected(),
    'align-left': () => actions.alignSelected('left'),
    'align-center-x': () => actions.alignSelected('center-x'),
    'align-right': () => actions.alignSelected('right'),
    'align-top': () => actions.alignSelected('top'),
    'align-center-y': () => actions.alignSelected('center-y'),
    'align-bottom': () => actions.alignSelected('bottom'),
    'move-up': () => actions.moveSelected(-1),
    'move-down': () => actions.moveSelected(1),
    'toggle-hidden': () => actions.toggleLayerFlagForSelection('hidden'),
    'toggle-locked': () => actions.toggleLayerFlagForSelection('locked'),
  }
  map[action]?.()
}

function selectAssetTab(elements: EditorElements, tab: 'background' | 'objects' | 'presets') {
  const tabMap = {
    background: {
      panel: elements.assetPanelBackground,
      tab: elements.assetTabBackground,
    },
    objects: {
      panel: elements.assetPanelObjects,
      tab: elements.assetTabObjects,
    },
    presets: {
      panel: elements.assetPanelPresets,
      tab: elements.assetTabPresets,
    },
  }
  for (const [key, entry] of Object.entries(tabMap)) {
    const active = key === tab
    entry.tab.classList.toggle('active', active)
    entry.tab.setAttribute('aria-selected', String(active))
    entry.panel.classList.toggle('hidden', !active)
  }
}

function openDialog(dialog: HTMLDialogElement) {
  if (dialog.open) return
  dialog.showModal()
}

function openImportDialog(elements: EditorElements) {
  elements.codeInput.value = ''
  openDialog(elements.importDialog)
  elements.codeInput.focus()
}

function syncDocumentNameCounters(elements: EditorElements) {
  syncNameCounter(elements.fileName, elements.fileNameCount)
  syncNameCounter(elements.boardName, elements.shareNameCount)
}

function syncNameCounter(input: HTMLInputElement, output: HTMLOutputElement) {
  const maxLength = input.maxLength > 0 ? input.maxLength : input.value.length
  output.textContent = `${input.value.length}/${maxLength}`
}

function getClosestElement(target: EventTarget | null, selector: string): HTMLElement | null {
  return target instanceof Element ? target.closest(selector) : null
}
