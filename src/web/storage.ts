import {
  DEFAULT_GRID_OPACITY,
  DEFAULT_GRID_SIZE,
  EDITOR_SETTINGS_KEY,
  GRID_OPACITY_STEP,
  GRID_SIZE_STEP,
  LAYOUT_SETTINGS_KEY,
  LOCAL_BOARDS_KEY,
  LOCAL_FILES_KEY,
  LOCAL_PRESETS_KEY,
  MAX_GRID_OPACITY,
  MAX_GRID_SIZE,
  MIN_GRID_OPACITY,
  MIN_GRID_SIZE,
  STORAGE_KEY,
  ZOOM_LEVELS,
} from './constants.js'
import { clamp } from './geometry.js'
import {
  clearPresetPreviewCache,
  estimatePresetPreviewCacheBytes,
} from './presetPreviewCache.js'
import {
  createProjectFromBoard,
  createPureBoardFromProject,
  isProject,
  normalizeProject,
} from './project.js'
import { getBrowserLocalStorage, getOptionalBrowserWindow } from './browser.js'
import { sanitizeObject } from './board.js'
import type {
  Board,
  BoardObject,
  EditorSettings,
  LocalBoardSlot,
  LocalFile,
  LocalLayerPreset,
  ProjectFile,
} from './types.js'

const MIN_ZOOM = ZOOM_LEVELS[0]
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 2

export function loadEditorDraft(): unknown | null {
  try {
    const raw = getLocalStorage().getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('Failed to load editor draft', error)
    return null
  }
}

export function persistEditorDraft(board: unknown): StorageWriteResult {
  try {
    getLocalStorage().setItem(STORAGE_KEY, JSON.stringify(board))
    return { ok: true }
  } catch (error) {
    console.warn('Failed to save editor draft', error)
    return {
      ok: false,
      reason: isStorageQuotaError(error) ? 'quota' : 'unknown',
    }
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
  return persistLocalFilesDetailed(files).ok
}

export type StorageWriteResult =
  | { ok: true }
  | { ok: false, reason: 'quota' | 'unknown' }

export function persistLocalFilesDetailed(files: unknown[]): StorageWriteResult {
  try {
    getLocalStorage().setItem(LOCAL_FILES_KEY, JSON.stringify(normalizeLocalFiles(files)))
    return { ok: true }
  } catch (error) {
    console.warn('Failed to save local files', error)
    return {
      ok: false,
      reason: isStorageQuotaError(error) ? 'quota' : 'unknown',
    }
  }
}

export interface BrowserStorageEstimateSummary {
  supported: boolean
  usageBytes: number | null
  quotaBytes: number | null
  availableBytes: number | null
}

export interface ProjectStorageUsageEntry {
  id: string
  label: string
  bytes: number
}

export interface ProjectStorageUsage {
  totalBytes: number
  entries: ProjectStorageUsageEntry[]
}

export type ProjectStorageClearTarget =
  | ProjectLocalStorageTarget
  | 'other-local-storage'
  | 'preset-preview-cache'

type ProjectLocalStorageTarget =
  | 'local-files'
  | 'local-presets'
  | 'editor-draft'
  | 'view-settings'
  | 'layout-settings'
  | 'legacy-local-files'

const PROJECT_LOCAL_STORAGE_KEYS = [
  { id: 'local-files', label: '本地文件', key: LOCAL_FILES_KEY },
  { id: 'local-presets', label: '本地预设', key: LOCAL_PRESETS_KEY },
  { id: 'editor-draft', label: '自动草稿', key: STORAGE_KEY },
  { id: 'view-settings', label: '视图设置', key: EDITOR_SETTINGS_KEY },
  { id: 'layout-settings', label: '面板布局', key: LAYOUT_SETTINGS_KEY },
  { id: 'legacy-local-files', label: '旧版本地文件', key: LOCAL_BOARDS_KEY },
] as const

const PROJECT_LOCAL_STORAGE_KEY_BY_ID = new Map<ProjectLocalStorageTarget, string>(
  PROJECT_LOCAL_STORAGE_KEYS.map((entry) => [entry.id, entry.key]),
)

export async function getBrowserStorageEstimate(): Promise<BrowserStorageEstimateSummary> {
  try {
    const estimate = await getOptionalBrowserWindow()?.navigator.storage?.estimate?.()
    const usageBytes = numberOrNull(estimate?.usage)
    const quotaBytes = numberOrNull(estimate?.quota)
    return {
      supported: Boolean(estimate),
      usageBytes,
      quotaBytes,
      availableBytes: usageBytes === null || quotaBytes === null
        ? null
        : Math.max(0, quotaBytes - usageBytes),
    }
  } catch (error) {
    console.warn('Failed to estimate browser storage', error)
    return {
      supported: false,
      usageBytes: null,
      quotaBytes: null,
      availableBytes: null,
    }
  }
}

export async function getProjectStorageUsage(): Promise<ProjectStorageUsage> {
  const localStorage = getLocalStorage()
  const entries: ProjectStorageUsageEntry[] = PROJECT_LOCAL_STORAGE_KEYS.map(({ id, label, key }) => ({
    id,
    label,
    bytes: getLocalStorageItemBytes(localStorage, key),
  }))
  const knownKeys = new Set(PROJECT_LOCAL_STORAGE_KEYS.map((entry) => entry.key))
  const otherBytes = getOtherProjectLocalStorageBytes(localStorage, knownKeys)
  if (otherBytes > 0) {
    entries.push({
      id: 'other-local-storage',
      label: '其他本地数据',
      bytes: otherBytes,
    })
  }
  const presetPreviewBytes = await estimatePresetPreviewCacheBytes()
  if (presetPreviewBytes !== null) {
    entries.push({
      id: 'preset-preview-cache',
      label: '预设缩略图缓存',
      bytes: presetPreviewBytes,
    })
  }
  return {
    entries,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
  }
}

export async function clearProjectStorageTarget(target: ProjectStorageClearTarget): Promise<boolean> {
  if (target === 'preset-preview-cache') {
    return clearPresetPreviewCache()
  }

  const localStorage = getLocalStorage()
  const knownKeys = new Set(PROJECT_LOCAL_STORAGE_KEYS.map((entry) => entry.key))
  if (target === 'other-local-storage') {
    removeOtherProjectLocalStorage(localStorage, knownKeys)
    return true
  }

  const key = PROJECT_LOCAL_STORAGE_KEY_BY_ID.get(target)
  if (!key) return false
  localStorage.removeItem(key)
  return true
}

export async function clearAllProjectStorage(): Promise<boolean> {
  const localStorage = getLocalStorage()
  for (const { key } of PROJECT_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }
  removeOtherProjectLocalStorage(
    localStorage,
    new Set(PROJECT_LOCAL_STORAGE_KEYS.map((entry) => entry.key)),
  )
  return clearPresetPreviewCache()
}

function isStorageQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { name?: unknown, code?: unknown }
  return value.name === 'QuotaExceededError'
    || value.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || value.code === 22
    || value.code === 1014
}

