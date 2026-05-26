import { getObjectCapabilities } from './board.js'
import { getSelectedIndexes } from './editorState.js'
import { numberValue } from './geometry.js'
import { renderInspector as renderInspectorPanel } from './inspectorPanel.js'

export function createInspectorControls({
  state,
  elements,
  getSelected,
  normalizePoint,
  recordHistory,
  renderAll,
}) {
  function renderInspector() {
    renderInspectorPanel({
      object: getSelected(),
      elements,
      updateSelectionActions,
    })
  }

  function updateSelectedFromInspector() {
    const object = getSelected()
    if (!object) return
    const capabilities = getObjectCapabilities(object.type)
    recordHistory()
    const point = normalizePoint(numberValue(elements.x, 0, 512), numberValue(elements.y, 0, 384))
    object.x = point.x
    object.y = point.y
    object.size = numberValue(elements.size, 10, 300)
    object.angle = numberValue(elements.angle, 0, 360)
    object.color = capabilities.appearance ? elements.color.value : undefined
    object.transparency = capabilities.appearance
      ? numberValue(elements.transparency, 0, 100)
      : undefined
    object.text = capabilities.text ? elements.text.value || undefined : undefined
    object.endX = capabilities.line ? numberValue(elements.endX, 0, 512) : undefined
    object.endY = capabilities.line ? numberValue(elements.endY, 0, 384) : undefined
    object.arcAngle = capabilities.arcAngle ? numberValue(elements.arc, 10, 360) : undefined
    object.donutRadius = capabilities.donutRadius
      ? numberValue(elements.donut, 0, 240)
      : undefined
    object.hidden = elements.hidden.checked || undefined
    object.locked = elements.locked.checked || undefined
    renderAll()
  }

  function updateSelectionActions() {
    const object = getSelected()
    const hasSelection = Boolean(object)
    const selectedIndexes = getSelectedIndexes(state)
    const hasMovableSelection = selectedIndexes
      .some((index) => !state.board.objects[index]?.locked)
    elements.clearBoard.disabled = state.board.objects.length === 0
    elements.deleteObject.disabled = !hasSelection
    elements.duplicateObject.disabled = !hasSelection
    elements.moveTop.disabled = !hasSelection || state.selectedIndex <= 0
    elements.moveUp.disabled = !hasSelection || state.selectedIndex <= 0
    elements.moveDown.disabled =
      !hasSelection || state.selectedIndex >= state.board.objects.length - 1
    elements.moveBottom.disabled =
      !hasSelection || state.selectedIndex >= state.board.objects.length - 1
    for (const button of [
      elements.alignLeft,
      elements.alignCenterX,
      elements.alignRight,
      elements.alignTop,
      elements.alignCenterY,
      elements.alignBottom,
    ]) {
      button.disabled = !hasSelection || !hasMovableSelection
    }
  }

  return {
    renderInspector,
    updateSelectedFromInspector,
    updateSelectionActions,
  }
}
