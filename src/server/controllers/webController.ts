import Elysia, { file, status, t } from 'elysia'
import type { Context } from 'elysia'
import { existsSync } from 'node:fs'
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
const scriptAssetPattern = /^[A-Za-z][A-Za-z0-9]*\.js$/
const webAssetPattern = /^(?:[A-Za-z][A-Za-z0-9]*\.js|styles\.css)$/

type ResponseHeaders = NonNullable<Context['set']['headers']>

export const webController = new Elysia()
  .get('/editor', ({ set }) => {
    setNoStore(set.headers)
    return file(path.join(getWebAssetDir(), 'index.html'))
  })
  .get(
    '/editor/:asset',
    ({ params, set }) => serveScriptOrFile(getWebAssetDir(), webDir, params.asset, set.headers),
    {
      params: t.Object({
        asset: t.RegExp(webAssetPattern),
      }),
    },
  )
  .get(
    '/shared/:asset',
    ({ params, set }) => serveScriptOrFile(getSharedAssetDir(), sharedDir, params.asset, set.headers),
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
    }
  })
  .get('/vendor/konva.min.js', ({ set }) => {
    setNoStore(set.headers)
    return file(path.join(rootDir, 'node_modules', 'konva', 'konva.min.js'))
  })
  .get(
    '/assets/background/:name',
    ({ params }) => file(getBoardUrl(params.name.replace('.webp', ''))),
    {
      params: t.Object({
        name: t.RegExp(/^[1-7](\.webp)?$/),
      }),
    },
  )
  .get(
    '/assets/objects/:name',
    ({ params }) => file(getIconUrl(params.name.replace('.webp', ''))),
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
    ({ params }) => file(path.join(rootDir, 'src', 'assets', 'fonts', params.name)),
    {
      params: t.Object({
        name: t.RegExp(/^[A-Za-z0-9_.-]+\.ttf$/),
      }),
    },
  )

async function serveScriptOrFile(
  assetDirectory: string,
  sourceDirectory: string,
  asset: string,
  headers: ResponseHeaders,
) {
  setNoStore(headers)
  const filePath = path.join(assetDirectory, asset)
  if (existsSync(filePath)) {
    return file(filePath)
  }
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

function getWebAssetDir() {
  return existsSync(path.join(distWebDir, 'app.js')) ? distWebDir : webDir
}

function getSharedAssetDir() {
  return existsSync(path.join(distSharedDir, 'backgrounds.js')) ? distSharedDir : sharedDir
}

function setNoStore(headers: ResponseHeaders) {
  headers['cache-control'] = 'no-store'
}
