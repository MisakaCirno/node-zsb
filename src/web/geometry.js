export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function numberValue(input, min, max) {
  return clamp(Number(input.value || 0), min, max)
}

export function normalizeAngle(value) {
  return Math.round(((value % 360) + 360) % 360)
}

export function normalizeCoordinate(value, min, max, snapStep = 0) {
  const rounded = snapStep
    ? Math.round(value / snapStep) * snapStep
    : Math.round(value)
  return clamp(rounded, min, max)
}

export function normalizePoint(x, y, snapStep = 0) {
  return {
    x: normalizeCoordinate(x, 0, 512, snapStep),
    y: normalizeCoordinate(y, 0, 384, snapStep),
  }
}

export function rotatePoint(point, degrees) {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}
