import { getObjectCapabilities } from './board.js'
import { syncColorControl } from './colorPicker.js'
import type {
  BoardObject,
  CheckedElement,
  DisabledElement,
  ValueElement,
} from './types.js'

export interface RenderInspectorDeps {
  object?: BoardObject
  elements: InspectorPanelElements
  updateSelectionActions(): void
}

export interface InspectorPanelElements {
  emptyState: ClassListElement
  inspector: QueryElement
  type: ValueElement
  x: ValueElement & DisabledElement
  y: ValueElement & DisabledElement
  size: ValueElement & DisabledElement
  angle: ValueElement & DisabledElement
  color: ValueElement
  transparency: ValueElement
  transparencyRange: ValueElement
  text: ValueElement
  endX: ValueElement & DisabledElement
  endY: ValueElement & DisabledElement
  arc: ValueElement & DisabledElement
  arcRange: ValueElement & DisabledElement
  donut: ValueElement & DisabledElement
  donutRange: ValueElement & DisabledElement
  hidden: CheckedElement & ClosestElement
  locked: CheckedElement & ClosestElement
}

interface ClassListElement {
  classList: {
    toggle(className: string, force?: boolean): void
  }
}

interface QueryElement extends ClassListElement {
  querySelector(selector: string): ClassListElement | null
}

interface ClosestElement {
  closest(selector: string): (ClassListElement & {
    setAttribute(name: string, value: string): void
  }) | null
}

export function renderInspector({
  object,
  elements,
  updateSelectionActions,
}: RenderInspectorDeps) {
  elements.emptyState.classList.toggle('hidden', Boolean(object))
  elements.inspector.classList.toggle('hidden', !object)
  updateSelectionActions()
  if (!object) return
  updateInspectorVisibility(object, elements)
  elements.type.value = object.type
  elements.x.value = String(object.x ?? 256)
  elements.y.value = String(object.y ?? 192)
  elements.size.value = String(object.size ?? 100)
  elements.angle.value = String(object.angle ?? 0)
  elements.color.value = object.color ?? '#ff8000'
  syncColorControl(elements)
  elements.transparency.value = String(object.transparency ?? 0)
  elements.transparencyRange.value = elements.transparency.value
  elements.text.value = object.text ?? ''
  elements.endX.value = String(object.endX ?? object.x ?? 256)
  elements.endY.value = String(object.endY ?? object.y ?? 192)
  elements.arc.value = String(object.arcAngle ?? (object.type === 'fan_aoe' ? 90 : 360))
  elements.arcRange.value = elements.arc.value
  elements.donut.value = String(object.donutRadius ?? 80)
  elements.donutRange.value = elements.donut.value
  elements.hidden.checked = Boolean(object.hidden)
  elements.locked.checked = Boolean(object.locked)
  syncToggleButton(elements.hidden)
  syncToggleButton(elements.locked)
  updateInspectorLockState(object, elements)
}

function updateInspectorVisibility(object: BoardObject, elements: InspectorPanelElements) {
  const capabilities = getObjectCapabilities(object.type)
  setFieldVisible(elements, 'appearance', capabilities.appearance)
  setFieldVisible(elements, 'text', capabilities.text)
  setFieldVisible(elements, 'line', capabilities.line)
  setFieldVisible(elements, 'arc', capabilities.arcAngle || capabilities.donutRadius)
  setFieldVisible(elements, 'arc-angle', capabilities.arcAngle)
  setFieldVisible(elements, 'donut-radius', capabilities.donutRadius)
}

function updateInspectorLockState(object: BoardObject, elements: InspectorPanelElements) {
  const locked = Boolean(object.locked)
  for (const input of [
    elements.x,
    elements.y,
    elements.size,
    elements.angle,
    elements.endX,
    elements.endY,
    elements.arc,
    elements.arcRange,
    elements.donut,
    elements.donutRange,
  ]) {
    input.disabled = locked
  }
}

function setFieldVisible(elements: InspectorPanelElements, field: string, visible: boolean) {
  const element = elements.inspector.querySelector(`[data-field="${field}"]`)
  if (element) {
    element.classList.toggle('hidden', !visible)
  }
}

function syncToggleButton(input: CheckedElement & ClosestElement) {
  const button = input.closest('.toggle-button, .inspector-toggle')
  if (!button) return
  button.classList.toggle('active', input.checked)
  button.setAttribute('aria-pressed', String(input.checked))
}
