import {
  BOARD_SCALE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  STRATEGY_TEXT_FONT_FAMILY,
  STRATEGY_TEXT_FONT_WEIGHT,
  STRATEGY_TEXT_SHADOW_BLUR,
  STRATEGY_TEXT_SHADOW_OFFSET,
  STRATEGY_TEXT_STROKE_WIDTH,
  STRATEGY_TEXT_VISUAL_OFFSET_X,
  STRATEGY_TEXT_VISUAL_OFFSET_Y,
  calcTextWidth,
} from './boardGeometry.js'

export interface StrategyTextStyle {
  fill: string
  fontFamily: string
  fontSize: number
  fontStyle: string
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

interface MeasuredTextNode {
  height(): number
  setAttrs(attrs: Pick<StrategyTextStyle, 'offsetX' | 'offsetY'>): void
  width(): number
}

export function createStrategyTextStyle(text = '', color = DEFAULT_TEXT_COLOR): StrategyTextStyle {
  const fontSize = DEFAULT_TEXT_FONT_SIZE
  const offset = createStrategyTextOffset(calcTextWidth(text, fontSize), fontSize)
  return {
    text,
    fill: color,
    stroke: 'black',
    strokeWidth: STRATEGY_TEXT_STROKE_WIDTH,
    fontFamily: STRATEGY_TEXT_FONT_FAMILY,
    fontSize,
    fontStyle: String(STRATEGY_TEXT_FONT_WEIGHT),
    offsetX: offset.offsetX,
    offsetY: offset.offsetY,
    shadowEnabled: true,
    shadowColor: 'black',
    shadowBlur: STRATEGY_TEXT_SHADOW_BLUR,
    shadowOffsetX: STRATEGY_TEXT_SHADOW_OFFSET,
    shadowOffsetY: STRATEGY_TEXT_SHADOW_OFFSET,
  }
}

export function createStrategyTextOffset(
  width: number,
  height: number,
): Pick<StrategyTextStyle, 'offsetX' | 'offsetY'> {
  return {
    offsetX: width / 2 - STRATEGY_TEXT_VISUAL_OFFSET_X,
    offsetY: height / 2 - STRATEGY_TEXT_VISUAL_OFFSET_Y,
  }
}

export function applyMeasuredStrategyTextOffset<T extends MeasuredTextNode>(node: T): T {
  node.setAttrs(createStrategyTextOffset(node.width(), node.height()))
  return node
}

export function getStrategyTextFontLoadSpec(): string {
  return `${STRATEGY_TEXT_FONT_WEIGHT} ${DEFAULT_TEXT_FONT_SIZE}px ${STRATEGY_TEXT_FONT_FAMILY}`
}

export function getStrategyTextCanvasFont(scale: number): string {
  return `${STRATEGY_TEXT_FONT_WEIGHT} ${Math.max(8, (DEFAULT_TEXT_FONT_SIZE / BOARD_SCALE) * scale)}px ${STRATEGY_TEXT_FONT_FAMILY}`
}

export function getStrategyTextCanvasStrokeWidth(scale: number): number {
  return Math.max(1, (STRATEGY_TEXT_STROKE_WIDTH / BOARD_SCALE) * scale)
}
