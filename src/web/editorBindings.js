import { handleEditorKeyboard } from './keyboardShortcuts.js'
import { bindColorPicker } from './colorPicker.js'
import {
  LOGICAL_SCALE,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from './constants.js'
import { bindLayoutResizers } from './layoutResizers.js'

export function bindEditorEvents({
  elements,
  runAction,
  actions,
}) {
  elements.openLocalBoardDialog.addEventListener('click', () => openDialog(elements.localBoardDialog))
  elements.openImportDialog.addEventListener('click', () => openDialog(elements.importDialog))
  elements.openExportDialog.addEventListener('click', () => openDialog(elements.exportDialog))
  elements.assetTabBackground.addEventListener('click', () => selectAssetTab(elements, 'background'))
  elements.assetTabObjects.addEventListener('click', () => selectAssetTab(elements, 'objects'))
  bindColorPicker({
    elements,
    onChange: actions.updateSelectedFromInspector,
  })
  elements.loadCode.addEventListener('click', () =>
    runAction(async () => {
      await actions.loadFromCode(elements.codeInput.value)
      elements.importDialog.close()
    }, '已导入战术板', {
      busyMessage: '正在导入战术板...',
    }),
  )
  elements.exportCode.addEventListener('click', () =>
    runAction(actions.exportCode, '已导出战术板代码', {
      busyMessage: '正在导出战术板代码...',
    }),
  )
  elements.renderPreview.addEventListener('click', () =>
    runAction(actions.renderPreview, '已渲染预览图', {
      busyMessage: '正在渲染预览图...',
    }),
  )
  elements.boardName.addEventListener('change', actions.onBoardNameChange)
  elements.localBoardSelect.addEventListener('change', actions.updateLocalBoardButtons)
  elements.saveLocalBoard.addEventListener('click', actions.saveLocalBoard)
  elements.loadLocalBoard.addEventListener('click', actions.loadLocalBoard)
  elements.deleteLocalBoard.addEventListener('click', actions.deleteLocalBoard)
  elements.undo.addEventListener('click', actions.undo)
  elements.redo.addEventListener('click', actions.redo)
  elements.clearBoard.addEventListener('click', actions.clearBoard)
  elements.deleteObject.addEventListener('click', actions.deleteSelected)
  elements.duplicateObject.addEventListener('click', actions.duplicateSelected)
  elements.moveTop.addEventListener('click', () => actions.moveSelectedTo(0))
  elements.moveUp.addEventListener('click', () => actions.moveSelected(-1))
  elements.moveDown.addEventListener('click', () => actions.moveSelected(1))
  elements.moveBottom.addEventListener('click', () =>
    actions.moveSelectedTo(actions.getLastLayerIndex()))
  elements.alignLeft.addEventListener('click', () => actions.alignSelected('left'))
  elements.alignCenterX.addEventListener('click', () => actions.alignSelected('center-x'))
  elements.alignRight.addEventListener('click', () => actions.alignSelected('right'))
  elements.alignTop.addEventListener('click', () => actions.alignSelected('top'))
  elements.alignCenterY.addEventListener('click', () => actions.alignSelected('center-y'))
  elements.alignBottom.addEventListener('click', () => actions.alignSelected('bottom'))
  elements.zoomOut.addEventListener('click', () => actions.stepZoom(-1))
  elements.zoomIn.addEventListener('click', () => actions.stepZoom(1))
  elements.fitStage.addEventListener('click', () => actions.applyFitZoom())
  elements.zoomSelect.addEventListener('change', () => {
    if (elements.zoomSelect.value === 'fit') {
      actions.applyFitZoom()
      return
    }
    actions.setStageZoom(Number(elements.zoomSelect.value), { mode: 'manual' })
  })
  elements.snap.addEventListener('change', actions.toggleSnapToGrid)
  elements.grid.addEventListener('change', actions.toggleGrid)
  bindLayoutResizers({
    elements,
    onResize: actions.applyFitZoomOnResize,
  })
  bindPaletteDrop(elements, actions)
  bindContextMenu(elements, actions)
  window.addEventListener('resize', actions.applyFitZoomOnResize)
  document.addEventListener('keydown', (event) =>
    handleEditorKeyboard(event, {
      applyFitZoom: actions.applyFitZoom,
      copySelected: actions.copySelected,
      deleteSelected: actions.deleteSelected,
      deselect: actions.deselect,
      duplicateSelected: actions.duplicateSelected,
      nudgeSelected: actions.nudgeSelected,
      pasteObject: actions.pasteObject,
      redo: actions.redo,
      stepZoom: actions.stepZoom,
      undo: actions.undo,
    }),
  )
  for (const input of [
    elements.x,
    elements.y,
    elements.size,
    elements.angle,
    elements.transparency,
    elements.text,
    elements.endX,
    elements.endY,
    elements.arc,
    elements.donut,
    elements.hidden,
    elements.locked,
  ]) {
    input.addEventListener('input', actions.updateSelectedFromInspector)
  }
}

function bindPaletteDrop(elements, actions) {
  elements.stageHost.addEventListener('dragover', (event) => {
    if (!Array.from(event.dataTransfer.types).includes('application/x-node-zsb-object-type')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    elements.stageHost.classList.add('drag-target')
  })
  elements.stageHost.addEventListener('dragleave', (event) => {
    if (elements.stageHost.contains(event.relatedTarget)) return
    elements.stageHost.classList.remove('drag-target')
  })
  elements.stageHost.addEventListener('drop', (event) => {
    const type = event.dataTransfer.getData('application/x-node-zsb-object-type')
    if (!type) return
    event.preventDefault()
    elements.stageHost.classList.remove('drag-target')
    const point = getStageDropPoint(elements, event)
    if (!point) return
    actions.addObjectAt(type, point)
  })
}

function getStageDropPoint(elements, event) {
  const canvas = elements.stageHost.querySelector('canvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (
    event.clientX < rect.left
    || event.clientX > rect.right
    || event.clientY < rect.top
    || event.clientY > rect.bottom
  ) return null
  return {
    x: Math.round(((event.clientX - rect.left) / rect.width) * (SCENE_WIDTH / LOGICAL_SCALE)),
    y: Math.round(((event.clientY - rect.top) / rect.height) * (SCENE_HEIGHT / LOGICAL_SCALE)),
  }
}

function bindContextMenu(elements, actions) {
  elements.stageHost.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    openContextMenu(elements, 'canvas', event.clientX, event.clientY)
  })
  elements.layers.addEventListener('contextmenu', (event) => {
    const row = event.target.closest('.layer-row')
    if (!row) return
    event.preventDefault()
    actions.selectObject(Number(row.dataset.index))
    openContextMenu(elements, 'layer', event.clientX, event.clientY)
  })
  elements.contextMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]')
    if (!button) return
    runContextAction(button.dataset.action, actions)
    closeContextMenu(elements)
  })
  document.addEventListener('click', (event) => {
    if (!elements.contextMenu.contains(event.target)) closeContextMenu(elements)
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeContextMenu(elements)
  })
}

