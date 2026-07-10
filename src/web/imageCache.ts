export function loadCachedBrowserImage(
  cache: Map<string, Promise<HTMLImageElement>>,
  src: string,
  createImage: () => HTMLImageElement = () => new Image(),
): Promise<HTMLImageElement> {
  const cached = cache.get(src)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = createImage()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  }).catch((error) => {
    if (cache.get(src) === promise) {
      cache.delete(src)
    }
    throw error
  })
  cache.set(src, promise)
  return promise
}
