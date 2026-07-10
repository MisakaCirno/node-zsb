import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanBoard, normalizeBoard } from '../../src/web/board.js'
import {
  stripEditorFields,
  stripPureBoardEditorFields,
} from '../../src/web/editorIds.js'
import {
  BUILT_IN_PROJECT_OBJECT_TYPES,
  PROJECT_FORMAT,
  createProjectFromBoard,
  createPureBoardFromProject,
  flattenProjectToBoard,
  normalizeProject,
  parseProjectJson,
  projectToJson,
} from '../../src/web/project.js'
import type { LayerNode } from '../../src/web/types.js'

test('normalizeBoard assigns stable editor ids and cleanBoard preserves game object flags', () => {
  const board = normalizeBoard({
    boardBackground: 'checkered',
    objects: [
      { type: 'tank', x: 100, y: 120, hidden: true },
      { type: 'healer', x: 140, y: 160, editorId: 'obj_existing', locked: true },
    ],
  })

  assert.match(board.objects[0]?.editorId ?? '', /^obj_/)
  assert.equal(board.objects[1]!.editorId, 'obj_existing')
  const cleaned = cleanBoard(board)
  assert.equal(cleaned.objects[0]!.editorId, undefined)
  assert.equal(cleaned.objects[0]!.hidden, true)
  assert.equal(cleaned.objects[1]!.locked, true)
})

test('editor field stripping keeps game-native hidden and locked flags', () => {
  const object = {
    type: 'tank',
    x: 1,
    y: 2,
    editorId: 'obj_a',
    hidden: true,
    locked: true,
  }

  assert.deepEqual(stripEditorFields(object), {
    type: 'tank',
    x: 1,
    y: 2,
    hidden: true,
    locked: true,
  })
  assert.deepEqual(stripPureBoardEditorFields(object), {
    type: 'tank',
    x: 1,
    y: 2,
    hidden: true,
    locked: true,
  })
})

test('cleanBoard applies game-compatible object fields', () => {
  const board = normalizeBoard({
    boardBackground: 'checkered',
    objects: [
      { type: 'text', x: 100.24, y: 120.26, text: '123456789012345678901234567890X\nnext', size: 160, angle: 45 },
      { type: 'line', x: 120.24, y: 140.26, endX: 200.24, endY: 180.26, size: 20, angle: 45 },
      { type: 'circle_aoe', x: 150, y: 150, size: 5, color: '#123456', transparency: 120 },
      { type: 'line_aoe', x: 160, y: 160, size: 250, width: 1, height: 500, angle: 315, transparency: 150 },
      { type: 'fan_aoe', x: 200, y: 180, arcAngle: 999 },
      { type: 'donut', x: 220, y: 180, size: 5, angle: -181, color: '#123456', donutRadius: 500 },
      { type: 'donut', x: 320, y: 180, donutRadius: 80, arcAngle: 180 },
    ],
  })
  const cleaned = cleanBoard(board)

  assert.deepEqual(cleaned.objects.map((object) => ({
    type: object.type,
    size: object.size,
    angle: object.angle,
    arcAngle: object.arcAngle,
    width: object.width,
    height: object.height,
    color: object.color,
    text: object.text,
    donutRadius: object.donutRadius,
    transparency: object.transparency,
  })), [
    { type: 'text', size: undefined, angle: undefined, arcAngle: undefined, width: undefined, height: undefined, color: '#FFFFFF', text: '123456789012345678901234567890', donutRadius: undefined, transparency: 0 },
    { type: 'line', size: 50, angle: undefined, arcAngle: undefined, width: undefined, height: undefined, color: '#FF7F00', text: undefined, donutRadius: undefined, transparency: 0 },
    { type: 'circle_aoe', size: 10, angle: undefined, arcAngle: undefined, width: undefined, height: undefined, color: undefined, text: undefined, donutRadius: undefined, transparency: 100 },
    { type: 'line_aoe', size: 100, angle: -45, arcAngle: undefined, width: 16, height: 384, color: '#FF7F00', text: undefined, donutRadius: undefined, transparency: 100 },
    { type: 'fan_aoe', size: 100, angle: undefined, arcAngle: 360, width: undefined, height: undefined, color: undefined, text: undefined, donutRadius: undefined, transparency: 0 },
    { type: 'donut', size: 10, angle: 179, arcAngle: 360, width: undefined, height: undefined, color: undefined, text: undefined, donutRadius: 240, transparency: 0 },
    { type: 'donut', size: 100, angle: undefined, arcAngle: 180, width: undefined, height: undefined, color: undefined, text: undefined, donutRadius: 80, transparency: 0 },
  ])
  assert.deepEqual(cleaned.objects.map((object) => ({
    type: object.type,
    x: object.x,
    y: object.y,
    endX: object.endX,
    endY: object.endY,
  })), [
    { type: 'text', x: 100.2, y: 120.3, endX: undefined, endY: undefined },
    { type: 'line', x: 120.2, y: 140.3, endX: 200.2, endY: 180.3 },
    { type: 'circle_aoe', x: 150, y: 150, endX: undefined, endY: undefined },
    { type: 'line_aoe', x: 160, y: 160, endX: undefined, endY: undefined },
    { type: 'fan_aoe', x: 200, y: 180, endX: undefined, endY: undefined },
    { type: 'donut', x: 220, y: 180, endX: undefined, endY: undefined },
    { type: 'donut', x: 320, y: 180, endX: undefined, endY: undefined },
  ])
})

