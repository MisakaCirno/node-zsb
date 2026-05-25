const MOVEMENT_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
const DELETE_KEYS = ['Backspace', 'Delete']

export function handleEditorKeyboard(event, handlers) {
  const isEditingText = isTextEditingTarget(event.target)
  if (handleZoomShortcut(event, handlers)) {
    return
  }
  if (isShortcut(event, 'c') && !isEditingText) {
    event.preventDefault()
    handlers.copySelected()
    return
  }
  if (isShortcut(event, 'd') && !isEditingText) {
    event.preventDefault()
    handlers.duplicateSelected()
    return
  }
  if (isShortcut(event, 'v') && !isEditingText) {
    event.preventDefault()
    handlers.pasteObject()
    return
  }
  if (!isEditingText && MOVEMENT_KEYS.includes(event.key)) {
    event.preventDefault()
    handlers.nudgeSelected(event.key, event.shiftKey ? 10 : 1)
    return
  }
  if (isShortcut(event, 'z')) {
    event.preventDefault()
    if (event.shiftKey) {
      handlers.redo()
    } else {
      handlers.undo()
    }
    return
  }
  if (isShortcut(event, 'y')) {
    event.preventDefault()
    handlers.redo()
    return
  }
  if (!isEditingText && event.key === 'Escape') {
    event.preventDefault()
    handlers.deselect()
    return
  }
  if (!isEditingText && DELETE_KEYS.includes(event.key)) {
    event.preventDefault()
    handlers.deleteSelected()
  }
}

function isTextEditingTarget(target) {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }
  if (!(target instanceof HTMLInputElement)) {
    return false
  }
  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(
    target.type,
  )
}

function handleZoomShortcut(event, handlers) {
  if (!isModifierPressed(event)) return false

  const key = event.key.toLowerCase()
  if (key === '+' || key === '=' || event.code === 'Equal' || event.code === 'NumpadAdd') {
    event.preventDefault()
    handlers.stepZoom(1)
    return true
  }
  if (key === '-' || key === '_' || event.code === 'Minus' || event.code === 'NumpadSubtract') {
    event.preventDefault()
    handlers.stepZoom(-1)
    return true
  }
  if (key === '0' || event.code === 'Digit0' || event.code === 'Numpad0') {
    event.preventDefault()
    handlers.applyFitZoom()
    return true
  }

  return false
}

function isShortcut(event, key) {
  return isModifierPressed(event) && event.key.toLowerCase() === key
}

function isModifierPressed(event) {
  return event.ctrlKey || event.metaKey
}
