import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_LOCAL_PRESETS } from '../../src/web/constants.js'
import { sanitizeObject } from '../../src/web/board.js'
import {
  createLocalAssetsBackup,
  localAssetsBackupToJson,
  mergeLocalAssets,
  parseLocalAssetsBackupJson,
} from '../../src/web/localAssetsBackup.js'
import { hashPresetContent } from '../../src/web/localPresets.js'
import {
  BUILT_IN_PROJECT_OBJECT_TYPES,
  createProjectFromBoard,
  createPureBoardFromProject,
} from '../../src/web/project.js'
import type {
  LocalFile,
  LocalLayerPreset,
} from '../../src/web/types.js'

const allowedObjectTypes = new Set(BUILT_IN_PROJECT_OBJECT_TYPES)

test('local asset backups round-trip files and presets without redundant board data', () => {
  const file = createLocalFile('文件 A', '内容 A')
  const preset = createPreset('preset_a', '预设 A', '内容 A')
  const backup = createLocalAssetsBackup([file], [preset], '2026-07-11T00:00:00.000Z')
  const json = localAssetsBackupToJson(backup)

  assert.equal(Object.hasOwn(JSON.parse(json).files[0], 'board'), false)
  const parsed = parseLocalAssetsBackupJson(json, { allowedObjectTypes })
  assert.equal(parsed.files[0]?.name, '文件 A')
  assert.equal(parsed.files[0]?.project.fileName, '文件 A')
  assert.equal(parsed.files[0]?.board.name, '内容 A')
  assert.equal(parsed.presets[0]?.name, '预设 A')
  assert.equal(parsed.presets[0]?.objectCount, 1)
  assert.equal(parsed.presets[0]?.contentHash, preset.contentHash)
})

test('local asset backup parsing rejects future versions and invalid embedded projects', () => {
  const backup = createLocalAssetsBackup([createLocalFile('文件 A', '内容 A')], [])
  assert.throws(
    () => parseLocalAssetsBackupJson(JSON.stringify({ ...backup, version: 2 }), {
      allowedObjectTypes,
    }),
    /需要更新编辑器/,
  )

  backup.files[0]!.project.objects.obj_1!.type = 'unknown_type'
  assert.throws(
    () => parseLocalAssetsBackupJson(JSON.stringify(backup), { allowedObjectTypes }),
    /本地文件“文件 A”.*对象“obj_1”.*不受支持/,
  )
})

test('local asset merging preserves existing data, renames conflicts, and skips identical items', () => {
  const sameFile = createLocalFile('相同文件', '相同内容')
  const samePreset = createPreset('same', '相同预设', '相同内容')
  const current = {
    files: [sameFile, createLocalFile('冲突文件', '旧内容')],
    presets: [samePreset, createPreset('conflict', '旧预设', '旧内容')],
  }
  const imported = {
    files: [
      structuredClone(sameFile),
      createLocalFile('冲突文件', '新内容'),
      createLocalFile('新增文件', '新增内容'),
    ],
    presets: [
      structuredClone(samePreset),
      createPreset('conflict', '新预设', '新内容'),
      createPreset('new', '新增预设', '新增内容'),
    ],
  }

  const result = mergeLocalAssets(current, imported)

  assert.equal(result.importedFiles, 2)
  assert.equal(result.skippedFiles, 1)
  assert.equal(result.files[0]?.name, '冲突文件（导入）')
  assert.equal(result.files[0]?.project.fileName, '冲突文件（导入）')
  assert.equal(result.files[1]?.name, '新增文件')
  assert.equal(result.importedPresets, 2)
  assert.equal(result.skippedPresets, 1)
  assert.equal(result.presets[0]?.id, 'conflict_imported_1')
  assert.equal(result.presets[1]?.id, 'new')
  assert.equal(result.files.at(-1)?.name, '冲突文件')
})

test('local asset merging refuses to overflow the preset limit', () => {
  const current = {
    files: [],
    presets: Array.from({ length: MAX_LOCAL_PRESETS }, (_, index) =>
      createPreset(`preset_${index}`, `预设 ${index}`, `内容 ${index}`)),
  }

  assert.throws(
    () => mergeLocalAssets(current, {
      files: [],
      presets: [createPreset('extra', '额外预设', '额外内容')],
    }),
    /超过上限 50/,
  )
  assert.throws(
    () => createLocalAssetsBackup([], [
      ...current.presets,
      createPreset('extra', '额外预设', '额外内容'),
    ]),
    /超过上限 50/,
  )
})

function createLocalFile(name: string, boardName: string): LocalFile {
  const project = createProjectFromBoard({
    name: boardName,
    boardBackground: 'checkered',
    objects: [{
      editorId: 'obj_1',
      type: 'text',
      x: 10,
      y: 20,
      text: boardName,
    }],
  }, { fileName: name })
  return {
    name,
    project,
    board: createPureBoardFromProject(project),
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    preview: '',
  }
}

function createPreset(id: string, name: string, text: string): LocalLayerPreset {
  const objects = {
    object: sanitizeObject({
      type: 'text',
      x: 10,
      y: 20,
      text,
    }),
  }
  const layers = [{ type: 'object' as const, id: 'object' }]
  return {
    id,
    name,
    objects,
    layers,
    objectCount: 1,
    contentHash: hashPresetContent({ objects, layers }),
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  }
}
