import { normalizeBoard } from './board.js'
import { getOptionalBrowserWindow } from './browser.js'
import {
  createCurrentProjectSnapshot,
  createLocalFileSnapshot,
  readEditorDraft,
  type RestoredEditorDraft,
} from './documentState.js'
import { loadEditorDraft, loadLocalFiles } from './storage.js'
import { syncFlatLayerTree } from './layerTree.js'
import {
  flattenProjectToBoard,
} from './project.js'
import type {
  Board,
  EditorState,
  TextElement,
  ValueElement,
} from './types.js'

const READY_STATUS = '编辑器已就绪'

type InitialBoardSource =
  | { code: string, statusText: string, type: 'url-code' | 'default-code' }
  | { board: unknown, statusText: string, type: 'editor-draft' }

interface InitialBoardSourceOptions {
  defaultCode?: string
  editorDraft?: unknown | null
  search?: string
}

interface StartupElements {
  codeInput: ValueElement
  fileName: ValueElement & { maxLength: number }
  fileNameCount: TextElement
}

interface ApplyInitialBoardSourceDeps {
  elements: Pick<StartupElements, 'codeInput'>
  loadFromCode(code: string, options?: { record?: boolean }): Promise<void>
  renderBackgroundOptions(): void
  source: InitialBoardSource
  state: Pick<EditorState, 'board' | 'layerTree' | 'selectedIndex' | 'selectedIndexes'>
  syncBoardNameInput(): void
}

interface InitializeEditorBoardDeps extends Omit<ApplyInitialBoardSourceDeps, 'elements' | 'source'> {
  elements: StartupElements
  meta: { defaultCode: string }
  state: EditorState
}

export function getInitialBoardSource({
  defaultCode = '',
  editorDraft = loadEditorDraft(),
  search = getLocationSearch(),
}: InitialBoardSourceOptions = {}): InitialBoardSource {
  const codeFromUrl = new URLSearchParams(search).get('code')
  if (codeFromUrl) {
    return {
      code: codeFromUrl,
      statusText: '已从链接导入战术板',
      type: 'url-code',
    }
  }
  if (editorDraft) {
    return {
      board: editorDraft,
      statusText: READY_STATUS,
      type: 'editor-draft',
    }
  }
  return {
    code: defaultCode,
    statusText: READY_STATUS,
    type: 'default-code',
  }
}

export async function applyInitialBoardSource({
  elements,
  loadFromCode,
  renderBackgroundOptions,
  source,
  state,
  syncBoardNameInput,
}: ApplyInitialBoardSourceDeps) {
  if (source.type === 'editor-draft') {
    const draft = readEditorDraft(source.board)
    if (draft) {
      state.board = flattenProjectToBoard(draft.project)
      state.layerTree = draft.project.layers
    } else {
      state.board = normalizeBoard(source.board as Partial<Board>)
      syncFlatLayerTree(state)
    }
    syncBoardNameInput()
    renderBackgroundOptions()
    return
  }

  elements.codeInput.value = source.code
  await loadFromCode(source.code, { record: false })
}

export async function initializeEditorBoard({
  elements,
  loadFromCode,
  meta,
  renderBackgroundOptions,
  state,
  syncBoardNameInput,
}: InitializeEditorBoardDeps) {
  const source = getInitialBoardSource({
    defaultCode: meta.defaultCode,
  })
  await applyInitialBoardSource({
    elements,
    loadFromCode,
    renderBackgroundOptions,
    source,
    state,
    syncBoardNameInput,
  })
  if (source.type === 'url-code') {
    clearUrlCodeParameter()
  }
  const draft = source.type === 'editor-draft' ? readEditorDraft(source.board) : null
  restoreDocumentIdentity(state, draft)
  elements.fileName.value = state.currentFileName
  syncNameCounter(elements.fileName, elements.fileNameCount)
  return source
}

function syncNameCounter(input: ValueElement & { maxLength: number }, output: TextElement) {
  const maxLength = input.maxLength > 0 ? input.maxLength : input.value.length
  output.textContent = `${input.value.length}/${maxLength}`
}

export function clearUrlCodeParameter() {
  const browserWindow = getOptionalBrowserWindow()
  if (!browserWindow?.history?.replaceState) return
  const url = new URL(browserWindow.location.href)
  if (!url.searchParams.has('code')) return
  url.searchParams.delete('code')
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  browserWindow.history.replaceState(browserWindow.history.state, '', nextUrl)
}

function getLocationSearch(): string {
  return getOptionalBrowserWindow()?.location.search ?? ''
}

function restoreDocumentIdentity(
  state: EditorState,
  draft: RestoredEditorDraft | null,
): void {
  state.currentFileName = draft?.project.fileName ?? ''
  state.associatedLocalFileName = ''
  const currentSnapshot = createCurrentProjectSnapshot(state)
  if (!draft) {
    state.documentBaselineSnapshot = currentSnapshot
    return
  }

  const associatedName = draft.associatedLocalFileName.trim()
  const localFile = associatedName
    ? loadLocalFiles().find((file) => file.name === associatedName)
    : null
  if (localFile) {
    state.associatedLocalFileName = localFile.name
    state.documentBaselineSnapshot = createLocalFileSnapshot(localFile)
    return
  }

  if (associatedName) {
    state.documentBaselineSnapshot = ''
    return
  }
  state.documentBaselineSnapshot = draft.legacy
    ? currentSnapshot
    : draft.documentBaselineSnapshot
}
