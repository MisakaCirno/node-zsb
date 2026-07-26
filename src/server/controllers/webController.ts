import Elysia, { file, status, t } from 'elysia'
import type { Context } from 'elysia'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultCode } from '../utils/getCode.ts'
import { getAllIconConfigs, iconGroups } from '../utils/iconMap.ts'
import { getBoardUrl, getIconUrl } from '../utils/staticImage.ts'
import { getBoardBackgrounds } from '../../shared/backgrounds.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..', '..')
const webDir = path.join(rootDir, 'src', 'web')
const sharedDir = path.join(rootDir, 'src', 'shared')
const distWebDir = path.join(rootDir, 'dist', 'web')
const distSharedDir = path.join(rootDir, 'dist', 'shared')
const assetManifestPath = path.join(rootDir, 'dist', 'asset-manifest.json')
const scriptAssetPattern = /^[A-Za-z][A-Za-z0-9]*\.js$/
const webAssetPattern = /^(?:[A-Za-z][A-Za-z0-9]*\.js|styles\.css)$/
const immutableCacheControl = 'public, max-age=31536000, immutable'

interface WebAssetManifest {
  format: 'node-zsb-web-assets'
  version: 1
  webVersion: string
  stylesVersion: string
  vendorVersion: string
  assets: Record<string, string>
}

type ResponseHeaders = NonNullable<Context['set']['headers']>

export const webController = new Elysia()
  .get('/editor', ({ set }) => {
    setNoStore(set.headers)
    return file(path.join(getWebAssetDir(), 'index.html'))
  })
  .get(
    '/editor/:asset',
    ({ params, query, set }) => serveScriptOrFile(
      getWebAssetDir(),
      webDir,
      params.asset,
      query.v,
      getWebAssetVersion(params.asset),
      set.headers,
    ),
    {
      params: t.Object({
        asset: t.RegExp(webAssetPattern),
      }),
    },
  )
  .get(
    '/shared/:asset',
    ({ params, query, set }) => serveScriptOrFile(
      getSharedAssetDir(),
      sharedDir,
      params.asset,
      query.v,
      getAssetManifest()?.webVersion,
      set.headers,
    ),
    {
      params: t.Object({
        asset: t.RegExp(scriptAssetPattern),
      }),
    },
  )
  .get('/editor-data', ({ set }) => {
    setNoStore(set.headers)
    return {
      defaultCode,
      iconGroups,
      iconConfigs: getAllIconConfigs(),
      backgrounds: getBoardBackgrounds(),
      assetVersions: getAssetManifest()?.assets ?? {},
    }
  })
  .get('/vendor/konva.min.js', ({ query, set }) => {
    setVersionedCache(set.headers, query.v, getAssetManifest()?.vendorVersion)
    return file(path.join(rootDir, 'node_modules', 'konva', 'konva.min.js'))
  })
  .get(
    '/assets/background/:name',
    ({ params, query, set }) => serveStaticAsset(
      getBoardUrl(params.name.replace('.webp', '')),
      `/assets/background/${ensureExtension(params.name, '.webp')}`,
      query.v,
      set.headers,
    ),
    {
      params: t.Object({
        name: t.RegExp(/^[1-7](\.webp)?$/),
      }),
    },
  )
  .get(
    '/assets/objects/:name',
    ({ params, query, set }) => serveStaticAsset(
      getIconUrl(params.name.replace('.webp', '')),
      `/assets/objects/${ensureExtension(params.name, '.webp')}`,
      query.v,
      set.headers,
    ),
    {
      params: t.Object({
        name: t.RegExp(/^[a-z0-9_]+(\.webp)?$/),
      }),
      error() {
        return status(404, {
          ok: false,
          error: '资源不存在',
        })
      },
    },
  )
  .get(
    '/assets/fonts/:name',
    ({ params, query, set }) => serveStaticAsset(
      path.join(rootDir, 'src', 'assets', 'fonts', params.name),
      `/assets/fonts/${params.name}`,
      query.v,
      set.headers,
    ),
    {
      params: t.Object({
        name: t.RegExp(/^[A-Za-z0-9_.-]+\.(?:ttf|woff2)$/),
      }),
    },
  )

async function serveScriptOrFile(
  assetDirectory: string,
  sourceDirectory: string,
  asset: string,
  requestedVersion: string | undefined,
  expectedVersion: string | undefined,
  headers: ResponseHeaders,
) {
  const filePath = path.join(assetDirectory, asset)
  if (existsSync(filePath)) {
    setVersionedCache(headers, requestedVersion, expectedVersion)
    return file(filePath)
  }
  setNoStore(headers)
  if (!asset.endsWith('.js')) return file(filePath)

  const sourcePath = path.join(sourceDirectory, asset.replace(/\.js$/, '.ts'))
  if (!existsSync(sourcePath)) return file(filePath)

  const source = await readFile(sourcePath, 'utf8')
  const ts = await import('typescript')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      verbatimModuleSyntax: true,
    },
    fileName: sourcePath,
  }).outputText

  return new Response(output, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/javascript; charset=utf-8',
    },
  })
}

function serveStaticAsset(
  filePath: string,
  publicPath: string,
  requestedVersion: string | undefined,
  headers: ResponseHeaders,
) {
  setVersionedCache(
    headers,
    requestedVersion,
    getAssetManifest()?.assets[publicPath],
  )
  return file(filePath)
}

function getWebAssetDir() {
  return shouldServeBuiltAssets() && existsSync(path.join(distWebDir, 'app.js')) ? distWebDir : webDir
}

function getSharedAssetDir() {
  return shouldServeBuiltAssets() && existsSync(path.join(distSharedDir, 'backgrounds.js')) ? distSharedDir : sharedDir
}

function setNoStore(headers: ResponseHeaders) {
  headers['cache-control'] = 'no-store'
}

function setVersionedCache(
  headers: ResponseHeaders,
  requestedVersion: string | undefined,
  expectedVersion: string | undefined,
) {
  if (requestedVersion && expectedVersion && requestedVersion === expectedVersion) {
    headers['cache-control'] = immutableCacheControl
    headers.etag = `"${expectedVersion}"`
    return
  }
  setNoStore(headers)
}

function getWebAssetVersion(asset: string): string | undefined {
  const manifest = getAssetManifest()
  return asset === 'styles.css' ? manifest?.stylesVersion : manifest?.webVersion
}

let cachedAssetManifest: WebAssetManifest | null | undefined

function getAssetManifest(): WebAssetManifest | null {
  if (!shouldServeBuiltAssets()) return null
  if (cachedAssetManifest !== undefined) return cachedAssetManifest
  try {
    const value: unknown = JSON.parse(readFileSync(assetManifestPath, 'utf8'))
    cachedAssetManifest = isWebAssetManifest(value) ? value : null
  } catch {
    cachedAssetManifest = null
  }
  return cachedAssetManifest
}

function isWebAssetManifest(value: unknown): value is WebAssetManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<WebAssetManifest>
  return manifest.format === 'node-zsb-web-assets'
    && manifest.version === 1
    && typeof manifest.webVersion === 'string'
    && typeof manifest.stylesVersion === 'string'
    && typeof manifest.vendorVersion === 'string'
    && Boolean(manifest.assets && typeof manifest.assets === 'object')
}

function ensureExtension(value: string, extension: string): string {
  return value.endsWith(extension) ? value : `${value}${extension}`
}

function shouldServeBuiltAssets() {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ZSB_SERVE_DIST === '1'
}
