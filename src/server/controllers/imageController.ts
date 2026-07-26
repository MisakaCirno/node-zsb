import Elysia, { status, t } from 'elysia'
import {
  readCachedImage,
  renderImageOffline,
  renderImageWithMetadata,
} from '../utils/imageHelper.ts'
import { isBoardCodeError, validateBoardCodeInput } from '../utils/getCode.ts'
import {
  RENDER_CACHE_HASH_PATTERN,
  RENDER_CACHE_VERSION,
  type CachedRenderResult,
} from '../utils/renderCache.ts'

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const REVALIDATE_CACHE_CONTROL = 'public, no-cache'
const NO_STORE_CACHE_CONTROL = 'no-store'

export interface BoardControllerDependencies {
  renderVersion: string
  render(code?: string): Promise<CachedRenderResult>
  renderOffline(code?: string): Promise<{ hash: string, thumbhash: string }>
  readCached(hash: string): Promise<Buffer | null>
  validate(code?: string): void
}

const defaultDependencies: BoardControllerDependencies = {
  renderVersion: RENDER_CACHE_VERSION,
  render: renderImageWithMetadata,
  renderOffline: renderImageOffline,
  readCached: readCachedImage,
  validate: validateBoardCodeInput,
}

export function createBoardController(
  dependencies: BoardControllerDependencies = defaultDependencies,
) {
  return new Elysia()
    .get(
      '/board/:code?',
      async ({ params, query, request, set }) => {
        set.headers['cache-control'] = NO_STORE_CACHE_CONTROL
        try {
          const requestedVersion = query.rv
          if (
            requestedVersion !== undefined
            && requestedVersion !== dependencies.renderVersion
          ) {
            dependencies.validate(params.code)
            return renderVersionRedirect(request.url, dependencies.renderVersion)
          }

          const { hash, data } = await dependencies.render(params.code)
          const cacheControl = requestedVersion === dependencies.renderVersion
            ? IMMUTABLE_CACHE_CONTROL
            : REVALIDATE_CACHE_CONTROL
          const etag = createRenderEtag(hash)
          set.headers = {
            'cache-control': cacheControl,
            'content-type': 'image/webp',
            etag,
          }
          if (etagMatches(request.headers.get('if-none-match'), etag)) {
            set.status = 304
            return null
          }
          return data
        } catch (error) {
          if (isBoardCodeError(error)) {
            throw status(400, {
              ok: false,
              error: error.message,
            })
          }
          throw error
        }
      },
      {
        detail: {
          description: '鏍规嵁鎴樻湳鏉夸唬鐮佹覆鏌撴垬鏈澘鍥剧墖,杩斿洖webp鏍煎紡鍥剧墖',
        },
      },
    )
    .post(
      '/board/render',
      async ({ body, set }) => {
        set.headers['cache-control'] = NO_STORE_CACHE_CONTROL
        try {
          const info = await dependencies.renderOffline(body.code)
          return {
            ok: true,
            data: info,
          }
        } catch (error) {
          if (isBoardCodeError(error)) {
            throw status(400, {
              ok: false,
              error: error.message,
            })
          }
          throw error
        }
      },
      {
        body: t.Object({
          code: t.String({ description: '鎴樻湳鏉夸唬鐮?' }),
        }),
        detail: {
          description:
            '瑙ｆ瀽鎴樻湳鏉垮苟杩斿洖鐗堟湰鍖栧浘鐗?hash 鍜岀缉鐣ュ浘锛涚浉鍚岃姹備細澶嶇敤缂撳瓨骞跺悎骞惰繘绋嬪唴骞跺彂娓叉煋',
        },
      },
    )
    .get(
      '/preview/:name',
      async ({ params, request, set }) => {
        set.headers['cache-control'] = NO_STORE_CACHE_CONTROL
        const hash = params.name.replace('.webp', '')
        const data = await dependencies.readCached(hash)
        if (data === null) {
          throw status(404, {
            ok: false,
            error: '棰勮鍥句笉瀛樺湪',
          })
        }

        const etag = createRenderEtag(hash)
        set.headers = {
          'cache-control': IMMUTABLE_CACHE_CONTROL,
          'content-type': 'image/webp',
          etag,
        }
        if (etagMatches(request.headers.get('if-none-match'), etag)) {
          set.status = 304
          return null
        }
        return data
      },
      {
        params: t.Object({
          name: t.RegExp(/^[a-f0-9]{64}(\.webp)?$/, { description: '鍥剧墖鍚?' }),
        }),
        detail: {
          description:
            '鏍规嵁鍥剧墖hash鑾峰彇棰勮鍥?杩斿洖webp鏍煎紡鍥剧墖.鍥剧墖涓嶅瓨鍦ㄤ細杩斿洖404',
        },
      },
    )
}

export const boardController = createBoardController()

function createRenderEtag(hash: string): string {
  if (!RENDER_CACHE_HASH_PATTERN.test(hash)) {
    throw new Error('Invalid render cache hash')
  }
  return `"${hash}"`
}

function etagMatches(value: string | null, etag: string): boolean {
  if (!value) return false
  return value.split(',').some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//, '')
    return normalized === '*' || normalized === etag
  })
}

function renderVersionRedirect(requestUrl: string, version: string): Response {
  const search = new URL(requestUrl).searchParams
  search.set('rv', version)
  return new Response(null, {
    status: 307,
    headers: {
      'cache-control': NO_STORE_CACHE_CONTROL,
      location: `?${search.toString()}`,
    },
  })
}
