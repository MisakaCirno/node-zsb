import { DEFAULT_BOARD_BACKGROUND } from '../shared/backgrounds.js'
import { MAX_LOCAL_PRESETS } from './constants.js'
import { hashPresetContent } from './localPresets.js'
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  createPureBoardFromProject,
  parseProjectJson,
} from './project.js'
import type {
  LocalAssetsBackup,
  LocalFile,
  LocalLayerPreset,
  ProjectFile,
} from './types.js'

export const LOCAL_ASSETS_BACKUP_FORMAT = 'node-zsb-local-assets'
export const LOCAL_ASSETS_BACKUP_VERSION = 1
export const LOCAL_ASSETS_BACKUP_EXTENSION = '.zsb-backup.json'
export const MAX_LOCAL_ASSETS_BACKUP_BYTES = 20 * 1024 * 1024

const MAX_LOCAL_FILES_IN_BACKUP = 1_000
const MAX_BACKUP_PREVIEW_LENGTH = 2 * 1024 * 1024
const MAX_LOCAL_ASSET_NAME_LENGTH = 48
const UNSAFE_IDS = new Set(['__proto__', 'constructor', 'prototype'])

interface ParseLocalAssetsBackupOptions {
  allowedObjectTypes: Iterable<string>
}

export interface LocalAssetsData {
  files: LocalFile[]
  presets: LocalLayerPreset[]
}

export interface LocalAssetsMergeResult extends LocalAssetsData {
  importedFiles: number
  importedPresets: number
  skippedFiles: number
  skippedPresets: number
}

export function createLocalAssetsBackup(
  files: LocalFile[],
  presets: LocalLayerPreset[],
  exportedAt = new Date().toISOString(),
): LocalAssetsBackup {
  if (files.length > MAX_LOCAL_FILES_IN_BACKUP) {
    throw new Error(`本地文件数量超过备份上限 ${MAX_LOCAL_FILES_IN_BACKUP}`)
  }
  if (presets.length > MAX_LOCAL_PRESETS) {
    throw new Error(`本地预设数量超过上限 ${MAX_LOCAL_PRESETS}，请先删除部分预设`)
  }
  return {
    format: LOCAL_ASSETS_BACKUP_FORMAT,
    version: LOCAL_ASSETS_BACKUP_VERSION,
    exportedAt,
    files: files.map((file) => ({
      name: file.name,
      project: structuredClone(file.project),
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      preview: file.preview,
    })),
    presets: structuredClone(presets),
  }
}

export function localAssetsBackupToJson(backup: LocalAssetsBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`
}

export function parseLocalAssetsBackupJson(
  text: string,
  { allowedObjectTypes }: ParseLocalAssetsBackupOptions,
): LocalAssetsData {
  if (new TextEncoder().encode(text).length > MAX_LOCAL_ASSETS_BACKUP_BYTES) {
    throw new Error('本地资产备份超过 20 MB 上限')
  }

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('本地资产备份不是有效的 JSON')
  }
  if (!isRecord(value)) {
    throw new Error('本地资产备份格式无效：根节点必须是对象')
  }
  if (value.format !== LOCAL_ASSETS_BACKUP_FORMAT) {
    throw new Error(`本地资产备份格式无效：仅支持 ${LOCAL_ASSETS_BACKUP_FORMAT}`)
  }
  if (typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    throw new Error('本地资产备份格式无效：version 必须是整数')
  }
  if (value.version > LOCAL_ASSETS_BACKUP_VERSION) {
    throw new Error('本地资产备份版本较新，需要更新编辑器后再导入')
  }
  if (value.version !== LOCAL_ASSETS_BACKUP_VERSION) {
    throw new Error(`本地资产备份版本无效：仅支持 v${LOCAL_ASSETS_BACKUP_VERSION}`)
  }
  if (typeof value.exportedAt !== 'string') {
    throw new Error('本地资产备份格式无效：exportedAt 必须是字符串')
  }
  if (!Array.isArray(value.files) || !Array.isArray(value.presets)) {
    throw new Error('本地资产备份格式无效：files 和 presets 必须是数组')
  }
  if (value.files.length > MAX_LOCAL_FILES_IN_BACKUP) {
    throw new Error(`本地文件数量超过备份上限 ${MAX_LOCAL_FILES_IN_BACKUP}`)
  }
  if (value.presets.length > MAX_LOCAL_PRESETS) {
    throw new Error(`本地预设数量超过上限 ${MAX_LOCAL_PRESETS}`)
  }

  const allowedTypes = new Set(allowedObjectTypes)
  const usedFileNames = new Set<string>()
  const usedPresetIds = new Set<string>()
  return {
    files: value.files.map((file, index) =>
      parseBackupFile(file, index, allowedTypes, usedFileNames)),
    presets: value.presets.map((preset, index) =>
      parseBackupPreset(preset, index, allowedTypes, usedPresetIds)),
  }
}

export function mergeLocalAssets(
  current: LocalAssetsData,
  imported: LocalAssetsData,
): LocalAssetsMergeResult {
  const usedFileNames = new Set(current.files.map((file) => file.name))
  const importedFiles: LocalFile[] = []
  let skippedFiles = 0
  for (const source of imported.files) {
    const existing = current.files.find((file) => file.name === source.name)
    if (existing && haveSameFileContent(existing, source)) {
      skippedFiles += 1
      continue
    }
    const name = makeUniqueImportedName(source.name, usedFileNames)
    usedFileNames.add(name)
    importedFiles.push(cloneLocalFile(source, name))
  }

  const usedPresetIds = new Set(current.presets.map((preset) => preset.id))
  const importedPresets: LocalLayerPreset[] = []
  let skippedPresets = 0
  for (const source of imported.presets) {
    const existing = current.presets.find((preset) => preset.id === source.id)
    if (existing?.contentHash === source.contentHash) {
      skippedPresets += 1
      continue
    }
    const id = makeUniqueImportedId(source.id, usedPresetIds)
    usedPresetIds.add(id)
    importedPresets.push({
      ...structuredClone(source),
      id,
    })
  }

  const presets = [...importedPresets, ...structuredClone(current.presets)]
  if (presets.length > MAX_LOCAL_PRESETS) {
    throw new Error(`合并后本地预设将超过上限 ${MAX_LOCAL_PRESETS}，请先删除部分预设`)
  }
  return {
    files: [...importedFiles, ...structuredClone(current.files)],
    presets,
    importedFiles: importedFiles.length,
    importedPresets: importedPresets.length,
    skippedFiles,
    skippedPresets,
  }
}

function parseBackupFile(
  value: unknown,
  index: number,
  allowedObjectTypes: Set<string>,
  usedNames: Set<string>,
): LocalFile {
  if (!isRecord(value)) {
    throw new Error(`本地文件 #${index + 1} 格式无效`)
  }
  const name = validateName(value.name, `本地文件 #${index + 1}`)
  if (usedNames.has(name)) {
    throw new Error(`本地资产备份包含重复文件名“${name}”`)
  }
  usedNames.add(name)
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new Error(`本地文件“${name}”的时间字段无效`)
  }
  if (typeof value.preview !== 'string' || value.preview.length > MAX_BACKUP_PREVIEW_LENGTH) {
    throw new Error(`本地文件“${name}”的预览数据无效或过大`)
  }
  const project = parseEmbeddedProject(value.project, allowedObjectTypes, `本地文件“${name}”`)
  project.fileName = name
  return {
    name,
    project,
    board: createPureBoardFromProject(project),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    preview: value.preview,
  }
}

