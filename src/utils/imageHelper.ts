import { file } from 'elysia'
import { existsSync, mkdirSync } from 'fs'
import sharp, { type Sharp } from 'sharp'
import { renderBoard } from '../standalone/renderer.ts'
import { createHash } from 'crypto'
import { getCode } from './getCode.ts'
import type { DecodeResult } from 'xiv-strat-board'
import { rgbaToThumbHash } from 'thumbhash'

const rendererCache = new Map<string, Promise<Buffer>>()

// 外部调用接口
export function renderImage(code = 'default') {
  const { hash, filePath } = getHashKey(code)
  const cache = getCache(hash)
  if (cache) {
    return cache
  }

  const renderPromise = stageLoader(code, hash, filePath).catch((err) => {
    console.error(`code: ${code} render error. clean cache`);
    rendererCache.delete(hash)
    throw err
  })
  rendererCache.set(hash, renderPromise)
  return renderPromise
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
  const webp = sharp(buffer).webp({ quality: 80 })

  // save to file
  // Ensure cache directory exists
  if (!existsSync('./cache')) {
    mkdirSync('./cache')
  }
  webp.toFile(filePath).then(() => {
    rendererCache.delete(hash)
  })

  return webp.toBuffer()
}

async function renderStage(boardData: DecodeResult) {
  const stage = await renderBoard(boardData)
  stage.draw()
  const data = stage.toDataURL()
  return Buffer.from(data.split(',')[1] as string, 'base64')
}

export function getHashKey(code: string) {
  const hash = createHash('sha256').update(code).digest('hex')

  const filePath = getCachePath(hash)
  return { hash, filePath }
}

export function getCachePath(hash: string) {
  return `./cache/${hash}.webp`
}

// 离线渲染用
export async function renderImageOffline(code: string) {
  const { hash, filePath } = getHashKey(code)
  const boardData = getCode(code)

  let image: Sharp
  // 如果缓存存在,读文件
  if (existsSync(filePath)) {
    image = sharp(filePath)
  } else {
    // 否则渲染并保存
    const buffer = await renderStage(boardData)
    const img = sharp(buffer)
    image = img.clone()

    // 保存文件
    // Ensure cache directory exists
    if (!existsSync('./cache')) {
      mkdirSync('./cache')
    }
    img.webp({ quality: 80 }).toFile(filePath)
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
