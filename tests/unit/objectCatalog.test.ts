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
import {
  OBJECT_NAMES_ZH_CN,
} from '../../src/web/objectNamesZhCN.js'
import type {
  ObjectNameKey,
} from '../../src/web/objectNamesZhCN.js'

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

const EXPECTED_ROLE_AND_JOB_NAMES = {
  tank: '防护职业',
  tank_1: '防护职业1',
  tank_2: '防护职业2',
  healer: '治疗职业',
  healer_1: '治疗职业1',
  healer_2: '治疗职业2',
  pure_healer: '纯粹治疗职业',
  barrier_healer: '护罩治疗职业',
  dps: '进攻职业',
  dps_1: '进攻职业1',
  dps_2: '进攻职业2',
  dps_3: '进攻职业3',
  dps_4: '进攻职业4',
  melee_dps: '近战职业',
  ranged_dps: '远程职业',
  physical_ranged_dps: '远程物理职业',
  magical_ranged_dps: '远程魔法职业',
  paladin: '骑士',
  warrior: '战士',
  dark_knight: '暗黑骑士',
  gunbreaker: '绝枪战士',
  white_mage: '白魔法师',
  scholar: '学者',
  astrologian: '占星术士',
  sage: '贤者',
  monk: '武僧',
  dragoon: '龙骑士',
  ninja: '忍者',
  samurai: '武士',
  reaper: '钐镰客',
  viper: '蝰蛇剑士',
  bard: '吟游诗人',
  machinist: '机工士',
  dancer: '舞者',
  black_mage: '黑魔法师',
  summoner: '召唤师',
  red_mage: '赤魔法师',
  pictomancer: '绘灵法师',
  blue_mage: '青魔法师',
  gladiator: '剑术师',
  marauder: '斧术师',
  conjurer: '幻术师',
  pugilist: '格斗家',
  lancer: '枪术师',
  rogue: '双剑师',
  archer: '弓箭手',
  thaumaturge: '咒术师',
  arcanist: '秘术师',
} as const

test('object catalog covers every palette icon and built-in object with a Chinese name', () => {
  assert.equal(ICON_TYPES.length, 114)
  assert.equal(BUILT_IN_OBJECT_TYPES.length, 6)
  assert.deepEqual(BUILT_IN_OBJECT_TYPES, PALETTE_BUILT_IN_TYPES)
  assert.equal(new Set(KNOWN_TYPES).size, KNOWN_TYPES.length)
  assert.equal(Object.keys(OBJECT_CATALOG).length, KNOWN_TYPES.length)
  assert.deepEqual(Object.keys(OBJECT_NAMES_ZH_CN), KNOWN_TYPES)

  for (const type of KNOWN_TYPES) {
    const metadata = getObjectCatalogEntry(type)
    assert.ok(metadata, `missing object catalog metadata for ${type}`)
    assert.match(metadata.displayName, /\p{Script=Han}/u, `${type} needs a Chinese display name`)
    assert.ok(metadata.keywords.length > 0, `${type} needs at least one search keyword`)
    assert.equal(getObjectDisplayName(type), metadata.displayName)
    assert.equal(metadata.displayName, OBJECT_NAMES_ZH_CN[type as ObjectNameKey])
  }
})

test('role and job names match the in-game Simplified Chinese labels', () => {
  assert.deepEqual(Object.keys(EXPECTED_ROLE_AND_JOB_NAMES), iconGroups.rolesAndJobs)
  for (const [type, expectedName] of Object.entries(EXPECTED_ROLE_AND_JOB_NAMES)) {
    assert.equal(OBJECT_NAMES_ZH_CN[type as ObjectNameKey], expectedName, type)
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
  assert.equal(matchesObjectSearch('dps_4', '进攻职业4'), true)
  assert.equal(matchesObjectSearch('dps_4', '输出职业 4'), true)
  assert.equal(matchesObjectSearch('barrier_healer', '护罩治疗职业'), true)
  assert.equal(matchesObjectSearch('barrier_healer', '护盾治疗职业'), true)
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
