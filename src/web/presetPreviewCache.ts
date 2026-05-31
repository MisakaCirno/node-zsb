import { getBrowserWindow } from './browser.js'

interface MemoryEntry {
  lastUsed: number
  url: string
}

const DB_NAME = 'node-zsb-preview-cache'
const STORE_NAME = 'preset-previews'
const DB_VERSION = 1
const MAX_MEMORY_ENTRIES = 30

const memoryCache = new Map<string, MemoryEntry>()

export async function getPresetPreviewUrl(
  cacheKey: string,
  render: () => Promise<Blob>,
): Promise<string> {
  const memoryEntry = memoryCache.get(cacheKey)
  if (memoryEntry) {
    memoryEntry.lastUsed = Date.now()
    return memoryEntry.url
  }

  const cachedBlob = await readPresetPreviewBlob(cacheKey)
  const blob = cachedBlob ?? await render()
  if (!cachedBlob) {
    await writePresetPreviewBlob(cacheKey, blob)
  }
  return storeMemoryPreview(cacheKey, blob)
}

export async function deletePresetPreview(cacheKey: string): Promise<void> {
  const memoryEntry = memoryCache.get(cacheKey)
  if (memoryEntry) {
    URL.revokeObjectURL(memoryEntry.url)
    memoryCache.delete(cacheKey)
  }

  const database = await openPreviewDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const request = database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .delete(cacheKey)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
}

export async function estimatePresetPreviewCacheBytes(): Promise<number | null> {
  const database = await openPreviewDatabase()
  if (!database) return null
  return new Promise((resolve) => {
    let total = 0
    const request = database
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(total)
        return
      }
      const value = cursor.value as { blob?: Blob } | undefined
      total += value?.blob instanceof Blob ? value.blob.size : 0
      cursor.continue()
    }
    request.onerror = () => resolve(null)
  })
}

async function readPresetPreviewBlob(cacheKey: string): Promise<Blob | null> {
  const database = await openPreviewDatabase()
  if (!database) return null
  return new Promise((resolve) => {
    const request = database
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .get(cacheKey)
    request.onsuccess = () => {
      const value = request.result as { blob?: Blob } | undefined
      resolve(value?.blob ?? null)
    }
    request.onerror = () => resolve(null)
  })
}

async function writePresetPreviewBlob(cacheKey: string, blob: Blob): Promise<void> {
  const database = await openPreviewDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const request = database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put({ blob, createdAt: Date.now(), key: cacheKey })
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
}

function openPreviewDatabase(): Promise<IDBDatabase | null> {
  const indexedDB = getBrowserWindow().indexedDB
  if (!indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

function storeMemoryPreview(cacheKey: string, blob: Blob): string {
  const url = URL.createObjectURL(blob)
  memoryCache.set(cacheKey, {
    lastUsed: Date.now(),
    url,
  })
  trimMemoryCache()
  return url
}

function trimMemoryCache(): void {
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return
  const entries = [...memoryCache.entries()]
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed)
  for (const [key, entry] of entries.slice(0, memoryCache.size - MAX_MEMORY_ENTRIES)) {
    URL.revokeObjectURL(entry.url)
    memoryCache.delete(key)
  }
}
