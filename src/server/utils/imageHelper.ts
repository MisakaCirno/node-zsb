import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp, { type Sharp } from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import type { DecodeResult } from 'xiv-strat-board'

import { renderBoard } from '../renderer/renderer.ts'
import { defaultCode, getCode, validateBoardCodeInput } from './getCode.ts'
import {
  RENDER_CACHE_VERSION,
  createCachedRenderService,
  createRenderCacheKey,
  createRenderCacheStore,
} from './renderCache.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cacheDir = path.resolve(__dirname, '..', '..', '..', 'cache')
const MAX_CACHE_FILES = 500
const renderCacheStore = createRenderCacheStore({
  directory: cacheDir,
  maxFiles: MAX_CACHE_FILES,
})
const renderCache = createCachedRenderService({
  store: renderCacheStore,
  render: renderCodeToWebp,
  onPruneError: (error) => console.warn('Failed to prune render cache', error),
})

export async function renderImage(code = defaultCode) {
  validateBoardCodeInput(code)
  return (await renderCache.render(code)).data
}

async function renderCodeToWebp(code: string): Promise<Buffer> {
  const boardData = getCode(code)
  const buffer = await renderStage(boardData)
  return sharp(buffer).webp({ quality: 80 }).toBuffer()
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

export function getHashKey(code: string, version = RENDER_CACHE_VERSION) {
  validateBoardCodeInput(code)
  const hash = createRenderCacheKey(code, version)
  const filePath = getCachePath(hash)
  return { hash, filePath }
}

export function getCachePath(hash: string) {
  return renderCacheStore.getPath(hash)
}

export async function renderImageOffline(code = defaultCode) {
  validateBoardCodeInput(code)
  const { hash, data } = await renderCache.render(code)
  const image: Sharp = sharp(data)
  const resizeImage = image.resize({ width: 64, height: 48, fit: 'inside' })
  const { data: rgba, info } = await resizeImage
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const binaryThumbHash = rgbaToThumbHash(info.width, info.height, rgba)
  const thumbHashToBase64 = Buffer.from(binaryThumbHash).toString('base64')
  return {
    hash,
    thumbhash: thumbHashToBase64,
  }
}
