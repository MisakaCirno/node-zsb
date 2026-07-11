/**
 * Editor-only labels and search aliases for objects shown in the palette.
 *
 * This metadata must not be written to Board, Project, or share-code data.
 */
export interface ObjectCatalogEntry {
  displayName: string
  keywords: readonly string[]
}

function entry(displayName: string, ...keywords: string[]): ObjectCatalogEntry {
  return { displayName, keywords }
}

export const BUILT_IN_OBJECT_TYPES = [
  'text',
  'line',
  'line_aoe',
  'circle_aoe',
  'fan_aoe',
  'donut',
] as const

export const OBJECT_CATALOG: Readonly<Record<string, ObjectCatalogEntry>> = {
  // Roles
  tank: entry('防护职业', '坦克', 'T'),
  tank_1: entry('防护职业 1', '坦克 1', 'T1'),
  tank_2: entry('防护职业 2', '坦克 2', 'T2'),
  healer: entry('治疗职业', '治疗', '奶妈', 'H'),
  healer_1: entry('治疗职业 1', '治疗 1', 'H1'),
  healer_2: entry('治疗职业 2', '治疗 2', 'H2'),
  pure_healer: entry('纯治疗职业', '纯奶', '纯治疗'),
  barrier_healer: entry('护盾治疗职业', '盾奶', '护盾治疗'),
  dps: entry('输出职业', '输出', 'DPS'),
  dps_1: entry('输出职业 1', '输出 1', 'D1'),
  dps_2: entry('输出职业 2', '输出 2', 'D2'),
  dps_3: entry('输出职业 3', '输出 3', 'D3'),
  dps_4: entry('输出职业 4', '输出 4', 'D4'),
  melee_dps: entry('近战输出职业', '近战', '近战 DPS'),
  ranged_dps: entry('远程输出职业', '远程', '远程 DPS'),
  physical_ranged_dps: entry('远程物理职业', '远敏', '物理远程'),
  magical_ranged_dps: entry('远程魔法职业', '法系', '魔法远程'),

  // Jobs and classes
  paladin: entry('骑士', '剑骑', 'PLD'),
  warrior: entry('战士', '战坦', 'WAR'),
  dark_knight: entry('暗黑骑士', '黑骑', 'DK', 'DRK'),
  gunbreaker: entry('绝枪战士', '绝枪', '枪刃', 'GNB'),
  white_mage: entry('白魔法师', '白魔', 'WHM'),
  scholar: entry('学者', 'SCH'),
  astrologian: entry('占星术士', '占星', 'AST'),
  sage: entry('贤者', 'SGE'),
  monk: entry('武僧', 'MNK'),
  dragoon: entry('龙骑士', '龙骑', 'DRG'),
  ninja: entry('忍者', 'NIN'),
  samurai: entry('武士', 'SAM'),
  reaper: entry('钐镰客', '镰刀', 'RPR'),
  viper: entry('蝰蛇剑士', '蝰蛇', 'VPR'),
  bard: entry('吟游诗人', '诗人', 'BRD'),
  machinist: entry('机工士', '机工', 'MCH'),
  dancer: entry('舞者', 'DNC'),
  black_mage: entry('黑魔法师', '黑魔', 'BLM'),
  summoner: entry('召唤师', '召唤', 'SMN'),
  red_mage: entry('赤魔法师', '赤魔', 'RDM'),
  pictomancer: entry('绘灵法师', '绘灵', '画家', 'PCT'),
  blue_mage: entry('青魔法师', '青魔', 'BLU'),
  gladiator: entry('剑术师', '剑术'),
  marauder: entry('斧术师', '斧术'),
  conjurer: entry('幻术师', '幻术'),
  pugilist: entry('格斗家', '格斗'),
  lancer: entry('枪术师', '枪术'),
  rogue: entry('双剑师', '双剑'),
  archer: entry('弓箭手', '弓术'),
  thaumaturge: entry('咒术师', '咒术'),
  arcanist: entry('秘术师', '秘术'),

  // Mechanics
  gaze: entry('视线判定', '背对', '视线'),
  stack: entry('分摊', '集合', '分伤'),
  line_stack: entry('直线分摊', '直线分伤'),
  proximity: entry('距离衰减', '远离', '衰减'),
  stack_multi: entry('连续分摊', '多次分摊'),
  proximity_player: entry('玩家距离衰减', '点名衰减', '远离玩家'),
  tankbuster: entry('坦克死刑', '死刑', '坦克强攻'),
  radial_knockback: entry('圆形击退', '中心击退', '放射击退'),
  linear_knockback: entry('直线击退', '方向击退'),
  tower: entry('塔', '踩塔'),
  targeting: entry('点名', '锁定目标'),
  moving_circle_aoe: entry('移动圆形范围', '移动 AOE', '追踪范围'),
  '1person_aoe': entry('1 人范围', '单人范围', '单人 AOE'),
  '2person_aoe': entry('2 人范围', '双人范围', '双人 AOE'),
  '3person_aoe': entry('3 人范围', '三人范围', '三人 AOE'),
  '4person_aoe': entry('4 人范围', '四人范围', '四人 AOE'),

  // Enemies and markers
  small_enemy: entry('小型敌人', '小怪', '敌人'),
  medium_enemy: entry('中型敌人', '中怪', '敌人'),
  large_enemy: entry('大型敌人', '大怪', '首领', 'BOSS'),
  enhancement: entry('强化效果', '增益', 'BUFF'),
  enfeeblement: entry('弱化效果', '减益', 'DEBUFF'),
  attack_1: entry('攻击标记 1', '攻击 1'),
  attack_2: entry('攻击标记 2', '攻击 2'),
  attack_3: entry('攻击标记 3', '攻击 3'),
  attack_4: entry('攻击标记 4', '攻击 4'),
  attack_5: entry('攻击标记 5', '攻击 5'),
  attack_6: entry('攻击标记 6', '攻击 6'),
  attack_7: entry('攻击标记 7', '攻击 7'),
  attack_8: entry('攻击标记 8', '攻击 8'),
  bind_1: entry('止步标记 1', '止步 1', '禁止移动 1'),
  bind_2: entry('止步标记 2', '止步 2', '禁止移动 2'),
  bind_3: entry('止步标记 3', '止步 3', '禁止移动 3'),
  ignore_1: entry('无视标记 1', '无视 1', '忽略 1'),
  ignore_2: entry('无视标记 2', '无视 2', '忽略 2'),
  square_marker: entry('方块标记', '方形标记', '方块'),
  circle_marker: entry('圆圈标记', '圆形标记', '圆圈'),
  plus_marker: entry('十字标记', '加号标记', '十字'),
  triangle_marker: entry('三角标记', '三角形标记', '三角'),
  waymark_a: entry('场地标记 A', '标点 A', '地标 A'),
  waymark_b: entry('场地标记 B', '标点 B', '地标 B'),
  waymark_c: entry('场地标记 C', '标点 C', '地标 C'),
  waymark_d: entry('场地标记 D', '标点 D', '地标 D'),
  waymark_1: entry('场地标记 1', '标点 1', '地标 1'),
  waymark_2: entry('场地标记 2', '标点 2', '地标 2'),
  waymark_3: entry('场地标记 3', '标点 3', '地标 3'),
  waymark_4: entry('场地标记 4', '标点 4', '地标 4'),
  lockon_red: entry('红色锁定标记', '红色点名', '红锁'),
  lockon_blue: entry('蓝色锁定标记', '蓝色点名', '蓝锁'),
  lockon_purple: entry('紫色锁定标记', '紫色点名', '紫锁'),
  lockon_green: entry('绿色锁定标记', '绿色点名', '绿锁'),

  // Icon shapes
  shape_circle: entry('圆形符号', '圆圈', '形状'),
  shape_x: entry('叉形符号', '叉号', 'X 形'),
  shape_triangle: entry('三角符号', '三角形', '形状'),
  shape_square: entry('方形符号', '方块', '形状'),
  up_arrow: entry('向上箭头', '上箭头', '箭头'),
  rotate: entry('旋转符号', '旋转', '循环'),
  highlighted_circle: entry('高亮圆形符号', '高亮圆圈'),
  highlighted_x: entry('高亮叉形符号', '高亮叉号'),
  highlighted_square: entry('高亮方形符号', '高亮方块'),
  highlighted_triangle: entry('高亮三角符号', '高亮三角形'),
  rotate_clockwise: entry('顺时针旋转', '顺时针', '右旋'),
  rotate_counterclockwise: entry('逆时针旋转', '逆时针', '左旋'),

  // Ground patterns
  checkered_circle: entry('棋盘格圆形区域', '棋盘格', '圆形地面'),
  checkered_square: entry('棋盘格方形区域', '棋盘格', '方形地面'),
  grey_circle: entry('灰色圆形区域', '灰色地面', '圆形地面'),
  grey_square: entry('灰色方形区域', '灰色地面', '方形地面'),

  // Built-in board objects
  text: entry('文本', '文字', '标签'),
  line: entry('直线', '线段', '连线'),
  line_aoe: entry('直线范围', '矩形范围', '直线 AOE'),
  circle_aoe: entry('圆形范围', '圆形 AOE', '圆圈范围'),
  fan_aoe: entry('扇形范围', '扇形 AOE', '扇区'),
  donut: entry('环形范围', '月环', '甜甜圈', '环形 AOE'),
}

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
