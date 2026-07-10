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

export interface EditorDraft {
  format: 'node-zsb-editor-draft'
  version: 1
  project: ProjectFile
  associatedLocalFileName: string
  documentBaselineSnapshot: string
}

export type DocumentReplaceDecision = 'save' | 'discard' | 'cancel'

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

export interface LocalLayerPreset {
  id: string
  name: string
  objects: Record<string, BoardObject>
  layers: LayerNode[]
  objectCount: number
  contentHash: string
  createdAt: string
  updatedAt: string
}

export interface LocalAssetsBackupFile {
  name: string
  project: ProjectFile
  createdAt: string
  updatedAt: string
  preview: string
}

export interface LocalAssetsBackup {
  format: 'node-zsb-local-assets'
  version: 1
  exportedAt: string
  files: LocalAssetsBackupFile[]
  presets: LocalLayerPreset[]
}

export type LocalAssetsImportDecision = 'merge' | 'replace' | 'cancel'

export interface CreateProjectOptions {
  fileName?: string
  layerTree?: LayerNode[]
}