function getLocalStorageItemBytes(storage: Storage, key: string): number {
  const value = storage.getItem(key)
  return value ? getStringByteLength(value) : 0
}

function getOtherProjectLocalStorageBytes(storage: Storage, knownKeys: Set<string>): number {
  if (typeof storage.key !== 'function') return 0
  let total = 0
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || knownKeys.has(key) || !key.startsWith('node-zsb-')) continue
    total += getLocalStorageItemBytes(storage, key)
  }
  return total
}

function removeOtherProjectLocalStorage(storage: Storage, knownKeys: Set<string>): void {
  if (typeof storage.key !== 'function') return
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || knownKeys.has(key) || !key.startsWith('node-zsb-')) continue
    keys.push(key)
  }
  for (const key of keys) {
    storage.removeItem(key)
  }
}

function getStringByteLength(value: string): number {
  if (typeof Blob !== 'undefined') {
    return new Blob([value]).size
  }
  return new TextEncoder().encode(value).length
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function loadLocalPresets(): LocalLayerPreset[] {
  try {
    const raw = getLocalStorage().getItem(LOCAL_PRESETS_KEY)
    const presets = raw ? JSON.parse(raw) : []
    return Array.isArray(presets) ? normalizeLocalPresets(presets) : []
  } catch (error) {
    console.warn('Failed to load local presets', error)
    return []
  }
}

export function persistLocalPresets(presets: unknown[]): boolean {
  try {
    getLocalStorage().setItem(LOCAL_PRESETS_KEY, JSON.stringify(normalizeLocalPresets(presets)))
    return true
  } catch (error) {
    console.warn('Failed to save local presets', error)
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

function normalizeLocalPresets(presets: unknown[]): LocalLayerPreset[] {
  const seen = new Set<string>()
  return presets
    .filter((preset): preset is Record<string, unknown> =>
      isRecord(preset)
        && typeof preset.id === 'string'
        && isRecord(preset.objects)
        && Array.isArray(preset.layers)
        && claimNormalizedKey(seen, preset.id))
    .map((preset) => {
      const id = String(preset.id).trim()
      const objects = normalizePresetObjects(preset.objects as Record<string, unknown>)
      const layers = normalizePresetLayers(preset.layers as unknown[], objects)
      const contentHash = hashPresetContent({ objects, layers })
      return {
        id,
        name: String(preset.name ?? '').trim() || '未命名预设',
        objects,
        layers,
        objectCount: countPresetObjects(layers, objects),
        contentHash,
        createdAt: stringOr(preset.createdAt, new Date().toISOString()),
        updatedAt: stringOr(preset.updatedAt, new Date().toISOString()),
      }
    })
}

function normalizePresetObjects(objects: Record<string, unknown>): Record<string, Board['objects'][number]> {
  const normalized: Record<string, Board['objects'][number]> = {}
  for (const [id, object] of Object.entries(objects)) {
    if (!id || !isRecord(object) || typeof object.type !== 'string') continue
    const sanitized = sanitizeObject({
      ...object,
      type: object.type,
      x: Number(object.x) || 0,
      y: Number(object.y) || 0,
    } as BoardObject)
    delete sanitized.editorId
    normalized[id] = sanitized
  }
  return normalized
}

function normalizePresetLayers(
  layers: unknown[],
  objects: Record<string, Board['objects'][number]>,
): LocalLayerPreset['layers'] {
  const usedObjectIds = new Set<string>()
  const usedGroupIds = new Set<string>()
  const normalized = normalizePresetLayerNodes(layers, objects, usedObjectIds, usedGroupIds)
  for (const id of Object.keys(objects)) {
    if (!usedObjectIds.has(id)) {
      normalized.push({ type: 'object', id })
    }
  }
  return normalized
}

function normalizePresetLayerNodes(
  nodes: unknown[],
  objects: Record<string, Board['objects'][number]>,
  usedObjectIds: Set<string>,
  usedGroupIds: Set<string>,
): LocalLayerPreset['layers'] {
  const normalized: LocalLayerPreset['layers'] = []
  for (const node of nodes) {
    if (!isRecord(node)) continue
    if (
      node.type === 'object'
      && typeof node.id === 'string'
      && objects[node.id]
      && !usedObjectIds.has(node.id)
    ) {
      usedObjectIds.add(node.id)
      normalized.push({ type: 'object', id: node.id })
      continue
    }
    if (node.type === 'group') {
      const id = createUniquePresetGroupId(node.id, usedGroupIds)
      normalized.push({
        type: 'group',
        id,
        name: String(node.name ?? '组'),
        collapsed: Boolean(node.collapsed),
        hidden: Boolean(node.hidden),
        locked: Boolean(node.locked),
        children: Array.isArray(node.children)
          ? normalizePresetLayerNodes(node.children, objects, usedObjectIds, usedGroupIds)
          : [],
      })
    }
  }
  return normalized
}

function createUniquePresetGroupId(value: unknown, used: Set<string>): string {
  const base = typeof value === 'string' && value ? value : `grp_${used.size + 1}`
  let id = base
  let index = 2
  while (used.has(id)) {
    id = `${base}_${index}`
    index += 1
  }
  used.add(id)
  return id
}

function countPresetObjects(
  layers: LocalLayerPreset['layers'],
  objects: Record<string, Board['objects'][number]>,
): number {
  const ids = new Set<string>()
  collectPresetObjectIds(layers, ids)
  return [...ids].filter((id) => Boolean(objects[id])).length
}

function collectPresetObjectIds(layers: LocalLayerPreset['layers'], result: Set<string>): void {
  for (const node of layers) {
    if (node.type === 'object') {
      result.add(node.id)
      continue
    }
    collectPresetObjectIds(node.children ?? [], result)
  }
}

function hashPresetContent(content: {
  layers: LocalLayerPreset['layers']
  objects: Record<string, Board['objects'][number]>
}): string {
  const text = JSON.stringify(content)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
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
        && (isProject(file.project) || isRecord(file.board))
        && claimNormalizedKey(seen, file.name))
    .map((file) => {
      const name = file.name.trim()
      const project = getLocalFileProject({ ...file, name })
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
    return {
      ...normalizeProject(file.project),
      fileName: file.name,
    }
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

function claimNormalizedKey(seen: Set<string>, value: string): boolean {
  const key = value.trim()
  if (!key || seen.has(key)) return false
  seen.add(key)
  return true
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function getLocalStorage(): Storage {
  return getBrowserLocalStorage()
}