function parseBackupPreset(
  value: unknown,
  index: number,
  allowedObjectTypes: Set<string>,
  usedIds: Set<string>,
): LocalLayerPreset {
  if (!isRecord(value)) {
    throw new Error(`本地预设 #${index + 1} 格式无效`)
  }
  const id = validateId(value.id, `本地预设 #${index + 1}`)
  if (usedIds.has(id)) {
    throw new Error(`本地资产备份包含重复预设 ID“${id}”`)
  }
  usedIds.add(id)
  const name = validateName(value.name, `本地预设“${id}”`)
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new Error(`本地预设“${name}”的时间字段无效`)
  }
  const project = parseEmbeddedProject({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    fileName: name,
    board: {
      name,
      boardBackground: DEFAULT_BOARD_BACKGROUND,
    },
    objects: value.objects,
    layers: value.layers,
  }, allowedObjectTypes, `本地预设“${name}”`)
  const objectCount = Object.keys(project.objects).length
  if (objectCount === 0) {
    throw new Error(`本地预设“${name}”不包含对象`)
  }
  const content = {
    objects: project.objects,
    layers: project.layers,
  }
  return {
    id,
    name,
    ...content,
    objectCount,
    contentHash: hashPresetContent(content),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parseEmbeddedProject(
  value: unknown,
  allowedObjectTypes: Set<string>,
  label: string,
): ProjectFile {
  try {
    return parseProjectJson(JSON.stringify(value), { allowedObjectTypes })
  } catch (error) {
    const message = error instanceof Error ? error.message : '工程数据无效'
    throw new Error(`${label}：${message}`)
  }
}

function validateName(value: unknown, label: string): string {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new Error(`${label}缺少有效名称`)
  if (name.length > MAX_LOCAL_ASSET_NAME_LENGTH) {
    throw new Error(`${label}的名称超过 ${MAX_LOCAL_ASSET_NAME_LENGTH} 个字符`)
  }
  return name
}

function validateId(value: unknown, label: string): string {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id || UNSAFE_IDS.has(id)) throw new Error(`${label}缺少有效 ID`)
  return id
}

function makeUniqueImportedName(name: string, used: Set<string>): string {
  if (!used.has(name)) return name
  let index = 1
  while (true) {
    const suffix = index === 1 ? '（导入）' : `（导入 ${index}）`
    const candidate = `${name.slice(0, MAX_LOCAL_ASSET_NAME_LENGTH - suffix.length)}${suffix}`
    if (!used.has(candidate)) return candidate
    index += 1
  }
}

function makeUniqueImportedId(id: string, used: Set<string>): string {
  if (!used.has(id)) return id
  let index = 1
  while (used.has(`${id}_imported_${index}`)) index += 1
  return `${id}_imported_${index}`
}

function cloneLocalFile(file: LocalFile, name: string): LocalFile {
  const clone = structuredClone(file)
  clone.name = name
  clone.project.fileName = name
  return clone
}

function haveSameFileContent(left: LocalFile, right: LocalFile): boolean {
  return left.preview === right.preview
    && JSON.stringify(left.project) === JSON.stringify(right.project)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
