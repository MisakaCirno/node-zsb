const EDITOR_ENTRY_PATH = '/editor'

export function getAppBasePath(pathname = getBrowserPathname()): string {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  if (!normalizedPath.endsWith(EDITOR_ENTRY_PATH)) return ''
  return normalizedPath.slice(0, -EDITOR_ENTRY_PATH.length)
}

export function toAppUrl(path: string, pathname?: string): string {
  if (!path.startsWith('/')) {
    throw new Error('Application URLs must start with /')
  }
  return `${getAppBasePath(pathname)}${path}`
}

function getBrowserPathname(): string {
  return typeof window === 'undefined' ? EDITOR_ENTRY_PATH : window.location.pathname
}