test('project files keep editor metadata separate from pure boards', () => {
  const project = createProjectFromBoard({
    name: 'P1',
    boardBackground: 'checkered',
    objects: [
      { type: 'tank', x: 100, y: 120, editorId: 'obj_a', hidden: true },
      { type: 'healer', x: 140, y: 160, editorId: 'obj_b' },
    ],
  }, {
    fileName: 'phase-one',
  })

  assert.equal(project.format, PROJECT_FORMAT)
  assert.equal(project.fileName, 'phase-one')
  assert.deepEqual(project.layers, [
    { type: 'object', id: 'obj_a' },
    { type: 'object', id: 'obj_b' },
  ])
  assert.equal(project.objects.obj_a!.editorId, undefined)
  assert.equal(project.objects.obj_a!.hidden, true)

  const board = flattenProjectToBoard(project)
  assert.equal(board.objects[0]!.editorId, 'obj_a')
  assert.equal(createPureBoardFromProject(project).objects[0]!.editorId, undefined)
})

test('createProjectFromBoard preserves a supplied layer tree', () => {
  const project = createProjectFromBoard({
    name: 'Grouped',
    boardBackground: 'checkered',
    objects: [
      { type: 'tank', x: 100, y: 120, editorId: 'obj_a' },
      { type: 'healer', x: 140, y: 160, editorId: 'obj_b' },
    ],
  }, {
    layerTree: [
      {
        type: 'group',
        id: 'grp_1',
        name: 'Group 1',
        children: [
          { type: 'object', id: 'obj_b' },
        ],
      },
    ],
  })

  assert.equal(project.layers[0]!.type, 'group')
  assert.deepEqual(
    flattenProjectToBoard(project).objects.map((object) => object.editorId),
    ['obj_b', 'obj_a'],
  )
})

test('flattenProjectToBoard applies inherited group hidden and locked flags', () => {
  const board = flattenProjectToBoard({
    format: PROJECT_FORMAT,
    version: 1,
    board: { name: 'Flags', boardBackground: 'checkered' },
    objects: {
      obj_a: { type: 'tank', x: 1, y: 2 },
      obj_b: { type: 'healer', x: 3, y: 4, hidden: true },
    },
    layers: [
      {
        type: 'group',
        id: 'grp_1',
        name: 'Locked',
        hidden: true,
        locked: true,
        children: [
          { type: 'object', id: 'obj_a' },
          { type: 'object', id: 'obj_b' },
        ],
      },
    ],
  })

  assert.equal(board.objects[0]!.hidden, true)
  assert.equal(board.objects[0]!.locked, true)
  assert.equal(board.objects[1]!.hidden, true)
  assert.equal(board.objects[1]!.locked, true)
})

test('project normalization supports nested groups and preserves flattened order', () => {
  const project = normalizeProject({
    format: PROJECT_FORMAT,
    version: 1,
    board: { name: 'Nested', boardBackground: 'checkered' },
    objects: {
      obj_a: { type: 'tank', x: 1, y: 2 },
      obj_b: { type: 'healer', x: 3, y: 4 },
      obj_c: { type: 'dps', x: 5, y: 6 },
    },
    layers: [
      {
        type: 'group',
        id: 'grp_1',
        name: 'Group 1',
        collapsed: true,
        children: [
          { type: 'object', id: 'obj_b' },
          { type: 'object', id: 'obj_a' },
        ],
      },
    ],
  })

  assert.equal(project.layers[0]!.type, 'group')
  assert.deepEqual(
    flattenProjectToBoard(project).objects.map((object) => object.editorId),
    ['obj_b', 'obj_a', 'obj_c'],
  )
  assert.match(projectToJson(project), /"format": "node-zsb-project"/)
})

test('project normalization deduplicates object references and group ids', () => {
  const project = normalizeProject({
    format: PROJECT_FORMAT,
    version: 1,
    board: { name: 'Duplicated', boardBackground: 'checkered' },
    objects: {
      obj_a: { type: 'tank', x: 1, y: 2 },
      obj_b: { type: 'healer', x: 3, y: 4 },
    },
    layers: [
      {
        type: 'group',
        id: 'grp_dup',
        name: 'First',
        children: [
          { type: 'object', id: 'obj_a' },
          { type: 'object', id: 'obj_a' },
          {
            type: 'group',
            id: 'grp_dup',
            name: 'Nested',
            children: [
              { type: 'object', id: 'obj_b' },
            ],
          },
        ],
      },
      {
        type: 'group',
        id: 'grp_dup',
        name: 'Second',
        children: [
          { type: 'object', id: 'obj_b' },
        ],
      },
    ],
  })

  assert.deepEqual(collectGroupIds(project.layers), [
    'grp_dup',
    'grp_dup_2',
    'grp_dup_3',
  ])
  assert.deepEqual(
    flattenProjectToBoard(project).objects.map((object) => object.editorId),
    ['obj_a', 'obj_b'],
  )
})

