import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendObjectLayerNode,
  getGroupObjectIds,
  moveLayerNodeAfter,
  moveLayerNodeBefore,
  moveLayerNodeIntoGroup,
  moveLayerNodeToRoot,
  removeObjectLayerNodes,
} from '../../src/web/layerTree.js'

test('moveLayerNodeIntoGroup moves object nodes into groups', () => {
  const layerTree = [
    { type: 'group', id: 'grp_1', name: 'Group', children: [{ type: 'object', id: 'obj_a' }] },
    { type: 'object', id: 'obj_b' },
  ]

  assert.equal(moveLayerNodeIntoGroup(layerTree, { type: 'object', id: 'obj_b' }, 'grp_1'), true)
  assert.deepEqual(getGroupObjectIds(layerTree, 'grp_1'), ['obj_a', 'obj_b'])
  assert.deepEqual(layerTree, [
    {
      type: 'group',
      id: 'grp_1',
      name: 'Group',
      collapsed: false,
      children: [
        { type: 'object', id: 'obj_a' },
        { type: 'object', id: 'obj_b' },
      ],
    },
  ])
})

test('moveLayerNodeBefore reorders nested nodes without flattening groups', () => {
  const layerTree = [
    { type: 'object', id: 'obj_a' },
    {
      type: 'group',
      id: 'grp_1',
      name: 'Group',
      children: [
        { type: 'object', id: 'obj_b' },
        { type: 'object', id: 'obj_c' },
      ],
    },
  ]

  assert.equal(
    moveLayerNodeBefore(layerTree, { type: 'object', id: 'obj_c' }, { type: 'object', id: 'obj_a' }),
    true,
  )
  assert.deepEqual(layerTree, [
    { type: 'object', id: 'obj_c' },
    { type: 'object', id: 'obj_a' },
    {
      type: 'group',
      id: 'grp_1',
      name: 'Group',
      children: [
        { type: 'object', id: 'obj_b' },
      ],
    },
  ])
})

test('appendObjectLayerNode and removeObjectLayerNodes preserve unrelated groups', () => {
  const layerTree = [
    {
      type: 'group',
      id: 'grp_1',
      name: 'Group',
      children: [
        { type: 'object', id: 'obj_a' },
        { type: 'object', id: 'obj_b' },
      ],
    },
  ]

  appendObjectLayerNode(layerTree, 'obj_c')
  removeObjectLayerNodes(layerTree, ['obj_a'])

  assert.deepEqual(layerTree, [
    {
      type: 'group',
      id: 'grp_1',
      name: 'Group',
      children: [
        { type: 'object', id: 'obj_b' },
      ],
    },
    { type: 'object', id: 'obj_c' },
  ])
})

test('moveLayerNodeAfter moves nodes after flat targets', () => {
  const layerTree = [
    { type: 'object', id: 'obj_a' },
    { type: 'object', id: 'obj_b' },
    { type: 'object', id: 'obj_c' },
  ]

  assert.equal(
    moveLayerNodeAfter(layerTree, { type: 'object', id: 'obj_a' }, { type: 'object', id: 'obj_c' }),
    true,
  )
  assert.deepEqual(layerTree, [
    { type: 'object', id: 'obj_b' },
    { type: 'object', id: 'obj_c' },
    { type: 'object', id: 'obj_a' },
  ])
})

test('moveLayerNodeIntoGroup rejects moving a group into itself or its descendant', () => {
  const layerTree = [
    {
      type: 'group',
      id: 'grp_1',
      name: 'Outer',
      children: [
        { type: 'group', id: 'grp_2', name: 'Inner', children: [] },
      ],
    },
  ]

  assert.equal(moveLayerNodeIntoGroup(layerTree, { type: 'group', id: 'grp_1' }, 'grp_1'), false)
  assert.equal(moveLayerNodeIntoGroup(layerTree, { type: 'group', id: 'grp_1' }, 'grp_2'), false)
})

test('moveLayerNodeToRoot lifts nested groups back to the root', () => {
  const layerTree = [
    {
      type: 'group',
      id: 'grp_1',
      name: 'Outer',
      children: [
        { type: 'group', id: 'grp_2', name: 'Inner', children: [{ type: 'object', id: 'obj_a' }] },
      ],
    },
  ]

  assert.equal(moveLayerNodeToRoot(layerTree, { type: 'group', id: 'grp_2' }), true)
  assert.deepEqual(layerTree, [
    { type: 'group', id: 'grp_1', name: 'Outer', children: [] },
    { type: 'group', id: 'grp_2', name: 'Inner', children: [{ type: 'object', id: 'obj_a' }] },
  ])
})
