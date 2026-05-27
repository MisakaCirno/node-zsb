import { Image } from 'skia-canvas'

const cache = new Map<string, Image>()
const pending = new Map<string, Promise<Image>>()

export function loadImage(url: string): Promise<Image> {
  const cached = cache.get(url)
  if (cached) {
    return Promise.resolve(cached)
  }

  const existing = pending.get(url)
  if (existing) {
    return existing
  }

  const promise = new Promise<Image>((resolve, reject) => {
    const imageObj = new Image()
    imageObj.onload = () => {
      cache.set(url, imageObj)
      pending.delete(url)
      resolve(imageObj)
    }
    imageObj.onerror = (err) => {
      pending.delete(url)
      reject(err)
    }
    imageObj.src = url
  })

  pending.set(url, promise)
  return promise
}
