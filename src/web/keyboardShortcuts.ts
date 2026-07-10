import type {
  EditorActionRegistry,
} from './types.js'

type MovementKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
type DeleteKey = 'Backspace' | 'Delete'

interface KeyboardEventLike {
  code: string
  ctrlKey: boolean
  key: string
  metaKey: boolean
  shiftKey: boolean
  target: unknown
  preventDefault(): void
}

interface KeyboardHandlers {
  applyFitZoom: EditorActionRegistry['applyFitZoom']
  copySelected: EditorActionRegistry['copySelected']
  deleteSelected: EditorActionRegistry['deleteSelected']
  deselect: EditorActionRegistry['deselect']
  duplicateSelected: EditorActionRegistry['duplicateSelected']
  nudgeSelected: EditorActionRegistry['nudgeSelected']
  pasteObject: EditorActionRegistry['pasteObject']
  redo: EditorActionRegistry['redo']
  saveLocalBoard(): void
  saveLocalBoardAs(): void
  stepZoom: EditorActionRegistry['stepZoom']
  undo: EditorActionRegistry['undo']
}

const MOVEMENT_KEYS: MovementKey[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
const DELETE_KEYS: DeleteKey[] = ['Backspace', 'Delete']

export function handleEditorKeyboard(event: KeyboardEventLike, handlers: KeyboardHandlers) {
  const isEditingText = isTextEditingTarget(event.target)
  if (isShortcut(event, 's')) {
    event.preventDefault()
    if (event.shiftKey) {
      handlers.saveLocalBoardAs()
    } else {
      handlers.saveLocalBoard()
    }
    return
  }
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
  if (!isEditingText && isMovementKey(event.key)) {
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
  if (!isEditingText && isDeleteKey(event.key)) {
    event.preventDefault()
    handlers.deleteSelected()
  }
}

function isTextEditingTarget(target: unknown) {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }
  if (!(target instanceof HTMLInputElement)) {
    return false
  }
  const input = target as { type?: string }
  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(
    input.type ?? '',
  )
}

function isMovementKey(key: string): key is MovementKey {
  return MOVEMENT_KEYS.includes(key as MovementKey)
}

function isDeleteKey(key: string): key is DeleteKey {
  return DELETE_KEYS.includes(key as DeleteKey)
}

function handleZoomShortcut(event: KeyboardEventLike, handlers: KeyboardHandlers) {
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

function isShortcut(event: KeyboardEventLike, key: string) {
  return isModifierPressed(event) && event.key.toLowerCase() === key
}

function isModifierPressed(event: KeyboardEventLike) {
  return event.ctrlKey || event.metaKey
}
