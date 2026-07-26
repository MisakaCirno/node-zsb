import { toAppUrl } from './appUrl.js'

let configuredAssetVersions: Readonly<Record<string, string>> = {}

export function configureAssetVersions(versions: Readonly<Record<string, string>>): void {
  configuredAssetVersions = { ...versions }
}

export function toAssetUrl(
  path: string,
  pathname?: string,
  versions: Readonly<Record<string, string>> = configuredAssetVersions,
): string {
  const url = toAppUrl(path, pathname)
  const version = versions[path]
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}
