import { cleanBoard, normalizeBoard } from './board.js'
import {
  decodeBoardCode,
  encodeBoardCode,
  renderPreviewImage,
} from './api.js'
import { replaceBoard } from './editorState.js'

export function createBoardCodeActions({
  state,
  elements,
  recordHistory,
  renderAll,
  renderBackgroundOptions,
}) {
  async function loadFromCode(code, options = {}) {
    const board = await decodeBoardCode(code)
    if (options.record !== false) {
      recordHistory()
    }
    replaceBoard(state, normalizeBoard(board))
    elements.boardName.value = state.board.name ?? ''
    renderBackgroundOptions()
    await renderAll()
  }

  async function exportCode() {
    await exportAndReturnCode()
  }

  async function renderPreview() {
    const code = await exportAndReturnCode()
    const data = await renderPreviewImage(code)
    elements.preview.src = `/preview/${data.hash}.webp?${Date.now()}`
    elements.preview.style.display = 'block'
  }

  async function exportAndReturnCode() {
    const code = await encodeBoardCode(cleanBoard(state.board))
    elements.codeOutput.value = code
    elements.codeInput.value = code
    updateCodeUrl(code)
    return code
  }

  return {
    exportCode,
    loadFromCode,
    renderPreview,
  }
}

function updateCodeUrl(code) {
  const url = new URL(window.location.href)
  url.searchParams.set('code', code)
  window.history.replaceState(null, '', url)
}
