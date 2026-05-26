import { LOCAL_BOARDS_KEY, LOCAL_FILES_KEY, STORAGE_KEY } from './constants.js'
import {
  createProjectFromBoard,
  createPureBoardFromProject,
  isProject,
  normalizeProject,
} from './project.js'

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

export function loadLocalFiles() {
  try {
    const raw = window.localStorage.getItem(LOCAL_FILES_KEY)
    const files = raw ? JSON.parse(raw) : null
    if (Array.isArray(files)) {
      return normalizeLocalFiles(files)
    }
    const migrated = migrateLocalBoardsToFiles()
    if (migrated.length > 0) {
      persistLocalFiles(migrated)
    }
    return normalizeLocalFiles(migrated)
  } catch (error) {
    console.warn('Failed to load local files', error)
    return []
  }
}

export function persistLocalFiles(files) {
  try {
    window.localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(normalizeLocalFiles(files)))
    return true
  } catch (error) {
    console.warn('Failed to save local files', error)
    return false
  }
}

function migrateLocalBoardsToFiles() {
  const boards = loadLocalBoards()
  const usedNames = new Set()
  return boards.map((entry) => {
    const name = makeUniqueFileName(entry.name || entry.board?.name || '未命名', usedNames)
    usedNames.add(name)
    return {
      name,
      board: entry.board,
      createdAt: entry.updatedAt ?? new Date().toISOString(),
      updatedAt: entry.updatedAt ?? new Date().toISOString(),
      preview: entry.preview ?? '',
    }
  }).filter((file) => file.name && file.board)
}

function normalizeLocalFiles(files) {
  const seen = new Set()
  return files
    .filter((file) => file?.name && (file?.project || file?.board) && !seen.has(file.name))
    .map((file) => {
      seen.add(file.name)
      const project = getLocalFileProject(file)
      return {
        name: file.name,
        project,
        board: createPureBoardFromProject(project),
        createdAt: file.createdAt ?? file.updatedAt ?? new Date().toISOString(),
        updatedAt: file.updatedAt ?? new Date().toISOString(),
        preview: file.preview ?? '',
      }
    })
}

function getLocalFileProject(file) {
  if (isProject(file.project)) {
    return normalizeProject(file.project)
  }
  return createProjectFromBoard(file.board, { fileName: file.name })
}

function makeUniqueFileName(name, usedNames) {
  const baseName = String(name).trim() || '未命名'
  if (!usedNames.has(baseName)) return baseName
  let index = 2
  while (usedNames.has(`${baseName} ${index}`)) {
    index += 1
  }
  return `${baseName} ${index}`
}
