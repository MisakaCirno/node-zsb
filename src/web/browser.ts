export function getBrowserWindow(): Window {
  if (typeof window === 'undefined') {
    throw new Error('Browser window is not available')
  }
  return window
}

export function getOptionalBrowserWindow(): Window | null {
  return typeof window === 'undefined' ? null : window
}

export function getBrowserDocument(): Document {
  if (typeof document !== 'undefined') {
    return document
  }
  return getBrowserWindow().document
}

export function getBrowserNavigator(): Navigator {
  if (typeof navigator === 'undefined') {
    throw new Error('Browser navigator is not available')
  }
  return navigator
}

export function getBrowserLocalStorage(): Storage {
  return getBrowserWindow().localStorage
}