test('strict project parsing rejects future versions with an editor update message', () => {
  const project = createStrictProject()
  project.version = 2

  assert.throws(
    () => parseStrictProject(project),
    /需要更新编辑器/,
  )
  assert.equal(normalizeProject(project).version, 1)
})

test('strict project parsing rejects missing and unknown object types with the object id', () => {
  const missingType = createStrictProject()
  delete missingType.objects.obj_a!.type
  assert.throws(
    () => parseStrictProject(missingType),
    /对象“obj_a”缺少有效的 type/,
  )

  const unknownType = createStrictProject()
  unknownType.objects.obj_a!.type = 'future_icon'
  assert.throws(
    () => parseStrictProject(unknownType),
    /对象“obj_a”的类型“future_icon”不受支持/,
  )
})

test('strict project parsing rejects invalid and duplicate layer references', () => {
  const missingObject = createStrictProject()
  missingObject.layers = [{ type: 'object', id: 'obj_missing' }]
  assert.throws(
    () => parseStrictProject(missingObject),
    /不存在的对象“obj_missing”/,
  )

  const duplicateReference = createStrictProject()
  duplicateReference.layers = [
    { type: 'object', id: 'obj_a' },
    { type: 'object', id: 'obj_a' },
  ]
  assert.throws(
    () => parseStrictProject(duplicateReference),
    /图层节点 ID“obj_a”重复/,
  )

  const unreferencedObject = createStrictProject()
  unreferencedObject.objects.obj_b = { type: 'healer', x: 3, y: 4 }
  assert.throws(
    () => parseStrictProject(unreferencedObject),
    /对象“obj_b”未被任何图层引用/,
  )

  const unsafeId = createStrictProject()
  unsafeId.objects = JSON.parse('{"__proto__":{"type":"tank","x":1,"y":2}}')
  unsafeId.layers = [{ type: 'object', id: '__proto__' }]
  assert.throws(
    () => parseStrictProject(unsafeId),
    /无效的对象 ID“__proto__”/,
  )
})

test('strict project parsing rejects non-finite-shaped coordinates and object overflow', () => {
  const invalidCoordinate = createStrictProject()
  invalidCoordinate.objects.obj_a!.x = '12' as unknown as number
  assert.throws(
    () => parseStrictProject(invalidCoordinate),
    /对象“obj_a”的坐标 x 必须是有限数字/,
  )

  const overflow = createStrictProject()
  overflow.objects = {}
  overflow.layers = []
  for (let index = 0; index < 51; index += 1) {
    const id = `obj_${index}`
    overflow.objects[id] = { type: 'tank', x: index, y: index }
    overflow.layers.push({ type: 'object', id })
  }
  assert.throws(
    () => parseStrictProject(overflow),
    /对象数量超过上限 50/,
  )
})

test('strict project parsing accepts valid nested groups and configured icon types', () => {
  const project = createStrictProject()
  project.objects.obj_b = { type: 'healer', x: 3, y: 4 }
  project.layers = [
    {
      type: 'group',
      id: 'grp_outer',
      name: 'Outer',
      children: [
        { type: 'object', id: 'obj_a' },
        {
          type: 'group',
          id: 'grp_inner',
          name: 'Inner',
          collapsed: true,
          children: [
            { type: 'object', id: 'obj_b' },
          ],
        },
      ],
    },
  ]

  const parsed = parseStrictProject(project)

  assert.deepEqual(collectGroupIds(parsed.layers), ['grp_outer', 'grp_inner'])
  assert.deepEqual(
    flattenProjectToBoard(parsed).objects.map((object) => object.editorId),
    ['obj_a', 'obj_b'],
  )
})

function collectGroupIds(nodes: LayerNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === 'group'
      ? [node.id, ...collectGroupIds(node.children)]
      : [])
}

function createStrictProject() {
  return {
    format: PROJECT_FORMAT,
    version: 1,
    fileName: 'strict-project',
    board: {
      name: 'Strict',
      boardBackground: 'checkered',
    },
    objects: {
      obj_a: { type: 'tank', x: 1, y: 2 } as Record<string, unknown>,
    } as Record<string, Record<string, unknown>>,
    layers: [
      { type: 'object', id: 'obj_a' },
    ] as LayerNode[],
  }
}

function parseStrictProject(project: ReturnType<typeof createStrictProject>) {
  return parseProjectJson(JSON.stringify(project), {
    allowedObjectTypes: new Set([
      ...BUILT_IN_PROJECT_OBJECT_TYPES,
      'tank',
      'healer',
      'dps',
    ]),
  })
}
