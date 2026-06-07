import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateCircleOffset,
  calculateDonutOffset,
  flippedScale,
  normalizeObjectAngle,
  normalizeObjectSize,
  normalizeTransparency,
  objectOpacity,
  objectScale,
  STRATEGY_TEXT_FONT_FAMILY,
  STRATEGY_TEXT_FONT_PRIMARY,
  STRATEGY_TEXT_FONT_WEIGHT,
  toLogicalCoordinate,
} from '../../src/shared/boardGeometry.js'

test('calculateCircleOffset follows strategy board sector crop center', () => {
  assert.deepEqual(calculateCircleOffset(90), { offsetX: 768, offsetY: 256 })
  assert.equal(calculateCircleOffset(100).offsetX, 768)
  assert.equal(Math.round(calculateCircleOffset(100).offsetY), 300)
})

test('calculateDonutOffset returns crop center relative to the donut origin', () => {
  assert.deepEqual(calculateDonutOffset({
    arcAngle: 360,
    outerRadius: 512,
    innerRadius: 160,
  }), { offsetX: 0, offsetY: 0 })
  assert.deepEqual(calculateDonutOffset({
    arcAngle: 90,
    outerRadius: 512,
    innerRadius: 160,
  }), { offsetX: 256, offsetY: -256 })
})

test('flippedScale mirrors a rendered object without changing its stored size', () => {
  assert.equal(flippedScale(1.5, false), 1.5)
  assert.equal(flippedScale(1.5, true), -1.5)
})

test('toLogicalCoordinate preserves fractional editor coordinates', () => {
  assert.equal(toLogicalCoordinate(521.5), 260.75)
})

test('objectScale follows game size ranges by object type', () => {
  assert.equal(normalizeObjectSize(20), 50)
  assert.equal(normalizeObjectSize(250), 200)
  assert.equal(normalizeObjectSize(5, 'circle_aoe'), 10)
  assert.equal(normalizeObjectSize(5, 'fan_aoe'), 10)
  assert.equal(normalizeObjectSize(5, 'donut'), 10)
  assert.equal(normalizeObjectSize(250, 'line_aoe'), 100)
  assert.equal(objectScale({ type: 'tank', size: 20 }), 0.5)
  assert.equal(objectScale({ type: 'circle_aoe', size: 5 }), 0.1)
  assert.equal(objectScale({ type: 'line_aoe', size: 250 }), 1)
  assert.equal(objectScale({ type: 'tank', size: 250 }), 2)
})

test('normalizeObjectAngle follows the game -180 to 180 rotation range', () => {
  assert.equal(normalizeObjectAngle(315), -45)
  assert.equal(normalizeObjectAngle(181), -179)
  assert.equal(normalizeObjectAngle(-181), 179)
  assert.equal(normalizeObjectAngle(180), 180)
  assert.equal(normalizeObjectAngle(-180), -180)
})

test('objectOpacity follows the game 0-100 transparency scale', () => {
  assert.equal(objectOpacity({ transparency: 0 }), 1)
  assert.equal(objectOpacity({ transparency: 40 }), 0.6)
  assert.equal(objectOpacity({ transparency: 100 }), 0)
  assert.equal(objectOpacity({ transparency: 150 }), 0)
  assert.equal(normalizeTransparency(150), 100)
})

test('strategy text font stack prefers the bundled renderer font', () => {
  assert.equal(STRATEGY_TEXT_FONT_PRIMARY, 'MiSans')
  assert.equal(STRATEGY_TEXT_FONT_WEIGHT, 600)
  assert.equal(STRATEGY_TEXT_FONT_FAMILY.startsWith(`${STRATEGY_TEXT_FONT_PRIMARY},`), true)
  assert.equal(STRATEGY_TEXT_FONT_FAMILY.includes('sans-serif'), true)
})