function openContextMenu(elements, context, x, y) {
  for (const item of elements.contextMenu.querySelectorAll('[data-context]')) {
    item.classList.toggle('hidden', !item.dataset.context.split(' ').includes(context))
  }
  elements.contextMenu.classList.remove('hidden')
  const { offsetWidth, offsetHeight } = elements.contextMenu
  const left = Math.min(x, window.innerWidth - offsetWidth - 8)
  const top = Math.min(y, window.innerHeight - offsetHeight - 8)
  elements.contextMenu.style.left = `${Math.max(8, left)}px`
  elements.contextMenu.style.top = `${Math.max(8, top)}px`
}

function closeContextMenu(elements) {
  elements.contextMenu.classList.add('hidden')
}

function runContextAction(action, actions) {
  const map = {
    copy: () => actions.copySelected(),
    paste: () => actions.pasteObject(),
    duplicate: () => actions.duplicateSelected(),
    delete: () => actions.deleteSelected(),
    center: () => actions.centerSelected(),
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

function selectAssetTab(elements, tab) {
  const isBackground = tab === 'background'
  elements.assetTabBackground.classList.toggle('active', isBackground)
  elements.assetTabObjects.classList.toggle('active', !isBackground)
  elements.assetTabBackground.setAttribute('aria-selected', String(isBackground))
  elements.assetTabObjects.setAttribute('aria-selected', String(!isBackground))
  elements.assetPanelBackground.classList.toggle('hidden', !isBackground)
  elements.assetPanelObjects.classList.toggle('hidden', isBackground)
}

function openDialog(dialog) {
  if (dialog.open) return
  if (dialog.showModal) {
    dialog.showModal()
    return
  }
  dialog.setAttribute('open', '')
}
