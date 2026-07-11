import {
  OBJECT_NAMES_ZH_CN,
} from './objectNamesZhCN.js'
import type {
  ObjectNameKey,
} from './objectNamesZhCN.js'

/**
 * Editor-only names and search aliases for objects shown in the palette.
 *
 * Display names live in the locale table. This metadata must not be written
 * to Board, Project, or share-code data.
 */
export interface ObjectCatalogEntry {
  displayName: string
  keywords: readonly string[]
}

function aliases(...values: string[]): readonly string[] {
  return values
}

export const BUILT_IN_OBJECT_TYPES = [
  'text',
  'line',
  'line_aoe',
  'circle_aoe',
  'fan_aoe',
  'donut',
] as const

const OBJECT_SEARCH_KEYWORDS = {
  // 职业/特职
  tank: aliases('坦克', 'T'),
  tank_1: aliases('坦克 1', 'T1'),
  tank_2: aliases('坦克 2', 'T2'),
  healer: aliases('治疗', '奶妈', 'H'),
  healer_1: aliases('治疗 1', 'H1'),
  healer_2: aliases('治疗 2', 'H2'),
  pure_healer: aliases('纯奶', '纯治疗', '纯治疗职业'),
  barrier_healer: aliases('盾奶', '护盾治疗', '护盾治疗职业'),
  dps: aliases('输出', '输出职业', 'DPS'),
  dps_1: aliases('输出 1', '输出职业 1', 'D1'),
  dps_2: aliases('输出 2', '输出职业 2', 'D2'),
  dps_3: aliases('输出 3', '输出职业 3', 'D3'),
  dps_4: aliases('输出 4', '输出职业 4', 'D4'),
  melee_dps: aliases('近战', '近战 DPS', '近战输出职业'),
  ranged_dps: aliases('远程', '远程 DPS', '远程输出职业'),
  physical_ranged_dps: aliases('远敏', '物理远程'),
  magical_ranged_dps: aliases('法系', '魔法远程'),
  paladin: aliases('剑骑', 'PLD'),
  warrior: aliases('战坦', 'WAR'),
  dark_knight: aliases('黑骑', 'DK', 'DRK'),
  gunbreaker: aliases('绝枪', '枪刃', 'GNB'),
  white_mage: aliases('白魔', 'WHM'),
  scholar: aliases('SCH'),
  astrologian: aliases('占星', 'AST'),
  sage: aliases('SGE'),
  monk: aliases('MNK'),
  dragoon: aliases('龙骑', 'DRG'),
  ninja: aliases('NIN'),
  samurai: aliases('SAM'),
  reaper: aliases('镰刀', 'RPR'),
  viper: aliases('蝰蛇', 'VPR'),
  bard: aliases('诗人', 'BRD'),
  machinist: aliases('机工', 'MCH'),
  dancer: aliases('DNC'),
  black_mage: aliases('黑魔', 'BLM'),
  summoner: aliases('召唤', 'SMN'),
  red_mage: aliases('赤魔', 'RDM'),
  pictomancer: aliases('绘灵', '画家', 'PCT'),
  blue_mage: aliases('青魔', 'BLU'),
  gladiator: aliases('剑术'),
  marauder: aliases('斧术'),
  conjurer: aliases('幻术'),
  pugilist: aliases('格斗'),
  lancer: aliases('枪术'),
  rogue: aliases('双剑'),
  archer: aliases('弓术'),
  thaumaturge: aliases('咒术'),
  arcanist: aliases('秘术'),

  // 机制
  gaze: aliases('背对', '视线'),
  stack: aliases('集合', '分伤'),
  line_stack: aliases('直线分伤'),
  proximity: aliases('远离', '衰减'),
  stack_multi: aliases('多次分摊'),
  proximity_player: aliases('点名衰减', '远离玩家'),
  tankbuster: aliases('死刑', '坦克强攻'),
  radial_knockback: aliases('中心击退', '放射击退'),
  linear_knockback: aliases('方向击退'),
  tower: aliases('踩塔'),
  targeting: aliases('锁定目标'),
  moving_circle_aoe: aliases('移动 AOE', '追踪范围'),
  '1person_aoe': aliases('单人范围', '单人 AOE'),
  '2person_aoe': aliases('双人范围', '双人 AOE'),
  '3person_aoe': aliases('三人范围', '三人 AOE'),
  '4person_aoe': aliases('四人范围', '四人 AOE'),

  // 标记
  small_enemy: aliases('小怪', '敌人'),
  medium_enemy: aliases('中怪', '敌人'),
  large_enemy: aliases('大怪', '首领', 'BOSS'),
  enhancement: aliases('增益', 'BUFF'),
  enfeeblement: aliases('减益', 'DEBUFF'),
  attack_1: aliases('攻击 1'),
  attack_2: aliases('攻击 2'),
  attack_3: aliases('攻击 3'),
  attack_4: aliases('攻击 4'),
  attack_5: aliases('攻击 5'),
  attack_6: aliases('攻击 6'),
  attack_7: aliases('攻击 7'),
  attack_8: aliases('攻击 8'),
  bind_1: aliases('止步 1', '禁止移动 1'),
  bind_2: aliases('止步 2', '禁止移动 2'),
  bind_3: aliases('止步 3', '禁止移动 3'),
  ignore_1: aliases('无视 1', '忽略 1'),
  ignore_2: aliases('无视 2', '忽略 2'),
  square_marker: aliases('方形标记', '方块'),
  circle_marker: aliases('圆形标记', '圆圈'),
  plus_marker: aliases('加号标记', '十字'),
  triangle_marker: aliases('三角形标记', '三角'),
  waymark_a: aliases('标点 A', '地标 A'),
  waymark_b: aliases('标点 B', '地标 B'),
  waymark_c: aliases('标点 C', '地标 C'),
  waymark_d: aliases('标点 D', '地标 D'),
  waymark_1: aliases('标点 1', '地标 1'),
  waymark_2: aliases('标点 2', '地标 2'),
  waymark_3: aliases('标点 3', '地标 3'),
  waymark_4: aliases('标点 4', '地标 4'),
  lockon_red: aliases('红色点名', '红锁'),
  lockon_blue: aliases('蓝色点名', '蓝锁'),
  lockon_purple: aliases('紫色点名', '紫锁'),
  lockon_green: aliases('绿色点名', '绿锁'),

  // 形状
  shape_circle: aliases('圆圈', '形状'),
  shape_x: aliases('叉号', 'X 形'),
  shape_triangle: aliases('三角形', '形状'),
  shape_square: aliases('方块', '形状'),
  up_arrow: aliases('上箭头', '箭头'),
  rotate: aliases('旋转', '循环'),
  highlighted_circle: aliases('高亮圆圈'),
  highlighted_x: aliases('高亮叉号'),
  highlighted_square: aliases('高亮方块'),
  highlighted_triangle: aliases('高亮三角形'),
  rotate_clockwise: aliases('顺时针', '右旋'),
  rotate_counterclockwise: aliases('逆时针', '左旋'),

  // 地面
  checkered_circle: aliases('棋盘格', '圆形地面'),
  checkered_square: aliases('棋盘格', '方形地面'),
  grey_circle: aliases('灰色地面', '圆形地面'),
  grey_square: aliases('灰色地面', '方形地面'),

  // 编辑器内建对象
  text: aliases('文字', '标签'),
  line: aliases('线段', '连线'),
  line_aoe: aliases('矩形范围', '直线 AOE'),
  circle_aoe: aliases('圆形 AOE', '圆圈范围'),
  fan_aoe: aliases('扇形 AOE', '扇区'),
  donut: aliases('月环', '甜甜圈', '环形 AOE'),
} satisfies Record<ObjectNameKey, readonly string[]>

export const OBJECT_CATALOG: Readonly<Record<string, ObjectCatalogEntry>> = Object.fromEntries(
  (Object.entries(OBJECT_NAMES_ZH_CN) as Array<[ObjectNameKey, string]>).map(([type, displayName]) => [
    type,
    {
      displayName,
      keywords: OBJECT_SEARCH_KEYWORDS[type],
    },
  ]),
)

export function getObjectCatalogEntry(type: string): ObjectCatalogEntry | undefined {
  return OBJECT_CATALOG[type]
}

export function getObjectDisplayName(type: string): string {
  return getObjectCatalogEntry(type)?.displayName ?? type
}

export function matchesObjectSearch(type: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const metadata = getObjectCatalogEntry(type)
  const fields = [type, metadata?.displayName ?? '', ...(metadata?.keywords ?? [])]
    .map(normalizeSearchText)
    .filter(Boolean)
  const normalizedIndex = fields.join(' ')
  const compactIndex = compactSearchText(normalizedIndex)

  return normalizedQuery.split(' ').every((term) => (
    normalizedIndex.includes(term) || compactIndex.includes(compactSearchText(term))
  ))
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactSearchText(value: string): string {
  return value.replace(/\s+/g, '')
}
