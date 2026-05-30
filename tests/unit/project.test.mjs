import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanBoard, normalizeBoard } from '../../src/web/board.js'
import {
  PROJECT_FORMAT,
  createProjectFromBoard,
  createPureBoardFromProject,
  flattenProjectToBoard,
  normalizeProject,
  projectToJson,
} from '../../src/web/project.js'

test('normalizeBoard assigns stable editor ids and cleanBoard strips editor-only fields', () => {
  const board = normalizeBoard({
    boardBackground: 'checkered',
    objects: [
      { type: 'tank', x: 100, y: 120, hidden: true },
      { type: 'healer', x: 140, y: 160, editorId: 'obj_existing', locked: true },
    ],
  })

  assert.match(board.objects[0].editorId, /^obj_/)
  assert.equal(board.objects[1].editorId, 'obj_existing')
  assert.equal(cleanBoard(board).objects[0].editorId, undefined)
  assert.equal(cleanBoard(board).objects[0].hidden, undefined)
  assert.equal(cleanBoard(board).objects[1].locked, undefined)
})

test('cleanBoard applies game-compatible object fields', () => {
  const board = normalizeBoard({
    boardBackground: 'checkered',
    objects: [
      { type: 'text', x: 100, y: 120, text: 'label', size: 160, angle: 45 },
      { type: 'line', x: 120, y: 140, endX: 200, endY: 180, size: 20, angle: 45 },
      { type: 'circle_aoe', x: 150, y: 150, size: 5, color: '#123456', transparency: 120 },
      { type: 'line_aoe', x: 160, y: 160, size: 250, width: 1, height: 500, angle: 315, transparency: 150 },
      { type: 'donut', x: 220, y: 180, size: 5, angle: -181, color: '#123456', donutRadius: 500 },
      { type: 'donut', x: 320, y: 180, donutRadius: 80, arcAngle: 180 },
    ],
  })

  assert.deepEqual(cleanBoard(board).objects.map((object) => ({
    type: object.type,
    size: object.size,
    angle: object.angle,
    arcAngle: object.arcAngle,
    width: object.width,
    height: object.height,
    color: object.color,
    donutRadius: object.donutRadius,
    transparency: object.transparency,
  })), [
    { type: 'text', size: undefined, angle: undefined, arcAngle: undefined, width: undefined, height: undefined, color: '#FFFFFF', donutRadius: undefined, transparency: 0 },
    { type: 'line', size: 50, angle: undefined, arcAngle: undefined, width: undefined, height: undefined, color: '#FF7F00', donutRadius: undefined, transparency: 0 },
    { type: 'circle_aoe', size: 10, angle: undefined, arcAngle: undefined, width: undefined, height: undefined, color: undefined, donutRadius: undefined, transparency: 100 },
    { type: 'line_aoe', size: 100, angle: -45, arcAngle: undefined, width: 16, height: 384, color: '#FF7F00', donutRadius: undefined, transparency: 100 },
    { type: 'donut', size: 10, angle: 179, arcAngle: 360, width: undefined, height: undefined, color: undefined, donutRadius: 240, transparency: 0 },
    { type: 'donut', size: 100, angle: undefined, arcAngle: 180, width: undefined, height: undefined, color: undefined, donutRadius: 80, transparency: 0 },
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
  assert.equal(project.objects.obj_a.editorId, undefined)
  assert.equal(project.objects.obj_a.hidden, true)

  const board = flattenProjectToBoard(project)
  assert.equal(board.objects[0].editorId, 'obj_a')
  assert.equal(createPureBoardFromProject(project).objects[0].editorId, undefined)
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

  assert.equal(project.layers[0].type, 'group')
  assert.deepEqual(
    flattenProjectToBoard(project).objects.map((object) => object.editorId),
    ['obj_b', 'obj_a'],
  )
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

  assert.equal(project.layers[0].type, 'group')
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

function collectGroupIds(nodes) {
  return nodes.flatMap((node) =>
    node.type === 'group'
      ? [node.id, ...collectGroupIds(node.children)]
      : [])
}
