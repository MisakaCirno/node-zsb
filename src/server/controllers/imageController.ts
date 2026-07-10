import Elysia, { file, status, t } from 'elysia'
import {
  getCachePath,
  renderImage,
  renderImageOffline,
} from '../utils/imageHelper.ts'
import { isBoardCodeError } from '../utils/getCode.ts'

export const boardController = new Elysia()
  .get(
    '/board/:code?',
    async ({ params, set }) => {
      try {
        const webp = await renderImage(params.code)

        set.headers = {
          'content-type': 'image/webp',
        }
        return webp
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
        description: '根据战术板代码渲染战术板图片,返回webp格式图片',
      },
    },
  )
  .post(
    '/board/render',
    async ({ body }) => {
      try {
        const info = await renderImageOffline(body.code)
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
        code: t.String({ description: '战术板代码' }),
      }),
      detail: {
        description:
          '解析战术板并返回版本化图片 hash 和缩略图；相同请求会复用缓存并合并进程内并发渲染',
      },
    },
  )
  .get(
    '/preview/:name',
    async ({ params }) => {
      const hash = params.name.replace('.webp', '')
      return file(getCachePath(hash))
    },
    {
      params: t.Object({
        name: t.RegExp(/^[a-f0-9]{64}(\.webp)?$/, { description: '图片名' }),
      }),
      detail: {
        description:
          '根据图片hash获取预览图,返回webp格式图片.图片不存在会返回404',
      },
    },
  )
