import { LOCAL_BOARDS_KEY, STORAGE_KEY } from './constants.js'

export function loadSavedBoard() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('Failed to load saved board', error)
    return null
  }
}

export function persistSavedBoard(board) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
    return true
  } catch (error) {
    console.warn('Failed to save board', error)
    return false
  }
}

export function loadLocalBoards() {
  try {
    const raw = window.localStorage.getItem(LOCAL_BOARDS_KEY)
    const boards = raw ? JSON.parse(raw) : []
    return Array.isArray(boards)
      ? boards.filter((entry) => entry?.id && entry?.board)
      : []
  } catch (error) {
    console.warn('Failed to load local boards', error)
    return []
  }
}

export function persistLocalBoards(boards) {
  try {
    window.localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards))
    return true
  } catch (error) {
    console.warn('Failed to save local boards', error)
    return false
  }
}
