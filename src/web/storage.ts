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
import type {
  Board,
  BrowserWindow,
  EditorSettings,
  LocalBoardSlot,
  LocalFile,
  ProjectFile,
} from './types.js'

const MIN_ZOOM = ZOOM_LEVELS[0]
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 2

export function loadSavedBoard(): unknown | null {
  try {
    const raw = getLocalStorage().getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('Failed to load saved board', error)
    return null
  }
}

export function persistSavedBoard(board: Board): boolean {
  try {
    getLocalStorage().setItem(STORAGE_KEY, JSON.stringify(board))
    return true
  } catch (error) {
    console.warn('Failed to save board', error)
    return false
  }
}

export function loadEditorSettings(): EditorSettings | null {
  try {
    const raw = getLocalStorage().getItem(EDITOR_SETTINGS_KEY)
    return raw ? normalizeEditorSettings(JSON.parse(raw)) : null
  } catch (error) {
    console.warn('Failed to load editor settings', error)
    return null
  }
}

export function persistEditorSettings(settings: Partial<EditorSettings>): boolean {
  try {
    getLocalStorage().setItem(EDITOR_SETTINGS_KEY, JSON.stringify(normalizeEditorSettings(settings)))
    return true
  } catch (error) {
    console.warn('Failed to save editor settings', error)
    return false
  }
}

export function loadLocalBoards(): LocalBoardSlot[] {
  try {
    const raw = getLocalStorage().getItem(LOCAL_BOARDS_KEY)
    const boards = raw ? JSON.parse(raw) : []
    return Array.isArray(boards)
        ? boards.filter((entry): entry is LocalBoardSlot => Boolean(entry?.id && entry?.board))
      : []
  } catch (error) {
    console.warn('Failed to load local boards', error)
    return []
  }
}

export function persistLocalBoards(boards: LocalBoardSlot[]): boolean {
  try {
    getLocalStorage().setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards))
    return true
  } catch (error) {
    console.warn('Failed to save local boards', error)
    return false
  }
}

export function loadLocalFiles(): LocalFile[] {
  try {
    const raw = getLocalStorage().getItem(LOCAL_FILES_KEY)
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

export function persistLocalFiles(files: unknown[]): boolean {
  try {
    getLocalStorage().setItem(LOCAL_FILES_KEY, JSON.stringify(normalizeLocalFiles(files)))
    return true
  } catch (error) {
    console.warn('Failed to save local files', error)
    return false
  }
}

function normalizeEditorSettings(settings: Partial<EditorSettings> | null | undefined): EditorSettings {
  const zoom = Number(settings?.zoom)
  return {
    snapToGrid: Boolean(settings?.snapToGrid),
    showGrid: Boolean(settings?.showGrid),
    gridSize: normalizeGridSize(settings?.gridSize),
    gridOpacity: normalizeGridOpacity(settings?.gridOpacity),
    zoom: clamp(Number.isFinite(zoom) ? zoom : 1, MIN_ZOOM, MAX_ZOOM),
    zoomMode: settings?.zoomMode === 'manual' ? 'manual' : 'fit',
  }
}

function normalizeGridSize(gridSize: unknown): number {
  const snapped = Math.round((Number(gridSize) || DEFAULT_GRID_SIZE) / GRID_SIZE_STEP) * GRID_SIZE_STEP
  return clamp(snapped, MIN_GRID_SIZE, MAX_GRID_SIZE)
}

function normalizeGridOpacity(gridOpacity: unknown): number {
  const snapped =
    Math.round((Number(gridOpacity) || DEFAULT_GRID_OPACITY) / GRID_OPACITY_STEP)
    * GRID_OPACITY_STEP
  return Number(clamp(snapped, MIN_GRID_OPACITY, MAX_GRID_OPACITY).toFixed(2))
}

function migrateLocalBoardsToFiles(): Array<Record<string, unknown> & { board: Board }> {
  const boards = loadLocalBoards()
  const usedNames = new Set<string>()
  const files: Array<Record<string, unknown>> = boards.map((entry) => {
    const name = makeUniqueFileName(entry.name || entry.board?.name || '未命名', usedNames)
    usedNames.add(name)
    return {
      name,
      board: entry.board,
      createdAt: entry.updatedAt ?? new Date().toISOString(),
      updatedAt: entry.updatedAt ?? new Date().toISOString(),
      preview: entry.preview ?? '',
    }
  })
  return files.filter((file): file is Record<string, unknown> & { board: Board } =>
    Boolean(file.name && file.board))
}

function normalizeLocalFiles(files: unknown[]): LocalFile[] {
  const seen = new Set<string>()
  return files
    .filter((file): file is Record<string, unknown> & { name: string } =>
      isRecord(file)
        && typeof file.name === 'string'
        && Boolean(file.project || file.board)
        && !seen.has(file.name))
    .map((file) => {
      const name = file.name
      seen.add(name)
      const project = getLocalFileProject(file)
      return {
        name,
        project,
        board: createPureBoardFromProject(project),
        createdAt: stringOr(file.createdAt, stringOr(file.updatedAt, new Date().toISOString())),
        updatedAt: stringOr(file.updatedAt, new Date().toISOString()),
        preview: stringOr(file.preview, ''),
      }
    })
}

function getLocalFileProject(file: Record<string, unknown> & { name: string }): ProjectFile {
  if (isProject(file.project)) {
    return normalizeProject(file.project)
  }
  return createProjectFromBoard(file.board as Partial<Board>, { fileName: file.name as string })
}

function makeUniqueFileName(name: unknown, usedNames: Set<string>): string {
  const baseName = String(name).trim() || '未命名'
  if (!usedNames.has(baseName)) return baseName
  let index = 2
  while (usedNames.has(`${baseName} ${index}`)) {
    index += 1
  }
  return `${baseName} ${index}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function getLocalStorage(): BrowserWindow['localStorage'] {
  const globals = globalThis as unknown as {
    localStorage?: BrowserWindow['localStorage']
    window?: BrowserWindow
  }
  return globals.window?.localStorage ?? globals.localStorage as BrowserWindow['localStorage']
}
