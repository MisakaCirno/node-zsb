export function createBoardMetaControls({
  state,
  elements,
  recordHistory,
  renderAll,
}) {
  function renderBackgroundOptions() {
    elements.background.innerHTML = ''
    for (const [key, imageId] of Object.entries(state.backgrounds)) {
      const button = document.createElement('button')
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

  function onBackgroundChange(background = state.board.boardBackground) {
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
