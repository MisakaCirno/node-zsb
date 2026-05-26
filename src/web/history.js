export function recordHistory(state) {
  state.history.push(createSnapshot(state))
  if (state.history.length > 80) {
    state.history.shift()
  }
  state.future = []
}

export function undoHistory(state) {
  const snapshot = state.history.pop()
  if (!snapshot) return null
  state.future.push(createSnapshot(state))
  restoreSnapshot(state, snapshot)
  return snapshot
}

export function redoHistory(state) {
  const snapshot = state.future.pop()
  if (!snapshot) return null
  state.history.push(createSnapshot(state))
  restoreSnapshot(state, snapshot)
  return snapshot
}

function createSnapshot(state) {
  return {
    board: structuredClone(state.board),
    selectedIndex: state.selectedIndex,
    selectedIndexes: [...(state.selectedIndexes ?? [])],
  }
}

function restoreSnapshot(state, snapshot) {
  state.board = structuredClone(snapshot.board)
  const selectedIndexes = (snapshot.selectedIndexes ?? [snapshot.selectedIndex])
    .filter((index) => index >= 0 && index < state.board.objects.length)
  state.selectedIndexes = selectedIndexes
  state.selectedIndex = selectedIndexes.includes(snapshot.selectedIndex)
    ? snapshot.selectedIndex
    : selectedIndexes.at(-1) ?? -1
}
