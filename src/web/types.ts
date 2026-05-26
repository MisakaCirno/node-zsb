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

export interface ObjectLayerNode {
  type: 'object'
  id: string
}

export interface GroupLayerNode {
  type: 'group'
  id: string
  name: string
  collapsed?: boolean
  hidden?: boolean
  locked?: boolean
  children: LayerNode[]
}

export type LayerNode = ObjectLayerNode | GroupLayerNode

export type LayerNodeRef = Pick<LayerNode, 'type' | 'id'>

export interface EditorStateSlice {
  board: NormalizedBoard
  layerTree: LayerNode[]
  selectedIndex: number
  selectedIndexes: number[]
}

export interface ProjectBoardMeta {
  name: string
  boardBackground: string
}

export interface ProjectFile {
  format: 'node-zsb-project'
  version: number
  fileName: string
  board: ProjectBoardMeta
  objects: Record<string, BoardObject>
  layers: LayerNode[]
}

export interface CreateProjectOptions {
  fileName?: string
  layerTree?: LayerNode[]
}

export interface ObjectCapabilities {
  appearance: boolean
  text: boolean
  line: boolean
  arcAngle: boolean
  donutRadius: boolean
}
