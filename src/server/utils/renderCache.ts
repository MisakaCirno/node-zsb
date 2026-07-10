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
  stat(filePath: string): Promise<{ mtimeMs: number }>
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
  fileSystem?: RenderCacheFileSystem
}

interface CreateCachedRenderServiceOptions {
  store: RenderCacheStore
  render(code: string): Promise<Buffer>
  version?: string
  onPruneError?(error: unknown): void
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
  fileSystem = defaultFileSystem,
}: CreateRenderCacheStoreOptions): RenderCacheStore {
  const cacheDirectory = path.resolve(directory)

  function getPath(hash: string): string {
    assertCacheHash(hash)
    return path.join(cacheDirectory, `${hash}.webp`)
  }

  async function read(hash: string): Promise<Buffer | null> {
    try {
      return await fileSystem.readFile(getPath(hash))
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

    const entries: Array<{ filePath: string, mtimeMs: number }> = []
    for (const name of names) {
      if (!name.endsWith('.webp')) continue
      const hash = name.slice(0, -'.webp'.length)
      if (!RENDER_CACHE_HASH_PATTERN.test(hash)) continue
      const filePath = path.join(cacheDirectory, name)
      try {
        const { mtimeMs } = await fileSystem.stat(filePath)
        entries.push({ filePath, mtimeMs })
      } catch (error) {
        if (!isMissingFileError(error)) throw error
      }
    }

    entries.sort((left, right) => left.mtimeMs - right.mtimeMs)
    const overflow = entries.length - Math.max(0, maxFiles)
    for (const entry of entries.slice(0, Math.max(0, overflow))) {
      await fileSystem.rm(entry.filePath, { force: true })
    }
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
  onPruneError = () => undefined,
}: CreateCachedRenderServiceOptions) {
  const pending = new Map<string, Promise<CachedRenderResult>>()

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
      try {
        await store.prune()
      } catch (error) {
        onPruneError(error)
      }
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
