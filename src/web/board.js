export function normalizeBoard(board) {
  return {
    name: board.name ?? '',
    boardBackground: board.boardBackground ?? 'checkered',
    objects: (board.objects ?? []).map((object) => ({
      size: 100,
      color: '#ff8000',
      transparency: 0,
      ...object,
    })),
  }
}

export function cleanBoard(board) {
  return {
    name: board.name || undefined,
    boardBackground: board.boardBackground,
    objects: board.objects.map((object) => {
      const copy = sanitizeObject(object)
      for (const key of Object.keys(copy)) {
        if (copy[key] === undefined || copy[key] === '') delete copy[key]
      }
      return copy
    }),
  }
}

export function sanitizeObject(object) {
  const capabilities = getObjectCapabilities(object.type)
  const copy = { ...object }
  if (!capabilities.appearance) {
    delete copy.color
    delete copy.transparency
  }
  if (!capabilities.text) {
    delete copy.text
  }
  if (!capabilities.line) {
    delete copy.endX
    delete copy.endY
  }
  if (!capabilities.arcAngle) {
    delete copy.arcAngle
  }
  if (!capabilities.donutRadius) {
    delete copy.donutRadius
  }
  return copy
}

export function getObjectCapabilities(type) {
  return {
    appearance: ['text', 'line', 'line_aoe', 'donut'].includes(type),
    text: type === 'text',
    line: type === 'line',
    arcAngle: type === 'fan_aoe',
    donutRadius: type === 'donut',
  }
}
