import type {
  Board,
  BoardObject,
} from './board.js'
import type {
  LayerNode,
} from './layers.js'

export interface FileLike {
  name?: string
  text(): Promise<string>
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

export interface LocalBoardSlot {
  id?: string
  name?: string
  board?: Board
  updatedAt?: string
  preview?: string
}

export interface LocalFile {
  name: string
  project: ProjectFile
  board: Board
  createdAt: string
  updatedAt: string
  preview: string
}

export interface CreateProjectOptions {
  fileName?: string
  layerTree?: LayerNode[]
}
