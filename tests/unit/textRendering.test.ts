import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  STRATEGY_TEXT_FONT_FAMILY,
  STRATEGY_TEXT_STROKE_WIDTH,
  calcTextWidth,
} from '../../src/shared/boardGeometry.js'
import {
  createStrategyTextStyle,
  getStrategyTextCanvasFont,
  getStrategyTextCanvasStrokeWidth,
  getStrategyTextFontLoadSpec,
} from '../../src/shared/textRendering.js'

test('createStrategyTextStyle returns the shared Konva text configuration', () => {
  const style = createStrategyTextStyle('TEXT', '#ff00ff')

  assert.equal(style.text, 'TEXT')
  assert.equal(style.fill, '#ff00ff')
  assert.equal(style.stroke, 'black')
  assert.equal(style.strokeWidth, STRATEGY_TEXT_STROKE_WIDTH)
  assert.equal(style.fontFamily, STRATEGY_TEXT_FONT_FAMILY)
  assert.equal(style.fontSize, DEFAULT_TEXT_FONT_SIZE)
  assert.equal(style.offsetX, calcTextWidth('TEXT', DEFAULT_TEXT_FONT_SIZE) / 2)
  assert.equal(style.offsetY, DEFAULT_TEXT_FONT_SIZE / 2)
  assert.equal(style.shadowEnabled, true)
})

test('createStrategyTextStyle falls back to the default text color', () => {
  assert.equal(createStrategyTextStyle('TEXT').fill, DEFAULT_TEXT_COLOR)
})

test('strategy text helpers expose consistent font strings for browser APIs', () => {
  assert.equal(getStrategyTextFontLoadSpec(), `${DEFAULT_TEXT_FONT_SIZE}px ${STRATEGY_TEXT_FONT_FAMILY}`)
  assert.equal(getStrategyTextCanvasFont(2), `${DEFAULT_TEXT_FONT_SIZE}px ${STRATEGY_TEXT_FONT_FAMILY}`)
  assert.equal(getStrategyTextCanvasStrokeWidth(2), 1)
  assert.equal(getStrategyTextCanvasStrokeWidth(4), STRATEGY_TEXT_STROKE_WIDTH * 2)
  assert.equal(getStrategyTextCanvasStrokeWidth(0.25), 1)
})
