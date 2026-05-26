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
    return exportAndReturnCode()
  }

  async function renderPreview() {
    const code = await exportAndReturnCode()
    const data = await renderPreviewImage(code)
    const src = `/preview/${data.hash}.webp?${Date.now()}`
    elements.preview.src = src
    elements.preview.style.display = 'block'
    elements.preview.dataset.downloadUrl = `/preview/${data.hash}.webp`
    return src
  }

  async function copyExportCode() {
    const code = elements.codeOutput.value || await exportAndReturnCode()
    await navigator.clipboard.writeText(code)
  }

  async function copyExportImage() {
    const url = elements.preview.dataset.downloadUrl || await renderPreview()
    const response = await fetch(url)
    const blob = await response.blob()
    if (!navigator.clipboard?.write || !window.ClipboardItem) {
      throw new Error('当前浏览器不支持复制图片')
    }
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || 'image/webp']: blob }),
    ])
  }

  function downloadPreviewImage() {
    const url = elements.preview.dataset.downloadUrl
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `${state.board.name || '战术板'}.webp`
    document.body.append(link)
    link.click()
    link.remove()
  }

  async function exportAndReturnCode() {
    const code = await encodeBoardCode(cleanBoard(state.board))
    elements.codeOutput.value = code
    elements.codeInput.value = code
    updateCodeUrl(code)
    return code
  }

  return {
    copyExportCode,
    copyExportImage,
    downloadPreviewImage,
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
