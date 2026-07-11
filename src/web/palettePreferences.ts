import { PALETTE_PREFERENCES_KEY } from './constants.js'
import { getBrowserLocalStorage } from './browser.js'

export const MAX_RECENT_OBJECT_TYPES = 12

interface PalettePreferences {
  version: 1
  recentObjectTypes: string[]
}

export function loadRecentObjectTypes(): string[] {
  try {
    const raw = getBrowserLocalStorage().getItem(PALETTE_PREFERENCES_KEY)
    if (!raw) return []
    const value = JSON.parse(raw) as Partial<PalettePreferences> | null
    if (!value || value.version !== 1 || !Array.isArray(value.recentObjectTypes)) return []
    return normalizeRecentObjectTypes(value.recentObjectTypes)
  } catch (error) {
    console.warn('Failed to load palette preferences', error)
    return []
  }
}

export function rememberRecentObjectType(type: unknown): boolean {
  const normalizedType = String(type ?? '').trim()
  if (!normalizedType) return false
  const current = loadRecentObjectTypes()
  const next = [normalizedType, ...current.filter((entry) => entry !== normalizedType)]
    .slice(0, MAX_RECENT_OBJECT_TYPES)
  if (next.length === current.length && next.every((entry, index) => entry === current[index])) {
    return false
  }
  try {
    getBrowserLocalStorage().setItem(PALETTE_PREFERENCES_KEY, JSON.stringify({
      version: 1,
      recentObjectTypes: next,
    } satisfies PalettePreferences))
    return true
  } catch (error) {
    console.warn('Failed to save palette preferences', error)
    return false
  }
}

function normalizeRecentObjectTypes(values: unknown[]): string[] {
  const result: string[] = []
  const used = new Set<string>()
  for (const value of values) {
    const type = typeof value === 'string' ? value.trim() : ''
    if (!type || used.has(type)) continue
    used.add(type)
    result.push(type)
    if (result.length >= MAX_RECENT_OBJECT_TYPES) break
  }
  return result
}
