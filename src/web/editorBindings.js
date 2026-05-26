import { handleEditorKeyboard } from './keyboardShortcuts.js'

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
  elements.color.addEventListener('input', () => {
    syncColorText(elements)
    actions.updateSelectedFromInspector()
  })
  elements.colorText.addEventListener('input', () => {
    const color = normalizeHexColor(elements.colorText.value)
    if (!color) return
    elements.color.value = color
    syncColorText(elements)
    actions.updateSelectedFromInspector()
  })
  elements.colorSwatches.addEventListener('click', (event) => {
    const button = event.target.closest('[data-color]')
    if (!button) return
    elements.color.value = button.dataset.color
    syncColorText(elements)
    actions.updateSelectedFromInspector()
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
  elements.moveUp.addEventListener('click', () => actions.moveSelected(1))
  elements.moveDown.addEventListener('click', () => actions.moveSelected(-1))
  elements.centerObject.addEventListener('click', actions.centerSelected)
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

function syncColorText(elements) {
  elements.colorText.value = elements.color.value
  for (const swatch of elements.colorSwatches.querySelectorAll('[data-color]')) {
    swatch.classList.toggle(
      'active',
      swatch.dataset.color.toLowerCase() === elements.color.value.toLowerCase(),
    )
  }
}

function normalizeHexColor(value) {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`
  return ''
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
