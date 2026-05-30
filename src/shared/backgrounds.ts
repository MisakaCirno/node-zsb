export const DEFAULT_BOARD_BACKGROUND = 'checkered'

export const BOARD_BACKGROUND_IDS = {
  none: '1',
  checkered: '2',
  checkered_circle: '3',
  checkered_square: '4',
  grey: '5',
  grey_circle: '6',
  grey_square: '7',
} as const

export type BoardBackground = keyof typeof BOARD_BACKGROUND_IDS

export function getBoardBackgroundId(background?: string): string {
  return isBoardBackground(background)
    ? BOARD_BACKGROUND_IDS[background]
    : BOARD_BACKGROUND_IDS[DEFAULT_BOARD_BACKGROUND]
}

export function getBoardBackgrounds(): Record<BoardBackground, string> {
  return { ...BOARD_BACKGROUND_IDS }
}

export function isBoardBackground(background: unknown): background is BoardBackground {
  return typeof background === 'string' && background in BOARD_BACKGROUND_IDS
}
