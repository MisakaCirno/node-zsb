import {
  createProjectFromBoard,
  isProject,
  normalizeProject,
} from './project.js'
import type {
  EditorDraft,
  EditorState,
  LocalFile,
  ProjectFile,
} from './types.js'

export const EDITOR_DRAFT_FORMAT = 'node-zsb-editor-draft'
export const EDITOR_DRAFT_VERSION = 1

export interface RestoredEditorDraft {
  project: ProjectFile
  associatedLocalFileName: string
  documentBaselineSnapshot: string
  legacy: boolean
}

export function createCurrentProjectSnapshot(state: EditorState): string {
  return createDocumentComparisonSnapshot(createProjectFromBoard(state.board, {
    fileName: state.currentFileName,
    layerTree: state.layerTree,
  }))
}

export function createEditorDraft(state: EditorState): EditorDraft {
  return {
    format: EDITOR_DRAFT_FORMAT,
    version: EDITOR_DRAFT_VERSION,
    project: createProjectFromBoard(state.board, {
      fileName: state.currentFileName,
      layerTree: state.layerTree,
    }),
    associatedLocalFileName: state.associatedLocalFileName,
    documentBaselineSnapshot: state.documentBaselineSnapshot,
  }
}

export function isDocumentDirty(state: EditorState): boolean {
  return createCurrentProjectSnapshot(state) !== state.documentBaselineSnapshot
}

export function markDocumentClean(
  state: EditorState,
  {
    associatedLocalFileName = '',
    fileName = state.currentFileName,
  }: {
    associatedLocalFileName?: string
    fileName?: string
  } = {},
): void {
  state.currentFileName = fileName
  state.associatedLocalFileName = associatedLocalFileName
  state.documentBaselineSnapshot = createCurrentProjectSnapshot(state)
}

export function detachDocumentAndMarkDirty(state: EditorState): void {
  state.associatedLocalFileName = ''
  state.documentBaselineSnapshot = ''
}

export function readEditorDraft(value: unknown): RestoredEditorDraft | null {
  if (isEditorDraft(value)) {
    return {
      project: normalizeProject(value.project),
      associatedLocalFileName: String(value.associatedLocalFileName ?? ''),
      documentBaselineSnapshot: normalizeDocumentBaselineSnapshot(
        value.documentBaselineSnapshot,
      ),
      legacy: false,
    }
  }
  if (!isProject(value)) return null
  const project = normalizeProject(value)
  return {
    project,
    associatedLocalFileName: project.fileName,
    documentBaselineSnapshot: '',
    legacy: true,
  }
}

export function createLocalFileSnapshot(file: LocalFile): string {
  return createDocumentComparisonSnapshot({
    ...normalizeProject(file.project),
    fileName: file.name,
  })
}

function normalizeDocumentBaselineSnapshot(value: unknown): string {
  const snapshot = String(value ?? '')
  if (!snapshot) return ''
  try {
    const project = JSON.parse(snapshot)
    return isProject(project) ? createDocumentComparisonSnapshot(project) : snapshot
  } catch {
    return snapshot
  }
}

function createDocumentComparisonSnapshot(project: unknown): string {
  return JSON.stringify(sortSnapshotValue(normalizeProject(project)))
}

function sortSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortSnapshotValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortSnapshotValue(entry)]),
  )
}

function isEditorDraft(value: unknown): value is Partial<EditorDraft> & { project: unknown } {
  return Boolean(
    value
      && typeof value === 'object'
      && !Array.isArray(value)
      && (value as Partial<EditorDraft>).format === EDITOR_DRAFT_FORMAT
      && Number((value as Partial<EditorDraft>).version) === EDITOR_DRAFT_VERSION
      && 'project' in value,
  )
}
