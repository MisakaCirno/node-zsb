import assert from 'node:assert/strict'
import * as nodeFs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  createCachedRenderService,
  createRenderCacheKey,
  createRenderCacheStore,
  type RenderCacheFileSystem,
} from '../../src/server/utils/renderCache.ts'

test('render cache keys isolate versions while keeping old hashes readable', async () => {
  await withTempDirectory(async (directory) => {
    const store = createRenderCacheStore({ directory })
    let currentRenderCount = 0
    const oldService = createCachedRenderService({
      store,
      version: 'old-renderer',
      render: async () => Buffer.from('old'),
    })
    const currentService = createCachedRenderService({
      store,
      version: 'current-renderer',
      render: async () => {
        currentRenderCount += 1
        return Buffer.from('current')
      },
    })

    const oldResult = await oldService.render('same-code')
    const currentResult = await currentService.render('same-code')
    const currentHit = await currentService.render('same-code')

    assert.notEqual(oldResult.hash, currentResult.hash)
    assert.match(currentResult.hash, /^[a-f0-9]{64}$/)
    assert.equal(currentHit.hash, currentResult.hash)
    assert.equal(currentHit.data.toString(), 'current')
    assert.equal(currentRenderCount, 1)
    assert.equal((await store.read(oldResult.hash))?.toString(), 'old')
  })
})

test('render cache deduplicates concurrent work for the same versioned key', async () => {
  await withTempDirectory(async (directory) => {
    const store = createRenderCacheStore({ directory })
    let renderCount = 0
    let releaseRender: () => void = () => {}
    const renderGate = new Promise<void>((resolve) => {
      releaseRender = resolve
    })
    let signalStarted: () => void = () => {}
    const renderStarted = new Promise<void>((resolve) => {
      signalStarted = resolve
    })
    const service = createCachedRenderService({
      store,
      render: async () => {
        renderCount += 1
        signalStarted()
        await renderGate
        return Buffer.from('shared')
      },
    })

    const first = service.render('concurrent')
    const second = service.render('concurrent')
    await renderStarted
    releaseRender()
    const [firstResult, secondResult] = await Promise.all([first, second])

    assert.equal(renderCount, 1)
    assert.equal(firstResult.hash, secondResult.hash)
    assert.equal(firstResult.data.toString(), 'shared')
    assert.equal(secondResult.data.toString(), 'shared')
  })
})

test('render cache publishes files atomically and removes temporary files', async () => {
  await withTempDirectory(async (directory) => {
    const hash = 'a'.repeat(64)
    let releaseRename: () => void = () => {}
    const renameGate = new Promise<void>((resolve) => {
      releaseRename = resolve
    })
    let signalRename: () => void = () => {}
    const renameStarted = new Promise<void>((resolve) => {
      signalRename = resolve
    })
    const fileSystem = createFileSystem({
      rename: async (sourcePath, targetPath) => {
        signalRename()
        await renameGate
        await nodeFs.rename(sourcePath, targetPath)
      },
    })
    const store = createRenderCacheStore({ directory, fileSystem })
    const write = store.writeAtomic(hash, Buffer.from('atomic'))

    await renameStarted
    await assert.rejects(nodeFs.access(store.getPath(hash)))
    assert.equal((await nodeFs.readdir(directory)).some((name) => name.endsWith('.tmp')), true)

    releaseRename()
    await write
    assert.equal((await store.read(hash))?.toString(), 'atomic')
    assert.deepEqual(await nodeFs.readdir(directory), [`${hash}.webp`])
  })
})

test('failed cache writes clean temporary files and allow a later retry', async () => {
  await withTempDirectory(async (directory) => {
    let renameCount = 0
    const fileSystem = createFileSystem({
      rename: async (sourcePath, targetPath) => {
        renameCount += 1
        if (renameCount === 1) throw new Error('simulated rename failure')
        await nodeFs.rename(sourcePath, targetPath)
      },
    })
    const store = createRenderCacheStore({ directory, fileSystem })
    let renderCount = 0
    const service = createCachedRenderService({
      store,
      render: async () => {
        renderCount += 1
        return Buffer.from(`render-${renderCount}`)
      },
    })

    await assert.rejects(service.render('retry'), /simulated rename failure/)
    assert.deepEqual(await nodeFs.readdir(directory), [])

    const recovered = await service.render('retry')
    assert.equal(renderCount, 2)
    assert.equal(recovered.data.toString(), 'render-2')
    assert.deepEqual(await nodeFs.readdir(directory), [`${recovered.hash}.webp`])
  })
})

test('render cache pruning removes the oldest versioned files first', async () => {
  await withTempDirectory(async (directory) => {
    const store = createRenderCacheStore({ directory, maxFiles: 2 })
    const hashes = ['a', 'b', 'c'].map((value) => value.repeat(64))
    for (const hash of hashes) {
      await store.writeAtomic(hash, Buffer.from(hash[0] as string))
    }
    await nodeFs.utimes(store.getPath(hashes[0] as string), new Date(1_000), new Date(1_000))
    await nodeFs.utimes(store.getPath(hashes[1] as string), new Date(2_000), new Date(2_000))
    await nodeFs.utimes(store.getPath(hashes[2] as string), new Date(3_000), new Date(3_000))

    await store.prune()

    assert.equal(await store.read(hashes[0] as string), null)
    assert.equal((await store.read(hashes[1] as string))?.toString(), 'b')
    assert.equal((await store.read(hashes[2] as string))?.toString(), 'c')
  })
})

test('render cache key is stable for the same version and code', () => {
  assert.equal(
    createRenderCacheKey('stable-code', 'stable-version'),
    createRenderCacheKey('stable-code', 'stable-version'),
  )
  assert.notEqual(
    createRenderCacheKey('stable-code', 'stable-version'),
    createRenderCacheKey('stable-code', 'next-version'),
  )
})

function createFileSystem(
  overrides: Partial<RenderCacheFileSystem> = {},
): RenderCacheFileSystem {
  return {
    mkdir: (directory) => nodeFs.mkdir(directory, { recursive: true }),
    readFile: (filePath) => nodeFs.readFile(filePath),
    writeFile: (filePath, data) => nodeFs.writeFile(filePath, data),
    rename: (sourcePath, targetPath) => nodeFs.rename(sourcePath, targetPath),
    rm: (filePath, options) => nodeFs.rm(filePath, options),
    readdir: (directory) => nodeFs.readdir(directory),
    stat: (filePath) => nodeFs.stat(filePath),
    ...overrides,
  }
}

async function withTempDirectory(
  action: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await nodeFs.mkdtemp(path.join(os.tmpdir(), 'node-zsb-cache-'))
  try {
    await action(directory)
  } finally {
    await nodeFs.rm(directory, { recursive: true, force: true })
  }
}
