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

test('normalizeBoard assigns stable editor ids and cleanBoard strips them', () => {
  const board = normalizeBoard({
    boardBackground: 'checkered',
    objects: [
      { type: 'tank', x: 100, y: 120 },
      { type: 'healer', x: 140, y: 160, editorId: 'obj_existing' },
    ],
  })

  assert.match(board.objects[0].editorId, /^obj_/)
  assert.equal(board.objects[1].editorId, 'obj_existing')
  assert.equal(cleanBoard(board).objects[0].editorId, undefined)
})

test('project files keep editor metadata separate from pure boards', () => {
  const project = createProjectFromBoard({
    name: 'P1',
    boardBackground: 'checkered',
    objects: [
      { type: 'tank', x: 100, y: 120, editorId: 'obj_a' },
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

  const board = flattenProjectToBoard(project)
  assert.equal(board.objects[0].editorId, 'obj_a')
  assert.equal(createPureBoardFromProject(project).objects[0].editorId, undefined)
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

