import {
  BOARD_SCALE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  STRATEGY_TEXT_FONT_FAMILY,
  STRATEGY_TEXT_SHADOW_BLUR,
  STRATEGY_TEXT_SHADOW_OFFSET,
  STRATEGY_TEXT_STROKE_WIDTH,
  calcTextWidth,
} from './boardGeometry.js'

export interface StrategyTextStyle {
  fill: string
  fontFamily: string
  fontSize: number
  offsetX: number
  offsetY: number
  shadowBlur: number
  shadowColor: string
  shadowEnabled: boolean
  shadowOffsetX: number
  shadowOffsetY: number
  stroke: string
  strokeWidth: number
  text: string
}

export function createStrategyTextStyle(text = '', color = DEFAULT_TEXT_COLOR): StrategyTextStyle {
  const fontSize = DEFAULT_TEXT_FONT_SIZE
  return {
    text,
    fill: color,
    stroke: 'black',
    strokeWidth: STRATEGY_TEXT_STROKE_WIDTH,
    fontFamily: STRATEGY_TEXT_FONT_FAMILY,
    fontSize,
    offsetX: calcTextWidth(text, fontSize) / 2,
    offsetY: fontSize / 2,
    shadowEnabled: true,
    shadowColor: 'black',
    shadowBlur: STRATEGY_TEXT_SHADOW_BLUR,
    shadowOffsetX: STRATEGY_TEXT_SHADOW_OFFSET,
    shadowOffsetY: STRATEGY_TEXT_SHADOW_OFFSET,
  }
}

export function getStrategyTextFontLoadSpec(): string {
  return `${DEFAULT_TEXT_FONT_SIZE}px ${STRATEGY_TEXT_FONT_FAMILY}`
}

export function getStrategyTextCanvasFont(scale: number): string {
  return `${Math.max(8, (DEFAULT_TEXT_FONT_SIZE / BOARD_SCALE) * scale)}px ${STRATEGY_TEXT_FONT_FAMILY}`
}

export function getStrategyTextCanvasStrokeWidth(scale: number): number {
  return Math.max(1, (STRATEGY_TEXT_STROKE_WIDTH / BOARD_SCALE) * scale)
}
