import Elysia, { file, status, t } from 'elysia'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultCode } from '../utils/getCode.ts'
import { getAllIconConfigs, iconGroups } from '../utils/iconMap.ts'
import { getBoardUrl, getIconUrl } from '../utils/staticImage.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..')
const webDir = path.join(rootDir, 'src', 'web')
const sharedDir = path.join(rootDir, 'src', 'shared')

export const webController = new Elysia()
  .get('/editor', () => file(path.join(webDir, 'index.html')))
  .get(
    '/editor/:asset',
    ({ params }) => file(path.join(webDir, params.asset)),
    {
      params: t.Object({
        asset: t.RegExp(/^(?:[A-Za-z][A-Za-z0-9]*\.js|styles\.css)$/),
      }),
    },
  )
  .get(
    '/shared/:asset',
    ({ params }) => file(path.join(sharedDir, params.asset)),
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
