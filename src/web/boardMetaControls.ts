import { getBrowserDocument } from './browser.js'
import type {
  EditorState,
  TextElement,
  ValueElement,
} from './types.js'

interface BoardMetaControlsDeps {
  state: EditorState
  elements: BoardMetaElements
  recordHistory(): void
  renderAll(): Promise<void>
}

interface BoardMetaElements {
  background: BackgroundListElement
  boardName: ValueElement & { maxLength: number }
  shareNameCount: TextElement
}

interface BackgroundListElement {
  innerHTML: string
  append(...nodes: unknown[]): void
}

export function createBoardMetaControls({
  state,
  elements,
  recordHistory,
  renderAll,
}: BoardMetaControlsDeps) {
  const browserDocument = getBrowserDocument()

  function renderBackgroundOptions() {
    elements.background.innerHTML = ''
    for (const [key, imageId] of Object.entries(state.backgrounds)) {
      const button = browserDocument.createElement('button')
      button.type = 'button'
      button.className = 'background-option'
      button.dataset.background = key
      button.setAttribute('role', 'radio')
      button.setAttribute('aria-checked', String(key === state.board.boardBackground))
      button.classList.toggle('active', key === state.board.boardBackground)
      button.title = key
      button.innerHTML = `
        <img src="/assets/background/${imageId}.webp" alt="" />
        <span>${key}</span>
      `
      button.addEventListener('click', () => onBackgroundChange(key))
      elements.background.append(button)
    }
  }

  function syncBoardNameInput() {
    elements.boardName.value = state.board.name ?? ''
    syncBoardNameCount()
  }

  function onBackgroundChange(background: string = state.board.boardBackground) {
    if (background === state.board.boardBackground) return
    recordHistory()
    state.board.boardBackground = background
    renderBackgroundOptions()
    renderAll()
  }

  function onBoardNameChange() {
    recordHistory()
    state.board.name = elements.boardName.value
    syncBoardNameCount()
    renderAll()
  }

  function syncBoardNameCount() {
    const maxLength = Number(elements.boardName.maxLength) > 0
      ? elements.boardName.maxLength
      : 7
    elements.shareNameCount.textContent = `${elements.boardName.value.length}/${maxLength}`
  }

  return {
    onBackgroundChange,
    onBoardNameChange,
    renderBackgroundOptions,
    syncBoardNameCount,
    syncBoardNameInput,
  }
}
