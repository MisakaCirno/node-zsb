import type { BoardObject } from './types.js'

const EDITOR_ID_KEY = 'editorId'
const PURE_BOARD_EDITOR_KEYS = [
  EDITOR_ID_KEY,
  'hidden',
  'locked',
] as const

export function createEditorId(prefix = 'obj'): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}

export function ensureObjectEditorIds<T extends BoardObject>(objects: T[]): T[] {
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

export function stripEditorFields<T extends BoardObject>(object: T): BoardObject {
  const copy = { ...object }
  delete copy[EDITOR_ID_KEY]
  return copy
}

export function stripPureBoardEditorFields<T extends BoardObject>(object: T): BoardObject {
  const copy = { ...object }
  for (const key of PURE_BOARD_EDITOR_KEYS) {
    delete copy[key]
  }
  return copy
}
