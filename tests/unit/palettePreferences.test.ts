import assert from 'node:assert/strict'
import test from 'node:test'

import { PALETTE_PREFERENCES_KEY } from '../../src/web/constants.js'
import {
  MAX_RECENT_OBJECT_TYPES,
  loadRecentObjectTypes,
  rememberRecentObjectType,
} from '../../src/web/palettePreferences.js'

test('palette preferences normalize, deduplicate, and cap recent object types', () => {
  const entries = {
    [PALETTE_PREFERENCES_KEY]: JSON.stringify({
      version: 1,
      recentObjectTypes: [' tank ', '', 'healer', 'tank', ...Array.from(
        { length: MAX_RECENT_OBJECT_TYPES + 5 },
        (_, index) => `type_${index}`,
      )],
    }),
  }
  const restore = withLocalStorage(entries)
  try {
    const recent = loadRecentObjectTypes()
    assert.equal(recent[0], 'tank')
    assert.equal(recent[1], 'healer')
    assert.equal(recent.length, MAX_RECENT_OBJECT_TYPES)
  } finally {
    restore()
  }
})

test('rememberRecentObjectType moves used types to the front and persists once', () => {
  const entries = {
    [PALETTE_PREFERENCES_KEY]: JSON.stringify({
      version: 1,
      recentObjectTypes: ['tank', 'healer'],
    }),
  }
  const restore = withLocalStorage(entries)
  try {
    assert.equal(rememberRecentObjectType('healer'), true)
    assert.deepEqual(loadRecentObjectTypes(), ['healer', 'tank'])
    assert.equal(rememberRecentObjectType('healer'), false)
  } finally {
    restore()
  }
})

function withLocalStorage(entries: Record<string, string>) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          return entries[key] ?? null
        },
        setItem(key: string, value: string) {
          entries[key] = value
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
