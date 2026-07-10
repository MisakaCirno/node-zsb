import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EDITOR_SETTINGS_KEY,
  LAYOUT_SETTINGS_KEY,
  LOCAL_FILES_KEY,
  LOCAL_PRESETS_KEY,
  STORAGE_KEY,
} from '../../src/web/constants.js'
import {
  clearAllProjectStorage,
  clearProjectStorageTarget,
  getProjectStorageUsage,
  loadLocalFiles,
  loadLocalPresets,
  persistEditorDraft,
  persistLocalAssetsDetailed,
  persistLocalFilesDetailed,
} from '../../src/web/storage.js'

test('loadLocalPresets sanitizes stale objects from local storage', () => {
  const restoreLocalStorage = withLocalStorage({
    [LOCAL_PRESETS_KEY]: JSON.stringify([
      {
        id: 'preset_dirty',
        name: 'Dirty',
        objects: {
          text_a: {
            editorId: 'old_editor_id',
            type: 'text',
            x: 10,
            y: 20,
            size: 200,
            angle: 45,
            text: 'label',
          },
          line_aoe_a: {
            type: 'line_aoe',
            x: 30,
            y: 40,
            width: 999,
            height: 1,
            transparency: 120,
          },
        },
        layers: [
          { type: 'object', id: 'text_a' },
          { type: 'object', id: 'line_aoe_a' },
        ],
      },
    ]),
  })
  try {
    const [preset] = loadLocalPresets()
    assert.ok(preset)

    const text = preset.objects.text_a
    const lineAoe = preset.objects.line_aoe_a
    assert.ok(text)
    assert.ok(lineAoe)
    assert.equal(text.editorId, undefined)
    assert.equal(text.size, undefined)
    assert.equal(text.angle, undefined)
    assert.equal(lineAoe.width, 512)
    assert.equal(lineAoe.height, 16)
    assert.equal(lineAoe.transparency, 100)
  } finally {
    restoreLocalStorage()
  }
})

test('storage normalization keeps the first valid preset after normalized id deduplication', () => {
  const restoreLocalStorage = withLocalStorage({
    [LOCAL_PRESETS_KEY]: JSON.stringify([
      { id: ' preset ', name: 'Invalid first', objects: null, layers: [] },
      { id: 'preset', name: 'First valid', objects: {}, layers: [] },
      { id: ' preset ', name: 'Duplicate valid', objects: {}, layers: [] },
    ]),
  })
  try {
    const presets = loadLocalPresets()

    assert.equal(presets.length, 1)
    assert.equal(presets[0]?.id, 'preset')
    assert.equal(presets[0]?.name, 'First valid')
  } finally {
    restoreLocalStorage()
  }
})

test('local file normalization keeps the first valid name and syncs its project filename', () => {
  const restoreLocalStorage = withLocalStorage({
    [LOCAL_FILES_KEY]: JSON.stringify([
      { name: ' File ', project: null, board: null },
      {
        name: 'File',
        project: {
          format: 'node-zsb-project',
          version: 1,
          fileName: 'stale-inner-name',
          board: { name: 'First valid', boardBackground: 'checkered' },
          objects: {},
          layers: [],
        },
      },
      { name: ' File ', board: { name: 'Duplicate valid', objects: [] } },
    ]),
  })
  try {
    const files = loadLocalFiles()

    assert.equal(files.length, 1)
    assert.equal(files[0]?.name, 'File')
    assert.equal(files[0]?.project.fileName, 'File')
    assert.equal(files[0]?.board.name, 'First valid')
  } finally {
    restoreLocalStorage()
  }
})

test('persistEditorDraft reports structured quota failures', () => {
  const quotaError = new Error('Storage is full')
  quotaError.name = 'QuotaExceededError'
  const restoreLocalStorage = withLocalStorage({}, {
    setItem() {
      throw quotaError
    },
  })
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    assert.deepEqual(persistEditorDraft({ format: 'draft' }), {
      ok: false,
      reason: 'quota',
    })
  } finally {
    console.warn = originalWarn
    restoreLocalStorage()
  }
})

test('persistLocalFilesDetailed saves beyond the old fixed file count', () => {
  const restoreLocalStorage = withLocalStorage({})
  try {
    const files = Array.from({ length: 25 }, (_, index) => ({
      name: `File ${index + 1}`,
      board: { objects: [] as never[] },
    }))

    assert.deepEqual(persistLocalFilesDetailed(files), { ok: true })
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_FILES_KEY) ?? '[]')
    assert.equal(stored.length, 25)
  } finally {
    restoreLocalStorage()
  }
})

test('persistLocalFilesDetailed reports browser quota failures', () => {
  const quotaError = new Error('Storage is full')
  quotaError.name = 'QuotaExceededError'
  const restoreLocalStorage = withLocalStorage(
    { [LOCAL_FILES_KEY]: '[]' },
    {
      setItem() {
        throw quotaError
      },
    },
  )
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    const result = persistLocalFilesDetailed([
      { name: 'Full', board: { objects: [] as never[] } },
    ])

    assert.deepEqual(result, { ok: false, reason: 'quota' })
    assert.equal(window.localStorage.getItem(LOCAL_FILES_KEY), '[]')
  } finally {
    console.warn = originalWarn
    restoreLocalStorage()
  }
})

