import {
  DEFAULT_GRID_OPACITY,
  DEFAULT_GRID_SIZE,
  EDITOR_SETTINGS_KEY,
  GRID_OPACITY_STEP,
  GRID_SIZE_STEP,
  LOCAL_BOARDS_KEY,
  LOCAL_FILES_KEY,
  MAX_GRID_OPACITY,
  MAX_GRID_SIZE,
  MIN_GRID_OPACITY,
  MIN_GRID_SIZE,
  STORAGE_KEY,
  ZOOM_LEVELS,
} from './constants.js'
import { clamp } from './geometry.js'
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

export function loadEditorSettings() {
  try {
    const raw = window.localStorage.getItem(EDITOR_SETTINGS_KEY)
    return raw ? normalizeEditorSettings(JSON.parse(raw)) : null
  } catch (error) {
    console.warn('Failed to load editor settings', error)
    return null
  }
}

export function persistEditorSettings(settings) {
  try {
    window.localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(normalizeEditorSettings(settings)))
    return true
  } catch (error) {
    console.warn('Failed to save editor settings', error)
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

function normalizeEditorSettings(settings) {
  const zoom = Number(settings?.zoom)
  return {
    snapToGrid: Boolean(settings?.snapToGrid),
    showGrid: Boolean(settings?.showGrid),
    gridSize: normalizeGridSize(settings?.gridSize),
    gridOpacity: normalizeGridOpacity(settings?.gridOpacity),
    zoom: clamp(Number.isFinite(zoom) ? zoom : 1, ZOOM_LEVELS[0], ZOOM_LEVELS.at(-1)),
    zoomMode: settings?.zoomMode === 'manual' ? 'manual' : 'fit',
  }
}

function normalizeGridSize(gridSize) {
  const snapped = Math.round((Number(gridSize) || DEFAULT_GRID_SIZE) / GRID_SIZE_STEP) * GRID_SIZE_STEP
  return clamp(snapped, MIN_GRID_SIZE, MAX_GRID_SIZE)
}

function normalizeGridOpacity(gridOpacity) {
  const snapped =
    Math.round((Number(gridOpacity) || DEFAULT_GRID_OPACITY) / GRID_OPACITY_STEP)
    * GRID_OPACITY_STEP
  return Number(clamp(snapped, MIN_GRID_OPACITY, MAX_GRID_OPACITY).toFixed(2))
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
