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
  OBJECT_ALIASES_ZH_CN,
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

const EXPECTED_ATTACK_RANGE_NAMES = {
  gaze: '视线攻击',
  stack: '分摊伤害攻击',
  line_stack: '分摊伤害攻击：直线型',
  proximity: '距离衰减攻击',
  stack_multi: '分摊伤害攻击：连续型',
  proximity_player: '距离衰减攻击：特定对象型',
  tankbuster: '强攻击',
  radial_knockback: '击退攻击：放射型',
  linear_knockback: '击退攻击：直线型',
  tower: '踩塔机制',
  targeting: '针对目标的预兆',
  moving_circle_aoe: '圆形范围攻击：移动型',
  '1person_aoe': '1人用区域',
  '2person_aoe': '2人用区域',
  '3person_aoe': '3人用区域',
  '4person_aoe': '4人用区域',
  line_aoe: '直线范围攻击',
  circle_aoe: '圆形范围攻击',
  fan_aoe: '扇形范围攻击',
  donut: '环形范围攻击',
} as const

const EXPECTED_ICON_AND_MARKER_NAMES = {
  small_enemy: '小型敌人',
  medium_enemy: '中型敌人',
  large_enemy: '大型敌人',
  enhancement: '强化状态',
  enfeeblement: '弱化状态',
  attack_1: '攻击1',
  attack_2: '攻击2',
  attack_3: '攻击3',
  attack_4: '攻击4',
  attack_5: '攻击5',
  attack_6: '攻击6',
  attack_7: '攻击7',
  attack_8: '攻击8',
  bind_1: '止步1',
  bind_2: '止步2',
  bind_3: '止步3',
  ignore_1: '禁止1',
  ignore_2: '禁止2',
  square_marker: '方块',
  circle_marker: '圆圈',
  plus_marker: '十字',
  triangle_marker: '三角',
  waymark_a: '场景标记A',
  waymark_b: '场景标记B',
  waymark_c: '场景标记C',
  waymark_d: '场景标记D',
  waymark_1: '场景标记1',
  waymark_2: '场景标记2',
  waymark_3: '场景标记3',
  waymark_4: '场景标记4',
  lockon_red: '瞄准标记（红色）',
  lockon_blue: '瞄准标记（蓝色）',
  lockon_purple: '瞄准标记（紫色）',
  lockon_green: '瞄准标记（绿色）',
} as const

const EXPECTED_SHAPE_AND_SYMBOL_NAMES = {
  shape_circle: '圆圈',
  shape_x: '叉',
  shape_triangle: '三角',
  shape_square: '方块',
  up_arrow: '箭头',
  rotate: '旋转',
  highlighted_circle: '高光圆圈',
  highlighted_x: '高光叉',
  highlighted_square: '高光方块',
  highlighted_triangle: '高光三角',
  rotate_clockwise: '顺时针旋转',
  rotate_counterclockwise: '逆时针旋转',
  text: '文字',
  line: '线',
} as const

const EXPECTED_FIELD_NAMES = {
  checkered_circle: '圆形格子底',
  checkered_square: '正方形格子底',
  grey_circle: '圆形灰底',
  grey_square: '正方形灰底',
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
    assert.equal(getObjectDisplayName(type), metadata.displayName)
    assert.equal(metadata.displayName, OBJECT_NAMES_ZH_CN[type as ObjectNameKey])
    assert.deepEqual(metadata.keywords, OBJECT_ALIASES_ZH_CN[type as ObjectNameKey])
  }
})

test('role and job names match the in-game Simplified Chinese labels', () => {
  assert.deepEqual(Object.keys(EXPECTED_ROLE_AND_JOB_NAMES), iconGroups.rolesAndJobs)
  for (const [type, expectedName] of Object.entries(EXPECTED_ROLE_AND_JOB_NAMES)) {
    assert.equal(OBJECT_NAMES_ZH_CN[type as ObjectNameKey], expectedName, type)
  }
})

test('remaining object names match the in-game Simplified Chinese labels', () => {
  const expectedGroups = [
    EXPECTED_ATTACK_RANGE_NAMES,
    EXPECTED_ICON_AND_MARKER_NAMES,
    EXPECTED_SHAPE_AND_SYMBOL_NAMES,
    EXPECTED_FIELD_NAMES,
  ]
  const expectedTypes = expectedGroups.flatMap((group) => Object.keys(group))
  const remainingKnownTypes = KNOWN_TYPES.filter((type) => !iconGroups.rolesAndJobs.includes(type))
  assert.deepEqual([...expectedTypes].sort(), [...remainingKnownTypes].sort())
  for (const group of expectedGroups) {
    for (const [type, expectedName] of Object.entries(group)) {
      assert.equal(OBJECT_NAMES_ZH_CN[type as ObjectNameKey], expectedName, type)
    }
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
  assert.equal(matchesObjectSearch('dps_4', '输出职业 4'), false)
  assert.equal(matchesObjectSearch('barrier_healer', '护罩治疗职业'), true)
  assert.equal(matchesObjectSearch('barrier_healer', '护盾治疗职业'), false)
  assert.deepEqual(OBJECT_ALIASES_ZH_CN.dps, ['输出', 'DPS'])
  assert.equal(matchesObjectSearch('targeting', '针对目标的预兆'), true)
  assert.equal(matchesObjectSearch('lockon_green', '瞄准标记 绿色'), true)
  assert.equal(matchesObjectSearch('text', '文字'), true)
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
