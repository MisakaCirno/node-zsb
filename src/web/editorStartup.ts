import { cleanBoard, normalizeBoard } from './board.js'
import { loadSavedBoard } from './storage.js'
import { syncFlatLayerTree } from './layerTree.js'
import type {
  Board,
  EditorState,
  ValueElement,
} from './types.js'

const READY_STATUS = '编辑器已就绪'

type InitialBoardSource =
  | { code: string, statusText: string, type: 'url-code' | 'default-code' }
  | { board: unknown, statusText: string, type: 'saved-board' }

interface InitialBoardSourceOptions {
  defaultCode?: string
  savedBoard?: unknown | null
  search?: string
}

interface StartupElements {
  codeInput: ValueElement
  fileName: ValueElement
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
  savedBoard = loadSavedBoard(),
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
  if (savedBoard) {
    return {
      board: savedBoard,
      statusText: READY_STATUS,
      type: 'saved-board',
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
  if (source.type === 'saved-board') {
    state.board = normalizeBoard(source.board as Partial<Board>)
    syncFlatLayerTree(state)
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
  state.currentFileName = ''
  state.localFileSnapshot = JSON.stringify(cleanBoard(state.board))
  elements.fileName.value = ''
  return source
}

function getLocationSearch(): string {
  const globals = globalThis as unknown as { window?: { location?: { search?: string } } }
  return globals.window?.location?.search ?? ''
}
