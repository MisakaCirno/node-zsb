import assert from 'node:assert/strict'
import test from 'node:test'

import {
  exportCleanStagePreviewDataUrl,
  type PreviewStage,
  type PreviewVisibilityNode,
} from '../../src/web/stageRenderer.ts'

test('clean stage preview hides editor overlays and restores their exact visibility', () => {
  const layers = [createLayer(true), createLayer(false), createLayer(true)]
  let drawCount = 0
  const stage: PreviewStage = {
    draw() {
      drawCount += 1
    },
    toDataURL(options) {
      assert.deepEqual(layers.map((layer) => layer.visible()), [false, false, false])
      assert.deepEqual(options, { pixelRatio: 0.18 })
      return 'data:image/png;base64,clean'
    },
  }

  const result = exportCleanStagePreviewDataUrl(stage, layers, { pixelRatio: 0.18 })

  assert.equal(result, 'data:image/png;base64,clean')
  assert.deepEqual(layers.map((layer) => layer.visible()), [true, false, true])
  assert.equal(drawCount, 2)
})

test('clean stage preview restores overlays when export fails', () => {
  const layers = [createLayer(true), createLayer(true), createLayer(false)]
  const stage: PreviewStage = {
    draw() {},
    toDataURL() {
      throw new Error('export failed')
    },
  }

  assert.throws(
    () => exportCleanStagePreviewDataUrl(stage, layers),
    /export failed/,
  )
  assert.deepEqual(layers.map((layer) => layer.visible()), [true, true, false])
})

function createLayer(initialVisibility: boolean): PreviewVisibilityNode {
  let visibility = initialVisibility
  return {
    visible(value?: boolean): boolean | void {
      if (value === undefined) return visibility
      visibility = value
    },
  } as PreviewVisibilityNode
}
