export function createEditorState() {
  return {
    board: {
      name: '',
      boardBackground: 'checkered',
      objects: [],
    },
    selectedIndex: -1,
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

export function replaceBoard(state, board, selectedIndex = -1) {
  state.board = board
  state.selectedIndex = selectedIndex
}
