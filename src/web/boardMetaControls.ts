import type {
  EditorState,
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
  boardName: ValueElement
}

interface BackgroundListElement {
  innerHTML: string
  append(...nodes: unknown[]): void
}

interface CreatedElement {
  className: string
  dataset: Record<string, string>
  innerHTML: string
  title: string
  type: string
  classList: {
    toggle(className: string, force?: boolean): void
  }
  addEventListener(type: string, listener: () => void): void
  setAttribute(name: string, value: string): void
}

interface DocumentLike {
  createElement(tagName: string): CreatedElement
}

export function createBoardMetaControls({
  state,
  elements,
  recordHistory,
  renderAll,
}: BoardMetaControlsDeps) {
  const browserDocument = getDocument()

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
    renderAll()
  }

  return {
    onBackgroundChange,
    onBoardNameChange,
    renderBackgroundOptions,
    syncBoardNameInput,
  }
}

function getDocument(): DocumentLike {
  const globals = globalThis as unknown as {
    document?: DocumentLike
    window?: { document?: DocumentLike }
  }
  const documentLike = globals.document ?? globals.window?.document
  if (!documentLike) {
    throw new Error('Document is not available')
  }
  return documentLike
}
