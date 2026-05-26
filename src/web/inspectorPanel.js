import { getObjectCapabilities } from './board.js'
import { syncColorControl } from './colorPicker.js'

export function renderInspector({
  object,
  elements,
  updateSelectionActions,
}) {
  elements.emptyState.classList.toggle('hidden', Boolean(object))
  elements.inspector.classList.toggle('hidden', !object)
  updateSelectionActions()
  if (!object) return
  updateInspectorVisibility(object, elements)
  elements.type.value = object.type
  elements.x.value = object.x ?? 256
  elements.y.value = object.y ?? 192
  elements.size.value = object.size ?? 100
  elements.angle.value = object.angle ?? 0
  elements.color.value = object.color ?? '#ff8000'
  syncColorControl(elements)
  elements.transparency.value = object.transparency ?? 0
  elements.transparencyRange.value = elements.transparency.value
  elements.text.value = object.text ?? ''
  elements.endX.value = object.endX ?? object.x ?? 256
  elements.endY.value = object.endY ?? object.y ?? 192
  elements.arc.value = object.arcAngle ?? (object.type === 'fan_aoe' ? 90 : 360)
  elements.arcRange.value = elements.arc.value
  elements.donut.value = object.donutRadius ?? 80
  elements.donutRange.value = elements.donut.value
  elements.hidden.checked = Boolean(object.hidden)
  elements.locked.checked = Boolean(object.locked)
  syncToggleButton(elements.hidden)
  syncToggleButton(elements.locked)
  updateInspectorLockState(object, elements)
}

function updateInspectorVisibility(object, elements) {
  const capabilities = getObjectCapabilities(object.type)
  setFieldVisible(elements, 'appearance', capabilities.appearance)
  setFieldVisible(elements, 'text', capabilities.text)
  setFieldVisible(elements, 'line', capabilities.line)
  setFieldVisible(elements, 'arc', capabilities.arcAngle || capabilities.donutRadius)
  setFieldVisible(elements, 'arc-angle', capabilities.arcAngle)
  setFieldVisible(elements, 'donut-radius', capabilities.donutRadius)
}

function updateInspectorLockState(object, elements) {
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

function setFieldVisible(elements, field, visible) {
  const element = elements.inspector.querySelector(`[data-field="${field}"]`)
  if (element) {
    element.classList.toggle('hidden', !visible)
  }
}

function syncToggleButton(input) {
  const button = input.closest('.toggle-button, .inspector-toggle')
  if (!button) return
  button.classList.toggle('active', input.checked)
  button.setAttribute('aria-pressed', String(input.checked))
}
