import { file } from 'elysia'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import sharp, { type Sharp } from 'sharp'
import { renderBoard } from '../renderer/renderer.ts'
import { createHash } from 'crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultCode, getCode, validateBoardCodeInput } from './getCode.ts'
import type { DecodeResult } from 'xiv-strat-board'
import { rgbaToThumbHash } from 'thumbhash'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cacheDir = path.resolve(__dirname, '..', '..', '..', 'cache')
const rendererCache = new Map<string, Promise<Buffer>>()
const MAX_CACHE_FILES = 500
const cacheFilePattern = /^[a-f0-9]{64}\.webp$/

// 外部调用接口
export function renderImage(code = defaultCode) {
  const { hash, filePath } = getHashKey(code)
  const cache = getCache(hash)
  if (cache) {
    return cache
  }

  return renderImageToCache(code, hash, filePath)
}

export function getCache(hash: string) {
  // check static cache
  const path = getCachePath(hash)
  if (existsSync(path)) {
    return file(path)
  }

  // check processing cache
  if (rendererCache.has(hash)) {
    return rendererCache.get(hash)!
  }
  return null
}

async function stageLoader(code: string, hash: string, filePath: string) {
  const boardData = getCode(code)

  // render board image
  const buffer = await renderStage(boardData)

  // convert to webp and save to cache
  const image = sharp(buffer)
  const webp = image.clone().webp({ quality: 80 })

  // save to file
  ensureCacheDir()
  const result = await webp.toBuffer()
  await sharp(result).toFile(filePath)
  pruneCacheDir()
  rendererCache.delete(hash)

  return result
}

function renderImageToCache(code: string, hash: string, filePath: string): Promise<Buffer> {
  const existing = rendererCache.get(hash)
  if (existing) return existing
  const renderPromise = stageLoader(code, hash, filePath).catch((err) => {
    console.error(`code hash: ${hash} render error. clean cache`)
    rendererCache.delete(hash)
    throw err
  })
  rendererCache.set(hash, renderPromise)
  return renderPromise
}

async function renderStage(boardData: DecodeResult) {
  const stage = await renderBoard(boardData)
  try {
    stage.draw()
    const data = stage.toDataURL()
    return Buffer.from(data.split(',')[1] as string, 'base64')
  } finally {
    stage.destroy()
  }
}

export function getHashKey(code: string) {
  validateBoardCodeInput(code)
  const hash = createHash('sha256').update(code).digest('hex')

  const filePath = getCachePath(hash)
  return { hash, filePath }
}

export function getCachePath(hash: string) {
  return path.join(cacheDir, `${hash}.webp`)
}

// 离线渲染用
export async function renderImageOffline(code = defaultCode) {
  const { hash, filePath } = getHashKey(code)
  let image: Sharp
  // 如果缓存存在,读文件
  if (existsSync(filePath)) {
    image = sharp(filePath)
  } else {
    // 否则渲染并保存
    const webp = await renderImageToCache(code, hash, filePath)
    image = sharp(webp)

    // 保存文件
  }

  //生成缩略图
  const resizeImage = image.resize({ width: 64, height: 48, fit: 'inside' })
  const { data, info } = await resizeImage
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const binaryThumbHash = rgbaToThumbHash(info.width, info.height, data)
  const thumbHashToBase64 = Buffer.from(binaryThumbHash).toString('base64')
  return {
    hash,
    thumbhash: thumbHashToBase64,
  }
}

function ensureCacheDir() {
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }
}

function pruneCacheDir() {
  try {
    const entries = readdirSync(cacheDir)
      .filter((name) => cacheFilePattern.test(name))
      .map((name) => {
        const filePath = path.join(cacheDir, name)
        return {
          filePath,
          mtimeMs: statSync(filePath).mtimeMs,
        }
      })
      .sort((a, b) => a.mtimeMs - b.mtimeMs)
    const overflow = entries.length - MAX_CACHE_FILES
    if (overflow <= 0) return
    for (const entry of entries.slice(0, overflow)) {
      unlinkSync(entry.filePath)
    }
  } catch (error) {
    console.warn('Failed to prune render cache', error)
  }
}