test('persistLocalAssetsDetailed rolls back files when preset storage fails', () => {
  const entries = {
    [LOCAL_FILES_KEY]: JSON.stringify([{ name: 'Original', board: { objects: [] } }]),
    [LOCAL_PRESETS_KEY]: JSON.stringify([{ id: 'original' }]),
  }
  const quotaError = new Error('Storage is full')
  quotaError.name = 'QuotaExceededError'
  const restoreLocalStorage = withLocalStorage(entries, {
    setItem(key, value) {
      if (key === LOCAL_PRESETS_KEY) throw quotaError
      entries[key as keyof typeof entries] = value
    },
  })
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    const result = persistLocalAssetsDetailed(
      [{ name: 'Imported', board: { objects: [] as never[] } }],
      [{ id: 'imported', name: 'Imported', objects: {}, layers: [] }],
    )

    assert.deepEqual(result, { ok: false, reason: 'quota' })
    assert.equal(window.localStorage.getItem(LOCAL_FILES_KEY), JSON.stringify([
      { name: 'Original', board: { objects: [] } },
    ]))
    assert.equal(window.localStorage.getItem(LOCAL_PRESETS_KEY), JSON.stringify([{ id: 'original' }]))
  } finally {
    console.warn = originalWarn
    restoreLocalStorage()
  }
})

test('getProjectStorageUsage groups local project storage bytes', async () => {
  const restoreLocalStorage = withLocalStorage({
    [LOCAL_FILES_KEY]: 'file-data',
    [LOCAL_PRESETS_KEY]: 'preset',
    [STORAGE_KEY]: '',
    [EDITOR_SETTINGS_KEY]: '{}',
    'node-zsb-extra': 'extra',
  })
  try {
    const usage = await getProjectStorageUsage()

    assert.equal(usage.entries.find((entry) => entry.id === 'local-files')?.bytes, 9)
    assert.equal(usage.entries.find((entry) => entry.id === 'local-presets')?.bytes, 6)
    assert.equal(usage.entries.find((entry) => entry.id === 'view-settings')?.bytes, 2)
    assert.equal(usage.entries.find((entry) => entry.id === 'other-local-storage')?.bytes, 5)
    assert.equal(usage.totalBytes, 22)
  } finally {
    restoreLocalStorage()
  }
})

test('clearProjectStorageTarget clears a single tracked storage bucket', async () => {
  const restoreLocalStorage = withLocalStorage({
    [LOCAL_FILES_KEY]: 'file-data',
    [LOCAL_PRESETS_KEY]: 'preset',
  })
  try {
    assert.equal(await clearProjectStorageTarget('local-files'), true)

    assert.equal(window.localStorage.getItem(LOCAL_FILES_KEY), null)
    assert.equal(window.localStorage.getItem(LOCAL_PRESETS_KEY), 'preset')
  } finally {
    restoreLocalStorage()
  }
})

test('clearAllProjectStorage clears tracked and project-prefixed local storage', async () => {
  const restoreLocalStorage = withLocalStorage({
    [LOCAL_FILES_KEY]: 'file-data',
    [LOCAL_PRESETS_KEY]: 'preset',
    [STORAGE_KEY]: 'draft',
    [EDITOR_SETTINGS_KEY]: '{}',
    [LAYOUT_SETTINGS_KEY]: '{}',
    'node-zsb-extra': 'extra',
    unrelated: 'keep',
  })
  try {
    assert.equal(await clearAllProjectStorage(), true)

    assert.equal(window.localStorage.getItem(LOCAL_FILES_KEY), null)
    assert.equal(window.localStorage.getItem(LOCAL_PRESETS_KEY), null)
    assert.equal(window.localStorage.getItem(STORAGE_KEY), null)
    assert.equal(window.localStorage.getItem(EDITOR_SETTINGS_KEY), null)
    assert.equal(window.localStorage.getItem(LAYOUT_SETTINGS_KEY), null)
    assert.equal(window.localStorage.getItem('node-zsb-extra'), null)
    assert.equal(window.localStorage.getItem('unrelated'), 'keep')
  } finally {
    restoreLocalStorage()
  }
})

function withLocalStorage(
  entries: Record<string, string>,
  overrides: { setItem?: (key: string, value: string) => void } = {},
) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        get length() {
          return Object.keys(entries).length
        },
        key(index: number) {
          return Object.keys(entries)[index] ?? null
        },
        getItem(key: string) {
          return entries[key] ?? null
        },
        setItem(key: string, value: string) {
          if (overrides.setItem) {
            overrides.setItem(key, value)
            return
          }
          entries[key] = value
        },
        removeItem(key: string) {
          delete entries[key]
        },
      },
    },
  })
  return () => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      delete (globalThis as { window?: unknown }).window
    }
  }
}
