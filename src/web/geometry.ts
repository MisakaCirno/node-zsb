interface NumericInput {
  value: string | number
}

export interface Point {
  x: number
  y: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function numberValue(input: NumericInput, min: number, max: number): number {
  return clamp(Number(input.value || 0), min, max)
}

export function normalizeAngle(value: number): number {
  return Math.round(((value % 360) + 360) % 360)
}

export function normalizeCoordinate(
  value: number,
  min: number,
  max: number,
  snapStep = 0,
): number {
  const rounded = snapStep
    ? Math.round(value / snapStep) * snapStep
    : Math.round(value)
  return clamp(rounded, min, max)
}

export function normalizePoint(x: number, y: number, snapStep = 0): Point {
  return {
    x: normalizeCoordinate(x, 0, 512, snapStep),
    y: normalizeCoordinate(y, 0, 384, snapStep),
  }
}

export function rotatePoint(point: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}
