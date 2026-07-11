import assert from 'node:assert/strict'
import test from 'node:test'

import { iconGroups } from '../../src/server/utils/iconMap.js'
import {
  BUILT_IN_OBJECT_TYPES,
  getObjectCatalogEntry,
  getObjectDisplayName,
  matchesObjectSearch,
  OBJECT_CATALOG,
} from '../../src/web/objectCatalog.js'

const ICON_TYPES = Object.values(iconGroups).flat()
const PALETTE_BUILT_IN_TYPES = [
  'text',
  'line',
  'line_aoe',
  'circle_aoe',
  'fan_aoe',
  'donut',
] as const
const KNOWN_TYPES = [...ICON_TYPES, ...PALETTE_BUILT_IN_TYPES]

test('object catalog covers every palette icon and built-in object with a Chinese name', () => {
  assert.equal(ICON_TYPES.length, 114)
  assert.equal(BUILT_IN_OBJECT_TYPES.length, 6)
  assert.deepEqual(BUILT_IN_OBJECT_TYPES, PALETTE_BUILT_IN_TYPES)
  assert.equal(new Set(KNOWN_TYPES).size, KNOWN_TYPES.length)
  assert.equal(Object.keys(OBJECT_CATALOG).length, KNOWN_TYPES.length)

  for (const type of KNOWN_TYPES) {
    const metadata = getObjectCatalogEntry(type)
    assert.ok(metadata, `missing object catalog metadata for ${type}`)
    assert.match(metadata.displayName, /\p{Script=Han}/u, `${type} needs a Chinese display name`)
    assert.ok(metadata.keywords.length > 0, `${type} needs at least one search keyword`)
    assert.equal(getObjectDisplayName(type), metadata.displayName)
  }
})

test('object search normalizes English case, underscores, spaces, and Chinese labels', () => {
  for (const type of KNOWN_TYPES) {
    const displayName = getObjectDisplayName(type)
    assert.equal(matchesObjectSearch(type, type.toUpperCase()), true, type)
    assert.equal(matchesObjectSearch(type, type.replaceAll('_', ' ')), true, type)
    assert.equal(matchesObjectSearch(type, displayName), true, type)
  }

  assert.equal(matchesObjectSearch('dark_knight', 'darkknight'), true)
  assert.equal(matchesObjectSearch('dark_knight', '  黑骑  '), true)
  assert.equal(matchesObjectSearch('circle_aoe', '圆形 AOE'), true)
  assert.equal(matchesObjectSearch('line_stack', 'ＬＩＮＥ＿ＳＴＡＣＫ'), true)
  assert.equal(matchesObjectSearch('line_stack', '圆形'), false)
})

test('object catalog helpers remain safe for unknown future object types', () => {
  assert.equal(getObjectCatalogEntry('future_object'), undefined)
  assert.equal(getObjectDisplayName('future_object'), 'future_object')
  assert.equal(matchesObjectSearch('future_object', 'future object'), true)
  assert.equal(matchesObjectSearch('future_object', ''), true)
  assert.equal(matchesObjectSearch('future_object', '坦克'), false)
})
