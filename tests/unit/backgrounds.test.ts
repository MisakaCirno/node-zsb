import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BOARD_BACKGROUND_IDS,
  DEFAULT_BOARD_BACKGROUND,
  getBoardBackgroundId,
  getBoardBackgrounds,
  isBoardBackground,
} from '../../src/shared/backgrounds.js'

test('board background helpers expose the shared editor and renderer mapping', () => {
  assert.equal(DEFAULT_BOARD_BACKGROUND, 'checkered')
  assert.deepEqual(getBoardBackgrounds(), BOARD_BACKGROUND_IDS)
  assert.equal(getBoardBackgroundId('none'), '1')
  assert.equal(getBoardBackgroundId('grey_square'), '7')
  assert.equal(getBoardBackgroundId('missing'), BOARD_BACKGROUND_IDS[DEFAULT_BOARD_BACKGROUND])
})

test('isBoardBackground validates known background keys', () => {
  assert.equal(isBoardBackground('checkered'), true)
  assert.equal(isBoardBackground('grey'), true)
  assert.equal(isBoardBackground('tab1'), false)
  assert.equal(isBoardBackground(undefined), false)
})
