import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EDITOR_SETTINGS_KEY,
  LOCAL_FILES_KEY,
  LOCAL_PRESETS_KEY,
  STORAGE_KEY,
} from '../../src/web/constants.js'
import {
  getProjectStorageUsage,
  loadLocalPresets,
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

    assert.equal(preset.objects.text_a.editorId, undefined)
    assert.equal(preset.objects.text_a.size, undefined)
    assert.equal(preset.objects.text_a.angle, undefined)
    assert.equal(preset.objects.line_aoe_a.width, 512)
    assert.equal(preset.objects.line_aoe_a.height, 16)
    assert.equal(preset.objects.line_aoe_a.transparency, 100)
  } finally {
    restoreLocalStorage()
  }
})

test('persistLocalFilesDetailed saves beyond the old fixed file count', () => {
  const restoreLocalStorage = withLocalStorage({})
  try {
    const files = Array.from({ length: 25 }, (_, index) => ({
      name: `File ${index + 1}`,
      board: { objects: [] },
    }))

    assert.deepEqual(persistLocalFilesDetailed(files), { ok: true })
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_FILES_KEY))
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
      { name: 'Full', board: { objects: [] } },
    ])

    assert.deepEqual(result, { ok: false, reason: 'quota' })
    assert.equal(window.localStorage.getItem(LOCAL_FILES_KEY), '[]')
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
        key(index) {
          return Object.keys(entries)[index] ?? null
        },
        getItem(key) {
          return entries[key] ?? null
        },
        setItem(key, value) {
          if (overrides.setItem) {
            overrides.setItem(key, value)
            return
          }
          entries[key] = value
        },
      },
    },
  })
  return () => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      delete globalThis.window
    }
  }
}
