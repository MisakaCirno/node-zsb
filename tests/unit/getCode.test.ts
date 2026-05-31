import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BoardCodeError,
  MAX_BOARD_CODE_LENGTH,
  MAX_RENDER_OBJECTS,
  validateBoardCodeInput,
} from '../../src/server/utils/getCode.ts'

test('board code validation limits match the current share-code format bounds', () => {
  assert.equal(MAX_BOARD_CODE_LENGTH, 2736)
  assert.equal(MAX_RENDER_OBJECTS, 50)
})

test('board code validation rejects oversized board codes before decoding', () => {
  const code = `[stgy:${'a'.repeat(MAX_BOARD_CODE_LENGTH)}]`

  assert.throws(() => validateBoardCodeInput(code), BoardCodeError)
})

test('board code validation rejects invalid board code wrappers', () => {
  assert.throws(() => validateBoardCodeInput('not-a-board-code'), BoardCodeError)
})
