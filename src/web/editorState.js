export function createEditorState() {
  return {
    board: {
      name: '',
      boardBackground: 'checkered',
      objects: [],
    },
    selectedIndex: -1,
    selectedIndexes: [],
    revealSelectedLayer: false,
    iconConfigs: {},
    iconGroups: {},
    backgrounds: {},
    activeGroup: 'rolesAndJobs',
    snapToGrid: false,
    showGrid: false,
    zoom: 1,
    zoomMode: 'fit',
    images: new Map(),
    history: [],
    future: [],
    clipboard: null,
    actionRunning: false,
    statusTimer: 0,
  }
}

export function getSelectedObject(state) {
  return state.board.objects[state.selectedIndex]
}

export function getSelectedIndexes(state) {
  const selected = state.selectedIndexes?.length
    ? state.selectedIndexes
    : state.selectedIndex >= 0
      ? [state.selectedIndex]
      : []
  return selected.filter((index) => index >= 0 && index < state.board.objects.length)
}

export function getSelectedObjects(state) {
  return getSelectedIndexes(state).map((index) => state.board.objects[index])
}

export function replaceBoard(state, board, selectedIndex = -1) {
  state.board = board
  state.selectedIndex = selectedIndex
  state.selectedIndexes = selectedIndex >= 0 ? [selectedIndex] : []
}
