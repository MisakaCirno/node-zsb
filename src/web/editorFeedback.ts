import { getBrowserWindow } from './browser.js'
import type {
  DisabledElement,
  EditorState,
  TextElement,
} from './types.js'

interface EditorFeedbackDeps {
  state: EditorState
  getElements(): FeedbackElements
}

interface FeedbackElements {
  status: TextElement & {
    classList: {
      add(className: string): void
      remove(className: string): void
      toggle(className: string, force?: boolean): void
    }
  }
  loadCode: AsyncButtonElement
  importProjectFile: AsyncButtonElement
  openExportCodeDialog: AsyncButtonElement
  exportProjectFile: AsyncButtonElement
  openExportImageDialog: AsyncButtonElement
  copyExportCode: AsyncButtonElement
  copyExportImage: AsyncButtonElement
  downloadPreviewImage: AsyncButtonElement
  quickSaveLocalBoard: AsyncButtonElement
  quickSaveAsLocalBoard: AsyncButtonElement
  boardName: DisabledElement
  fileName: DisabledElement
  newLocalBoard: DisabledElement
  saveLocalBoard: DisabledElement
  saveAsLocalBoard: DisabledElement
  openLocalBoardDialog: DisabledElement
  manageLocalBoards: DisabledElement
  deleteSelectedLocalBoards: DisabledElement
  background: {
    querySelectorAll<E extends Element = Element>(selector: string): NodeListOf<E>
  }
  fileMenuButton: DisabledElement
  editMenuButton: DisabledElement
}

interface AsyncButtonElement extends DisabledElement {
  setAttribute(name: string, value: string): void
}

interface RunActionOptions {
  busyMessage?: string
}

interface ShowStatusOptions {
  type?: 'error' | string
}

export function createEditorFeedback({ state, getElements }: EditorFeedbackDeps) {
  const browserWindow = getBrowserWindow()

  async function runAction(
    action: () => unknown | Promise<unknown>,
    successMessage = '',
    options: RunActionOptions = {},
  ) {
    if (state.actionRunning) return
    state.actionRunning = true
    setAsyncActionsDisabled(true)
    if (options.busyMessage) {
      showStatus(options.busyMessage)
    }
    try {
      await action()
      showStatus(successMessage)
    } catch (error) {
      handleError(error instanceof Error ? error : {})
    } finally {
      state.actionRunning = false
      setAsyncActionsDisabled(false)
    }
  }

  function showStatus(message: string, options: ShowStatusOptions = {}) {
    const elements = getElements()
    clearTimeout(state.statusTimer)
    elements.status.textContent = message
    elements.status.classList.toggle('error', options.type === 'error')
    elements.status.classList.add('visible')
    state.statusTimer = browserWindow.setTimeout(() => {
      elements.status.classList.remove('visible')
    }, 2200)
  }

  function setAsyncActionsDisabled(disabled: boolean) {
    const elements = getElements()
    for (const button of [
      elements.loadCode,
      elements.importProjectFile,
      elements.openExportCodeDialog,
      elements.exportProjectFile,
      elements.openExportImageDialog,
      elements.copyExportCode,
      elements.copyExportImage,
      elements.downloadPreviewImage,
      elements.quickSaveLocalBoard,
      elements.quickSaveAsLocalBoard,
    ]) {
      button.disabled = disabled
      button.setAttribute('aria-busy', String(disabled))
    }
    for (const control of [
      elements.boardName,
      elements.fileName,
      elements.newLocalBoard,
      elements.saveLocalBoard,
      elements.saveAsLocalBoard,
      elements.openLocalBoardDialog,
      elements.manageLocalBoards,
      elements.deleteSelectedLocalBoards,
      ...elements.background.querySelectorAll<HTMLButtonElement>('button'),
    ].filter(Boolean)) {
      control.disabled = disabled
    }
    elements.fileMenuButton.disabled = disabled
    elements.editMenuButton.disabled = disabled
  }

  function handleError(error: Error | { message?: string }) {
    console.error(error)
    showStatus(error.message ?? '操作失败', { type: 'error' })
  }

  return {
    runAction,
    showStatus,
  }
}
