import { cleanBoard, normalizeBoard } from './board.js'
import { toAppUrl } from './appUrl.js'
import {
  decodeBoardCode,
  encodeBoardCode,
  renderPreviewImage,
} from './api.js'
import {
  getBrowserNavigator,
  getBrowserWindow,
} from './browser.js'
import { replaceBoard } from './editorState.js'
import type {
  BoardCodeActions,
  EditorState,
  ValueElement,
} from './types.js'

interface BoardCodeElements {
  boardName: ValueElement
  codeOutput: ValueElement
  codeInput: ValueElement
  preview: {
    src: string
    style: { display: string }
    dataset: { downloadUrl?: string }
  }
}

interface BoardCodeActionsDeps {
  state: EditorState
  elements: BoardCodeElements
  recordHistory: () => void
  renderAll: () => Promise<void>
  renderBackgroundOptions: () => void
}

interface ClipboardWindow extends Window {
  ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem
}

const browserWindow = getBrowserWindow() as ClipboardWindow
const browserNavigator = getBrowserNavigator()

export function createBoardCodeActions({
  state,
  elements,
  recordHistory,
  renderAll,
  renderBackgroundOptions,
}: BoardCodeActionsDeps): BoardCodeActions {
  async function loadFromCode(code: string, options: { record?: boolean } = {}) {
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
    const src = toAppUrl(`/preview/${data.hash}.webp`)
    elements.preview.src = src
    elements.preview.style.display = 'block'
    elements.preview.dataset.downloadUrl = toAppUrl(`/preview/${data.hash}.webp`)
    return src
  }

  async function copyExportCode() {
    const code = elements.codeOutput.value || await exportAndReturnCode()
    if (!browserNavigator.clipboard?.writeText) {
      throw new Error('当前浏览器不支持复制文本')
    }
    await browserNavigator.clipboard.writeText(code)
  }

  async function copyExportImage() {
    const url = elements.preview.dataset.downloadUrl || await renderPreview()
    const response = await fetch(url)
    const blob = await response.blob()
    if (!browserNavigator.clipboard?.write || !browserWindow.ClipboardItem) {
      throw new Error('当前浏览器不支持复制图片')
    }
    await browserNavigator.clipboard.write([
      new browserWindow.ClipboardItem({ [blob.type || 'image/webp']: blob }),
    ])
  }

  function downloadPreviewImage() {
    const url = elements.preview.dataset.downloadUrl
    if (!url) return
    const link = browserWindow.document.createElement('a')
    link.href = url
    link.download = `${state.board.name || '战术板'}.webp`
    browserWindow.document.body.append(link)
    link.click()
    link.remove()
  }

  async function exportAndReturnCode(): Promise<string> {
    const code = await encodeBoardCode(cleanBoard(state.board))
    elements.codeOutput.value = code
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
