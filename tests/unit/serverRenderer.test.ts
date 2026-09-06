import assert from 'node:assert/strict'
import test from 'node:test'

import type { DecodeResult } from 'xiv-strat-board'
import { renderBoard } from '../../src/server/renderer/renderer.ts'
import { SCENE_HEIGHT, SCENE_WIDTH } from '../../src/server/utils/resize.ts'
import { getObjectBounds } from '../../src/web/objectAlignment.ts'
import { createEditorState } from '../../src/web/editorState.ts'

test('renderBoard creates a server-side stage for mixed objects', async () => {
  const boardData = {
    version: 1,
    name: 'server renderer smoke',
    boardBackground: 'none',
    objects: [
      { type: 'tank', x: 64, y: 64, size: 120, angle: 30 },
      { type: 'text', x: 128, y: 96, text: 'TEXT', transparency: 20 },
      { type: 'line', x: 40, y: 180, endX: 180, endY: 220, height: 8 },
      { type: 'line_aoe', x: 260, y: 90, width: 160, height: 32, angle: -30, transparency: 25 },
      { type: 'circle_aoe', x: 340, y: 180, size: 40 },
      { type: 'fan_aoe', x: 430, y: 260, size: 35, arcAngle: 120, angle: 45 },
      { type: 'donut', x: 160, y: 300, size: 40, donutRadius: 45, arcAngle: 210 },
    ],
  } satisfies DecodeResult

  const stage = await renderBoard(boardData)
  try {
    assert.equal(stage.width(), SCENE_WIDTH)
    assert.equal(stage.height(), SCENE_HEIGHT)

    const layers = stage.getLayers()
    assert.equal(layers.length, 2)
    assert.equal(layers[0]?.getChildren().length, 1)
    assert.equal(layers[1]?.getChildren().length, boardData.objects.length)

    const objectNodes = layers[1]?.getChildren() ?? []
    assert.deepEqual(objectNodes.map((node) => node.getClassName()), [
      'Group',
      'Group',
      'Group',
      'Rect',
      'Group',
      'Text',
      'Image',
    ])
  } finally {
    stage.destroy()
  }
})

test('server donuts expose visible bounds through rotations and flips', async () => {
  const state = createEditorState()
  for (const arcAngle of [45, 180, 360]) {
    for (const angle of [0, 35]) {
      const object = {
        type: 'donut' as const, x: 256, y: 192, size: 30,
        donutRadius: 80, arcAngle, angle, horizontalFlip: true, verticalFlip: true,
      }
      const stage = await renderBoard({ version: 1, name: '', boardBackground: 'none', objects: [object] })
      try {
        const node = stage.getLayers()[1]!.getChildren()[0]!
        const rect = node.getClientRect()
        const expected = getObjectBounds(object, state)
        assert.ok(Math.abs(rect.x - expected.left * 2) < 0.001)
        assert.ok(Math.abs(rect.y - expected.top * 2) < 0.001)
        assert.ok(Math.abs(rect.width - (expected.right - expected.left) * 2) < 0.001)
        assert.ok(Math.abs(rect.height - (expected.bottom - expected.top) * 2) < 0.001)
        assert.equal(stage.getLayers()[1]!.findOne('Shape')!.getAttr('fill'), '#FFA131')
      } finally {
        stage.destroy()
      }
    }
  }
})
