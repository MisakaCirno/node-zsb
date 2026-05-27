import { decode } from 'xiv-strat-board'

export const defaultCode =
  '[stgy:a2mW7zYpGVGucnON7LpkuDJH66enQBnNYQkCKKUR6lrKMrVuduwvMbQ5lYPO7cdfHNJexQfOqhOOYwu6DnluGxbRieZQbd41xysoX6g-8ue0Z14MAXSqNr+xsHeqFlaZ6P3ng1n6dc1xLH]'

export class BoardCodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardCodeError'
  }
}

const codeRegex = /^\[stgy:.+\]$/

export function isBoardCodeError(error: unknown): error is BoardCodeError {
  return error instanceof BoardCodeError
}

export function getCode(code = defaultCode) {
  if (!codeRegex.test(code)) {
    throw new BoardCodeError('战术板代码格式无效')
  }

  try {
    return decode(code)
  } catch (error) {
    throw new BoardCodeError(
      `战术板代码解析失败: ${(error as Error).message}`,
    )
  }
}
