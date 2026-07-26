import { createHash, randomUUID } from 'node:crypto'
import * as nodeFs from 'node:fs/promises'
import path from 'node:path'

export const RENDER_CACHE_VERSION = '2'
export const RENDER_CACHE_HASH_PATTERN = /^[a-f0-9]{64}$/

export interface RenderCacheFileSystem {
  mkdir(directory: string): Promise<unknown>
  readFile(filePath: string): Promise<Buffer>
  writeFile(filePath: string, data: Buffer): Promise<unknown>
  rename(sourcePath: string, targetPath: string): Promise<unknown>
  rm(filePath: string, options: { force: boolean }): Promise<unknown>
  readdir(directory: string): Promise<string[]>
  stat(filePath: string): Promise<{ mtimeMs: number, size: number }>
  utimes(filePath: string, atime: Date, mtime: Date): Promise<unknown>
}

export interface RenderCacheStore {
  readonly directory: string
  getPath(hash: string): string
  read(hash: string): Promise<Buffer | null>
  writeAtomic(hash: string, data: Buffer): Promise<void>
  prune(): Promise<void>
}

interface CreateRenderCacheStoreOptions {
  directory: string
  maxFiles?: number
  maxBytes?: number
  touchIntervalMs?: number
  fileSystem?: RenderCacheFileSystem
  now?: () => number
}

interface CreateCachedRenderServiceOptions {
  store: RenderCacheStore
  render(code: string): Promise<Buffer>
  version?: string
  pruneIntervalMs?: number
  onPruneError?(error: unknown): void
  now?: () => number
}

export interface CachedRenderResult {
  hash: string
  data: Buffer
}

const defaultFileSystem: RenderCacheFileSystem = {
  mkdir: (directory) => nodeFs.mkdir(directory, { recursive: true }),
  readFile: (filePath) => nodeFs.readFile(filePath),
  writeFile: (filePath, data) => nodeFs.writeFile(filePath, data),
  rename: (sourcePath, targetPath) => nodeFs.rename(sourcePath, targetPath),
  rm: (filePath, options) => nodeFs.rm(filePath, options),
  readdir: (directory) => nodeFs.readdir(directory),
  stat: (filePath) => nodeFs.stat(filePath),
  utimes: (filePath, atime, mtime) => nodeFs.utimes(filePath, atime, mtime),
}

export function createRenderCacheKey(
  code: string,
  version = RENDER_CACHE_VERSION,
): string {
  return createHash('sha256')
    .update(version)
    .update('\0')
    .update(code)
    .digest('hex')
}

export function createRenderCacheStore({
  directory,
  maxFiles = 500,
  maxBytes = Number.POSITIVE_INFINITY,
  touchIntervalMs = 6 * 60 * 60 * 1_000,
  fileSystem = defaultFileSystem,
  now = Date.now,
}: CreateRenderCacheStoreOptions): RenderCacheStore {
  const cacheDirectory = path.resolve(directory)
  const lastTouched = new Map<string, number>()

  function getPath(hash: string): string {
    assertCacheHash(hash)
    return path.join(cacheDirectory, `${hash}.webp`)
  }

  async function read(hash: string): Promise<Buffer | null> {
    try {
      const filePath = getPath(hash)
      const data = await fileSystem.readFile(filePath)
      touchAfterRead(filePath)
      return data
    } catch (error) {
      if (isMissingFileError(error)) return null
      throw error
    }
  }

  async function writeAtomic(hash: string, data: Buffer): Promise<void> {
    const targetPath = getPath(hash)
    const temporaryPath = path.join(
      cacheDirectory,
      `.${hash}.${randomUUID()}.tmp`,
    )
    await fileSystem.mkdir(cacheDirectory)
    try {
      await fileSystem.writeFile(temporaryPath, data)
      await fileSystem.rename(temporaryPath, targetPath)
      lastTouched.set(targetPath, now())
    } finally {
      await fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined)
    }
  }

  async function prune(): Promise<void> {
    let names: string[]
    try {
      names = await fileSystem.readdir(cacheDirectory)
    } catch (error) {
      if (isMissingFileError(error)) return
      throw error
    }

    const entries: Array<{ filePath: string, mtimeMs: number, size: number }> = []
    for (const name of names) {
      if (!name.endsWith('.webp')) continue
      const hash = name.slice(0, -'.webp'.length)
      if (!RENDER_CACHE_HASH_PATTERN.test(hash)) continue
      const filePath = path.join(cacheDirectory, name)
      try {
        const { mtimeMs, size } = await fileSystem.stat(filePath)
        entries.push({ filePath, mtimeMs, size })
      } catch (error) {
        if (!isMissingFileError(error)) throw error
      }
    }

    entries.sort((left, right) => left.mtimeMs - right.mtimeMs)
    let remainingFiles = entries.length
    let remainingBytes = entries.reduce((sum, entry) => sum + entry.size, 0)
    for (const entry of entries) {
      if (
        remainingFiles <= Math.max(0, maxFiles)
        && remainingBytes <= Math.max(0, maxBytes)
      ) {
        break
      }
      await fileSystem.rm(entry.filePath, { force: true })
      lastTouched.delete(entry.filePath)
      remainingFiles -= 1
      remainingBytes -= entry.size
    }
  }

  function touchAfterRead(filePath: string): void {
    const touchedAt = now()
    const previousTouch = lastTouched.get(filePath)
    if (previousTouch !== undefined && touchedAt - previousTouch < touchIntervalMs) return

    lastTouched.set(filePath, touchedAt)
    const date = new Date(touchedAt)
    void fileSystem.utimes(filePath, date, date).catch(() => undefined)
  }

  return {
    directory: cacheDirectory,
    getPath,
    read,
    writeAtomic,
    prune,
  }
}

export function createCachedRenderService({
  store,
  render,
  version = RENDER_CACHE_VERSION,
  pruneIntervalMs = 60_000,
  onPruneError = () => undefined,
  now = Date.now,
}: CreateCachedRenderServiceOptions) {
  const pending = new Map<string, Promise<CachedRenderResult>>()
  let lastPruneStartedAt = Number.NEGATIVE_INFINITY
  let prunePromise: Promise<void> | null = null

  async function renderCached(code: string): Promise<CachedRenderResult> {
    const hash = createRenderCacheKey(code, version)
    const existingBeforeRead = pending.get(hash)
    if (existingBeforeRead) return existingBeforeRead

    const cached = await store.read(hash)
    if (cached !== null) return { hash, data: cached }

    const existingAfterRead = pending.get(hash)
    if (existingAfterRead) return existingAfterRead

    const renderPromise = (async () => {
      const data = await render(code)
      await store.writeAtomic(hash, data)
      schedulePrune()
      return { hash, data }
    })()
    pending.set(hash, renderPromise)
    try {
      return await renderPromise
    } finally {
      if (pending.get(hash) === renderPromise) {
        pending.delete(hash)
      }
    }
  }

  return {
    render: renderCached,
  }

  function schedulePrune(): void {
    const currentTime = now()
    if (prunePromise || currentTime - lastPruneStartedAt < pruneIntervalMs) return

    lastPruneStartedAt = currentTime
    prunePromise = store.prune()
      .catch(onPruneError)
      .finally(() => {
        prunePromise = null
      })
  }
}

function assertCacheHash(hash: string): void {
  if (!RENDER_CACHE_HASH_PATTERN.test(hash)) {
    throw new Error('Invalid render cache hash')
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && error.code === 'ENOENT',
  )
}
