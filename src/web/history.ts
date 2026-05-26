import type {
  EditorState,
  HistorySnapshot,
} from './types.js'

declare function structuredClone<T>(value: T): T

export function recordHistory(state: EditorState) {
  state.history.push(createSnapshot(state))
  if (state.history.length > 80) {
    state.history.shift()
  }
  state.future = []
}

export function undoHistory(state: EditorState) {
  const snapshot = state.history.pop()
  if (!snapshot) return null
  state.future.push(createSnapshot(state))
  restoreSnapshot(state, snapshot)
  return snapshot
}

export function redoHistory(state: EditorState) {
  const snapshot = state.future.pop()
  if (!snapshot) return null
  state.history.push(createSnapshot(state))
  restoreSnapshot(state, snapshot)
  return snapshot
}

function createSnapshot(state: EditorState): HistorySnapshot {
  return {
    board: structuredClone(state.board),
    layerTree: structuredClone(state.layerTree ?? []),
    selectedIndex: state.selectedIndex,
    selectedIndexes: [...(state.selectedIndexes ?? [])],
    selectedGroupId: state.selectedGroupId ?? '',
  }
}

function restoreSnapshot(state: EditorState, snapshot: HistorySnapshot) {
  state.board = structuredClone(snapshot.board)
  state.layerTree = structuredClone(snapshot.layerTree ?? [])
  const selectedIndexes = (snapshot.selectedIndexes ?? [snapshot.selectedIndex])
    .filter((index) => index >= 0 && index < state.board.objects.length)
  state.selectedIndexes = selectedIndexes
  state.selectedIndex = selectedIndexes.includes(snapshot.selectedIndex)
    ? snapshot.selectedIndex
    : selectedIndexes.at(-1) ?? -1
  state.selectedGroupId = snapshot.selectedGroupId ?? ''
}
