import { DEFAULT_GRID_OPACITY, DEFAULT_GRID_SIZE } from './constants.js'
import { DEFAULT_BOARD_BACKGROUND } from '../shared/backgrounds.js'
import type {
  BoardObject,
  EditorState,
  LayerNode,
  NormalizedBoard,
} from './types.js'

export function createEditorState(): EditorState {
  return {
    board: {
      name: '',
      boardBackground: DEFAULT_BOARD_BACKGROUND,
      objects: [],
    },
    selectedIndex: -1,
    selectedIndexes: [],
    selectedGroupId: '',
    layerTree: [],
    currentFileName: '',
    associatedLocalFileName: '',
    documentBaselineSnapshot: '',
    revealSelectedLayer: false,
    iconConfigs: {},
    iconGroups: {},
    backgrounds: {},
    activeGroup: 'rolesAndJobs',
    snapToGrid: false,
    showGrid: false,
    gridSize: DEFAULT_GRID_SIZE,
    gridOpacity: DEFAULT_GRID_OPACITY,
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

export function getSelectedObject(state: EditorState): BoardObject | undefined {
  return state.board.objects[state.selectedIndex]
}

export function getSelectedIndexes(state: EditorState): number[] {
  const selected = state.selectedIndexes?.length
    ? state.selectedIndexes
    : state.selectedIndex >= 0
      ? [state.selectedIndex]
      : []
  return selected.filter((index) => index >= 0 && index < state.board.objects.length)
}

export function getSelectedObjects(state: EditorState): BoardObject[] {
  return getSelectedIndexes(state)
    .map((index) => state.board.objects[index])
    .filter((object): object is BoardObject => Boolean(object))
}

export function replaceBoard(
  state: EditorState,
  board: NormalizedBoard,
  selectedIndex = -1,
): void {
  state.board = board
  state.selectedIndex = selectedIndex
  state.selectedIndexes = selectedIndex >= 0 ? [selectedIndex] : []
  state.selectedGroupId = ''
  state.layerTree = board.objects.map((object) => ({
    type: 'object',
    id: object.editorId ?? '',
  })).filter((node): node is LayerNode => Boolean(node.id))
}
