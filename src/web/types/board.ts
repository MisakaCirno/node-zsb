export interface BoardObject {
  type: string
  x: number
  y: number
  editorId?: string
  size?: number
  color?: string
  transparency?: number
  text?: string
  endX?: number
  endY?: number
  angle?: number
  width?: number
  height?: number
  arcAngle?: number
  donutRadius?: number
  hidden?: boolean
  locked?: boolean
  [key: string]: unknown
}

export interface Board {
  name?: string
  boardBackground?: string
  objects: BoardObject[]
}

export interface NormalizedBoard {
  name: string
  boardBackground: string
  objects: BoardObject[]
}

export interface RectLike {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface IconConfig {
  src: string
  crop: Required<RectLike>
  size: number
}

export type Alignment =
  | 'left'
  | 'center-x'
  | 'right'
  | 'top'
  | 'center-y'
  | 'bottom'

export interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface ObjectCapabilities {
  appearance: boolean
  text: boolean
  line: boolean
  arcAngle: boolean
  donutRadius: boolean
}
