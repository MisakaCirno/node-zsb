import { normalizeBoard } from './board.js'
import { loadSavedBoard } from './storage.js'

const READY_STATUS = '编辑器已就绪'

export function getInitialBoardSource({
  defaultCode = '',
  savedBoard = loadSavedBoard(),
  search = window.location.search,
} = {}) {
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
}) {
  if (source.type === 'saved-board') {
    state.board = normalizeBoard(source.board)
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
}) {
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
  return source
}
