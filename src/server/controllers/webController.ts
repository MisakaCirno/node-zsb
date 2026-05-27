import Elysia, { file, status, t } from 'elysia'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { defaultCode } from '../utils/getCode.ts'
import { getAllIconConfigs, iconGroups } from '../utils/iconMap.ts'
import { getBoardUrl, getIconUrl } from '../utils/staticImage.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..', '..')
const webDir = path.join(rootDir, 'src', 'web')
const sharedDir = path.join(rootDir, 'src', 'shared')

export const webController = new Elysia()
  .get('/editor', () => file(path.join(webDir, 'index.html')))
  .get(
    '/editor/:asset',
    ({ params }) => serveScriptOrFile(webDir, params.asset),
    {
      params: t.Object({
        asset: t.RegExp(/^(?:[A-Za-z][A-Za-z0-9]*\.js|styles\.css)$/),
      }),
    },
  )
  .get(
    '/shared/:asset',
    ({ params }) => serveScriptOrFile(sharedDir, params.asset),
    {
      params: t.Object({
        asset: t.RegExp(/^boardGeometry\.js$/),
      }),
    },
  )
  .get('/editor-data', () => ({
    defaultCode,
    iconGroups,
    iconConfigs: getAllIconConfigs(),
    backgrounds: {
      none: '1',
      checkered: '2',
      checkered_circle: '3',
      checkered_square: '4',
      grey: '5',
      grey_circle: '6',
      grey_square: '7',
    },
  }))
  .get('/vendor/konva.min.js', () =>
    file(path.join(rootDir, 'node_modules', 'konva', 'konva.min.js')),
  )
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

async function serveScriptOrFile(directory: string, asset: string) {
  const filePath = path.join(directory, asset)
  if (!asset.endsWith('.js') || existsSync(filePath)) {
    return file(filePath)
  }

  const sourcePath = path.join(directory, asset.replace(/\.js$/, '.ts'))
  if (!existsSync(sourcePath)) return file(filePath)

  const source = await readFile(sourcePath, 'utf8')
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
      'content-type': 'application/javascript; charset=utf-8',
    },
  })
}
