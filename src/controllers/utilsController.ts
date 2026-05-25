import Elysia, { status, t } from 'elysia'
import { decode, encode, type StrategyBoard } from 'xiv-strat-board'

export const utilsController = new Elysia({ prefix: '/utils' })
  .post(
    '/code2json',
    async ({ body }) => {
      const { code } = body
      try {
        const board = decode(code)
        return {
          ok: true,
          data: board,
        }
      } catch (error) {
        throw status(400, {
          ok: false,
          error: (error as Error).message,
        })
      }
    },
    {
      body: t.Object({
        code: t.String(),
      }),
      detail: {
        description: '战术板代码转JSON',
      },
    }
  )
  .post(
    '/json2code',
    async ({ body }) => {
      try {
        const code = encode(body.board as StrategyBoard, {
          key: body.key,
        })
        return { ok: true, code }
      } catch (error) {
        throw status(400, {
          ok: false,
          error: (error as Error).message,
        })
      }
    },
    {
      body: t.Object({
        board: t.Any(),
        key: t.Integer({ minimum: 0, maximum: 63, default: 14 }),
      }),
      detail: {
        description: '战术板JSON转代码,默认的key是14',
      },
    }
  )
