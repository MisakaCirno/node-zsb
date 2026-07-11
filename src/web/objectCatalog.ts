import {
  OBJECT_ALIASES_ZH_CN,
  OBJECT_NAMES_ZH_CN,
} from './objectNamesZhCN.js'
import type {
  ObjectNameKey,
} from './objectNamesZhCN.js'

/**
 * Editor-only names and search aliases for objects shown in the palette.
 *
 * Localized metadata lives in the locale table. It must not be written to
 * Board, Project, or share-code data.
 */
export interface ObjectCatalogEntry {
  displayName: string
  keywords: readonly string[]
}

export const BUILT_IN_OBJECT_TYPES = [
  'text',
  'line',
  'line_aoe',
  'circle_aoe',
  'fan_aoe',
  'donut',
] as const

export const OBJECT_CATALOG: Readonly<Record<string, ObjectCatalogEntry>> = Object.fromEntries(
  (Object.entries(OBJECT_NAMES_ZH_CN) as Array<[ObjectNameKey, string]>).map(([type, displayName]) => [
    type,
    {
      displayName,
      keywords: OBJECT_ALIASES_ZH_CN[type],
    },
  ]),
)

export function getObjectCatalogEntry(type: string): ObjectCatalogEntry | undefined {
  return OBJECT_CATALOG[type]
}

export function getObjectDisplayName(type: string): string {
  return getObjectCatalogEntry(type)?.displayName ?? type
}

export function matchesObjectSearch(type: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const metadata = getObjectCatalogEntry(type)
  const fields = [type, metadata?.displayName ?? '', ...(metadata?.keywords ?? [])]
    .map(normalizeSearchText)
    .filter(Boolean)
  const normalizedIndex = fields.join(' ')
  const compactIndex = compactSearchText(normalizedIndex)

  return normalizedQuery.split(' ').every((term) => (
    normalizedIndex.includes(term) || compactIndex.includes(compactSearchText(term))
  ))
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactSearchText(value: string): string {
  return value.replace(/\s+/g, '')
}
