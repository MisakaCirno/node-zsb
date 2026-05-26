export function createEditorFeedback({ state, getElements }) {
  async function runAction(action, successMessage, options = {}) {
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
      handleError(error)
    } finally {
      state.actionRunning = false
      setAsyncActionsDisabled(false)
    }
  }

  function showStatus(message, options = {}) {
    const elements = getElements()
    clearTimeout(state.statusTimer)
    elements.status.textContent = message
    elements.status.classList.toggle('error', options.type === 'error')
    elements.status.classList.add('visible')
    state.statusTimer = window.setTimeout(() => {
      elements.status.classList.remove('visible')
    }, 2200)
  }

  function setAsyncActionsDisabled(disabled) {
    const elements = getElements()
    for (const button of [
      elements.loadCode,
      elements.openExportCodeDialog,
      elements.openExportImageDialog,
      elements.copyExportCode,
      elements.copyExportImage,
      elements.downloadPreviewImage,
    ]) {
      button.disabled = disabled
      button.setAttribute('aria-busy', String(disabled))
    }
    for (const control of [
      elements.boardName,
      elements.saveLocalBoard,
      elements.openLocalBoardDialog,
      elements.manageLocalBoards,
      ...elements.background.querySelectorAll('button'),
    ].filter(Boolean)) {
      control.disabled = disabled
    }
  }

  function handleError(error) {
    console.error(error)
    showStatus(error.message ?? '操作失败', { type: 'error' })
  }

  return {
    runAction,
    showStatus,
  }
}
