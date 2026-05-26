const EDITOR_ID_KEY = 'editorId'

export function createEditorId(prefix = 'obj') {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}

export function ensureObjectEditorIds(objects) {
  const used = new Set()
  for (const object of objects) {
    const current = typeof object[EDITOR_ID_KEY] === 'string'
      ? object[EDITOR_ID_KEY].trim()
      : ''
    object[EDITOR_ID_KEY] = current && !used.has(current)
      ? current
      : createEditorId('obj')
    used.add(object[EDITOR_ID_KEY])
  }
  return objects
}

export function stripEditorFields(object) {
  const copy = { ...object }
  delete copy[EDITOR_ID_KEY]
  return copy
}

