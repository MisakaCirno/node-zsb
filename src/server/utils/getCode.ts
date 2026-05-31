import { decode } from 'xiv-strat-board'

export const defaultCode =
  '[stgy:a2mW7zYpGVGucnON7LpkuDJH66enQBnNYQkCKKUR6lrKMrVuduwvMbQ5lYPO7cdfHNJexQfOqhOOYwu6DnluGxbRieZQbd41xysoX6g-8ue0Z14MAXSqNr+xsHeqFlaZ6P3ng1n6dc1xLH]'

const MAX_ENCODED_BOARD_OBJECTS = 50
const MAX_ENCODED_TEXT_OBJECTS = 8
const MAX_ENCODED_NAME_BYTES = 20
const MAX_ENCODED_TEXT_CODE_UNITS = 30
const MAX_UTF8_BYTES_PER_CODE_UNIT = 3
const MAX_DEFLATE_OVERHEAD_BYTES = 13
const CIPHER_HEADER_BYTES = 6
const SHARE_CODE_FIXED_CHARS = 9

export const MAX_RENDER_OBJECTS = MAX_ENCODED_BOARD_OBJECTS
export const MAX_BOARD_CODE_LENGTH = getMaxBoardCodeLength()

function getPaddedFieldLength(byteLength: number): number {
  return Math.max(8, (byteLength + 1 + 3) & ~3)
}

function getMaxBoardCodeLength(): number {
  const objectCount = MAX_ENCODED_BOARD_OBJECTS
  const headerSize = 28 + getPaddedFieldLength(MAX_ENCODED_NAME_BYTES)
  const maxTextBytes = MAX_ENCODED_TEXT_CODE_UNITS * MAX_UTF8_BYTES_PER_CODE_UNIT
  const maxTextContentSize = MAX_ENCODED_TEXT_OBJECTS * (4 + getPaddedFieldLength(maxTextBytes))
  const tag4Size = 6 + objectCount * 2
  const tag7Size = 6 + objectCount + (objectCount % 2 === 1 ? 1 : 0)
  const maxBinaryPayloadLength = headerSize
    + objectCount * 4
    + maxTextContentSize
    + tag4Size
    + (6 + objectCount * 4)
    + (6 + objectCount * 2)
    + tag7Size
    + (6 + objectCount * 4)
    + (6 + objectCount * 2)
    + (6 + objectCount * 2)
    + (6 + objectCount * 2)
    + 8
  const maxCompressedLength = maxBinaryPayloadLength + MAX_DEFLATE_OVERHEAD_BYTES
  return SHARE_CODE_FIXED_CHARS + Math.ceil((CIPHER_HEADER_BYTES + maxCompressedLength) * 4 / 3)
}

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

export function validateBoardCodeInput(code = defaultCode): void {
  if (code.length > MAX_BOARD_CODE_LENGTH) {
    throw new BoardCodeError(`战术板代码长度不能超过 ${MAX_BOARD_CODE_LENGTH}`)
  }
  if (!codeRegex.test(code)) {
    throw new BoardCodeError('Invalid share code: 战术板代码格式无效')
  }
}

export function getCode(code = defaultCode) {
  validateBoardCodeInput(code)

  try {
    const board = decode(code)
    if ((board.objects?.length ?? 0) > MAX_RENDER_OBJECTS) {
      throw new BoardCodeError(`战术板对象数量不能超过 ${MAX_RENDER_OBJECTS}`)
    }
    return board
  } catch (error) {
    if (isBoardCodeError(error)) {
      throw error
    }
    throw new BoardCodeError(
      `战术板代码解析失败: ${(error as Error).message}`,
    )
  }
}
