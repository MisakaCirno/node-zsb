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
  createTextRenderSpec,
  traceCenteredSectorPath,
  traceCircleAoeClipPath,
  traceDonutPath,
} from '../../src/shared/objectRendering.js'

interface PathCall {
  name: string
  values: unknown[]
}

class RecordingPathContext {
  calls: PathCall[] = []

  beginPath(): void {
    this.calls.push({ name: 'beginPath', values: [] })
  }

  moveTo(x: number, y: number): void {
    this.calls.push({ name: 'moveTo', values: [x, y] })
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void {
    this.calls.push({ name: 'arc', values: [x, y, radius, startAngle, endAngle, counterclockwise] })
  }

  closePath(): void {
    this.calls.push({ name: 'closePath', values: [] })
  }
}

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
  assert.equal(spec.lineCap, 'round')
})

test('createTextRenderSpec exposes scene position and opacity', () => {
  const spec = createTextRenderSpec({
    type: 'text',
    x: 12,
    y: 34,
    transparency: 40,
  })

  assert.equal(spec.x, toSceneCoordinate(12))
  assert.equal(spec.y, toSceneCoordinate(34))
  assert.equal(spec.opacity, 0.6)
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

test('range render specs normalize external arc angles before tracing paths', () => {
  assert.equal(createCircleAoeRenderSpec({
    type: 'fan_aoe',
    x: 0,
    y: 0,
    arcAngle: 999,
  }).arcAngle, 360)
  assert.equal(createCircleAoeRenderSpec({
    type: 'fan_aoe',
    x: 0,
    y: 0,
    arcAngle: -20,
  }).arcAngle, 10)
  assert.equal(createDonutRenderSpec({
    type: 'donut',
    x: 0,
    y: 0,
    arcAngle: 999,
  }).arcAngle, 360)
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

test('traceCircleAoeClipPath builds the shared fan clip path', () => {
  const spec = createCircleAoeRenderSpec({
    type: 'fan_aoe',
    x: 0,
    y: 0,
    arcAngle: 90,
  })
  const context = new RecordingPathContext()

  traceCircleAoeClipPath(context, spec)

  assert.deepEqual(context.calls.map((call) => call.name), ['beginPath', 'moveTo', 'arc', 'closePath'])
  assert.deepEqual(context.calls[1]?.values, [AOE_RADIUS, AOE_RADIUS])
  assert.deepEqual(context.calls[2]?.values, [
    AOE_RADIUS,
    AOE_RADIUS,
    AOE_RADIUS,
    spec.startAngle,
    spec.endAngle,
    undefined,
  ])
})

test('traceCenteredSectorPath builds full circles and partial sectors', () => {
  const fullContext = new RecordingPathContext()
  traceCenteredSectorPath(fullContext, {
    arcAngle: 360,
    radius: 10,
    startAngle: -Math.PI / 2,
    endAngle: Math.PI,
  })

  assert.deepEqual(fullContext.calls.map((call) => call.name), ['beginPath', 'arc'])
  assert.deepEqual(fullContext.calls[1]?.values, [0, 0, 10, 0, Math.PI * 2, undefined])

  const sectorContext = new RecordingPathContext()
  traceCenteredSectorPath(sectorContext, {
    arcAngle: 90,
    radius: 20,
    startAngle: -Math.PI / 2,
    endAngle: 0,
  })

  assert.deepEqual(sectorContext.calls.map((call) => call.name), ['beginPath', 'moveTo', 'arc', 'closePath'])
  assert.deepEqual(sectorContext.calls[1]?.values, [0, 0])
})

test('traceDonutPath builds full and partial donut paths with optional radius scaling', () => {
  const fullSpec = createDonutRenderSpec({
    type: 'donut',
    x: 0,
    y: 0,
    donutRadius: 40,
    arcAngle: 360,
  })
  const fullContext = new RecordingPathContext()
  traceDonutPath(fullContext, fullSpec, { radiusScale: 0.5 })

  assert.deepEqual(fullContext.calls.map((call) => call.name), ['beginPath', 'arc', 'arc'])
  assert.deepEqual(fullContext.calls[1]?.values, [0, 0, AOE_RADIUS / 2, 0, Math.PI * 2, false])
  assert.deepEqual(fullContext.calls[2]?.values, [0, 0, 40, 0, Math.PI * 2, true])

  const partialSpec = createDonutRenderSpec({
    type: 'donut',
    x: 0,
    y: 0,
    donutRadius: 30,
    arcAngle: 180,
  })
  const partialContext = new RecordingPathContext()
  traceDonutPath(partialContext, partialSpec)

  assert.deepEqual(partialContext.calls.map((call) => call.name), ['beginPath', 'arc', 'arc', 'closePath'])
  assert.deepEqual(partialContext.calls[1]?.values, [
    0,
    0,
    partialSpec.outerRadius,
    partialSpec.startAngle,
    partialSpec.endAngle,
    false,
  ])
})
