import assert from 'node:assert/strict'
import test from 'node:test'

import { LOCAL_PRESETS_KEY } from '../../src/web/constants.js'
import { loadLocalPresets } from '../../src/web/storage.js'

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

function withLocalStorage(entries) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem(key) {
          return entries[key] ?? null
        },
        setItem(key, value) {
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
