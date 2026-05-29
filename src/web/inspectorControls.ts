import { getObjectCapabilities } from './board.js'
import { getSelectedIndexes } from './editorState.js'
import { numberValue } from './geometry.js'
import { renderInspector as renderInspectorPanel } from './inspectorPanel.js'
import {
  MAX_GAME_OBJECT_SIZE,
  MIN_GAME_OBJECT_SIZE,
} from '../shared/boardGeometry.js'
import type {
  InspectorPanelElements,
} from './inspectorPanel.js'
import type {
  BoardObject,
  CheckedElement,
  DisabledElement,
  EditorContext,
  EditorState,
  InspectorControls,
  ValueElement,
} from './types.js'

interface InspectorElements extends InspectorPanelElements {
  x: ValueElement & DisabledElement
  y: ValueElement & DisabledElement
  size: ValueElement & DisabledElement
  angle: ValueElement & DisabledElement
  transparency: ValueElement
  objectWidth: ValueElement & DisabledElement
  objectHeight: ValueElement & DisabledElement
  endX: ValueElement & DisabledElement
  endY: ValueElement & DisabledElement
  arc: ValueElement & DisabledElement
  donut: ValueElement & DisabledElement
  clearBoard: DisabledElement
  menuClearBoard: DisabledElement
  copyObject: DisabledElement
  menuCopyObject: DisabledElement
  deleteObject: DisabledElement
  menuDeleteObject: DisabledElement
  duplicateObject: DisabledElement
  menuDuplicateObject: DisabledElement
  pasteObject: DisabledElement
  menuPasteObject: DisabledElement
  moveTop: DisabledElement
  moveUp: DisabledElement
  moveDown: DisabledElement
  moveBottom: DisabledElement
  groupLayers: DisabledElement
  ungroupLayers: DisabledElement
  savePreset: DisabledElement
  savePresetFromLayers: DisabledElement
  toolGroupLayers: DisabledElement
  toolUngroupLayers: DisabledElement
  alignLeft: DisabledElement
  alignCenterX: DisabledElement
  alignRight: DisabledElement
  alignTop: DisabledElement
  alignCenterY: DisabledElement
  alignBottom: DisabledElement
}

interface InspectorControlsDeps {
  state: EditorState
  elements: InspectorElements
  getSelected: () => BoardObject | undefined
  normalizePoint: EditorContext['normalizePoint']
  recordHistory: () => void
  renderAll: () => void
}

export function createInspectorControls({
  state,
  elements,
  getSelected,
  normalizePoint,
  recordHistory,
  renderAll,
}: InspectorControlsDeps): InspectorControls {
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
    object.size = object.type === 'text'
      ? 100
      : numberValue(elements.size, MIN_GAME_OBJECT_SIZE, MAX_GAME_OBJECT_SIZE)
    object.angle = ['line', 'text'].includes(object.type)
      ? undefined
      : numberValue(elements.angle, 0, 360)
    object.color = capabilities.appearance ? elements.color.value : undefined
    object.transparency = capabilities.appearance
      ? numberValue(elements.transparency, 0, 100)
      : undefined
    object.text = capabilities.text ? elements.text.value || undefined : undefined
    object.width = capabilities.dimensions
      ? numberValue(elements.objectWidth, 16, 512)
      : undefined
    object.height = capabilities.dimensions
      ? numberValue(elements.objectHeight, 16, 512)
      : undefined
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
    elements.menuClearBoard.disabled = state.board.objects.length === 0
    elements.copyObject.disabled = !hasSelection
    elements.menuCopyObject.disabled = !hasSelection
    elements.deleteObject.disabled = !hasSelection
    elements.menuDeleteObject.disabled = !hasSelection
    elements.duplicateObject.disabled = !hasSelection
    elements.menuDuplicateObject.disabled = !hasSelection
    elements.pasteObject.disabled = !state.clipboard
    elements.menuPasteObject.disabled = !state.clipboard
    elements.moveTop.disabled = !hasSelection || state.selectedIndex <= 0
    elements.moveUp.disabled = !hasSelection || state.selectedIndex <= 0
    elements.moveDown.disabled =
      !hasSelection || state.selectedIndex >= state.board.objects.length - 1
    elements.moveBottom.disabled =
      !hasSelection || state.selectedIndex >= state.board.objects.length - 1
    const canGroupSelection = selectedIndexes.length >= 2
    const canUngroupSelection = Boolean(state.selectedGroupId)
    const canSavePreset = selectedIndexes.length > 0 || Boolean(state.selectedGroupId)
    elements.groupLayers.disabled = !canGroupSelection
    elements.toolGroupLayers.disabled = !canGroupSelection
    elements.ungroupLayers.disabled = !canUngroupSelection
    elements.toolUngroupLayers.disabled = !canUngroupSelection
    elements.savePreset.disabled = !canSavePreset
    elements.savePresetFromLayers.disabled = !canSavePreset
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
