import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AOE_RADIUS,
  DEFAULT_DONUT_COLOR,
  DEFAULT_LINE_COLOR,
  calculateCircleOffset,
  calculateDonutOffset,
  toSceneCoordinate,
} from '../../src/shared/boardGeometry.js'
import {
  createCircleAoeRenderSpec,
  createDonutRenderSpec,
  createIconRenderSpec,
  createLineAoeRenderSpec,
  createLineRenderSpec,
} from '../../src/shared/objectRendering.js'

test('createLineRenderSpec exposes scene and local line coordinates', () => {
  const spec = createLineRenderSpec({
    type: 'line',
    x: 10,
    y: 20,
    endX: 70,
    endY: 50,
    height: 8,
  })

  assert.equal(spec.startX, toSceneCoordinate(10))
  assert.equal(spec.startY, toSceneCoordinate(20))
  assert.equal(spec.endX, toSceneCoordinate(70))
  assert.equal(spec.endY, toSceneCoordinate(50))
  assert.equal(spec.endLocalX, toSceneCoordinate(60))
  assert.equal(spec.endLocalY, toSceneCoordinate(30))
  assert.equal(spec.stroke, DEFAULT_LINE_COLOR)
  assert.equal(spec.strokeWidth, toSceneCoordinate(8))
})

test('createLineAoeRenderSpec normalizes dimensions and applies transforms', () => {
  const spec = createLineAoeRenderSpec({
    type: 'line_aoe',
    x: 30,
    y: 40,
    width: 999,
    height: 1,
    angle: 45,
    horizontalFlip: true,
    verticalFlip: false,
    transparency: 25,
  })

  assert.equal(spec.logicalWidth, 512)
  assert.equal(spec.logicalHeight, 16)
  assert.equal(spec.width, toSceneCoordinate(512))
  assert.equal(spec.height, toSceneCoordinate(16))
  assert.equal(spec.scaleX, -1)
  assert.equal(spec.scaleY, 1)
  assert.equal(spec.rotation, 45)
  assert.equal(spec.opacity, 0.75)
})

test('createCircleAoeRenderSpec shares fan crop offsets and arc angles', () => {
  const spec = createCircleAoeRenderSpec({
    type: 'fan_aoe',
    x: 100,
    y: 120,
    size: 50,
    arcAngle: 90,
  })
  const offset = calculateCircleOffset(90)

  assert.equal(spec.x, toSceneCoordinate(100))
  assert.equal(spec.y, toSceneCoordinate(120))
  assert.equal(spec.offsetX, offset.offsetX)
  assert.equal(spec.offsetY, offset.offsetY)
  assert.equal(spec.imageWidth, AOE_RADIUS * 2)
  assert.equal(spec.clipRadius, AOE_RADIUS)
  assert.equal(spec.arcAngle, 90)
  assert.equal(spec.scaleX, 0.5)
  assert.equal(spec.scaleY, 0.5)
})

test('createDonutRenderSpec shares inner radius, crop offset and fill color', () => {
  const spec = createDonutRenderSpec({
    type: 'donut',
    x: 160,
    y: 180,
    donutRadius: 40,
    arcAngle: 180,
  })
  const innerRadius = toSceneCoordinate(40)
  const offset = calculateDonutOffset({
    arcAngle: 180,
    outerRadius: AOE_RADIUS,
    innerRadius,
  })

  assert.equal(spec.innerRadius, innerRadius)
  assert.equal(spec.offsetX, offset.offsetX)
  assert.equal(spec.offsetY, offset.offsetY)
  assert.equal(spec.fill, DEFAULT_DONUT_COLOR)
  assert.equal(spec.arcAngle, 180)
})

test('createIconRenderSpec converts icon size and flips consistently', () => {
  const spec = createIconRenderSpec({
    type: 'tank',
    x: 1,
    y: 2,
    size: 150,
    verticalFlip: true,
  }, 64)

  assert.equal(spec.x, toSceneCoordinate(1))
  assert.equal(spec.y, toSceneCoordinate(2))
  assert.equal(spec.width, toSceneCoordinate(64))
  assert.equal(spec.height, toSceneCoordinate(64))
  assert.equal(spec.offsetX, 64)
  assert.equal(spec.offsetY, 64)
  assert.equal(spec.scaleX, 1.5)
  assert.equal(spec.scaleY, -1.5)
})
