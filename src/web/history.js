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
  }
}

function restoreSnapshot(state, snapshot) {
  state.board = structuredClone(snapshot.board)
  state.selectedIndex = Math.min(
    snapshot.selectedIndex,
    state.board.objects.length - 1,
  )
}
