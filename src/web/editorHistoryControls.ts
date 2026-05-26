import {
  recordHistory as pushHistory,
  redoHistory,
  undoHistory,
} from './history.js'
import type {
  DisabledElement,
  EditorHistoryControls,
  EditorState,
} from './types.js'

interface EditorHistoryControlsDeps {
  state: EditorState
  getElements(): HistoryElements
  restoreCurrentState(): void
  showStatus(message: string): void
}

interface HistoryElements {
  undo: DisabledElement
  menuUndo: DisabledElement
  redo: DisabledElement
  menuRedo: DisabledElement
}

interface EditorHistoryControlsResult extends EditorHistoryControls {
  recordHistory(): void
  updateHistoryButtons(): void
}

export function createEditorHistoryControls({
  state,
  getElements,
  restoreCurrentState,
  showStatus,
}: EditorHistoryControlsDeps): EditorHistoryControlsResult {
  function recordHistory() {
    pushHistory(state)
    updateHistoryButtons()
  }

  function undo() {
    if (!undoHistory(state)) return
    restoreCurrentState()
    showStatus('已撤销')
  }

  function redo() {
    if (!redoHistory(state)) return
    restoreCurrentState()
    showStatus('已重做')
  }

  function updateHistoryButtons() {
    const elements = getElements()
    elements.undo.disabled = state.history.length === 0
    elements.menuUndo.disabled = state.history.length === 0
    elements.redo.disabled = state.future.length === 0
    elements.menuRedo.disabled = state.future.length === 0
  }

  return {
    recordHistory,
    redo,
    undo,
    updateHistoryButtons,
  }
}
