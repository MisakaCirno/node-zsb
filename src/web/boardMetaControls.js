export function createBoardMetaControls({
  state,
  elements,
  recordHistory,
  renderAll,
}) {
  function renderBackgroundOptions() {
    elements.background.innerHTML = ''
    for (const key of Object.keys(state.backgrounds)) {
      const option = document.createElement('option')
      option.value = key
      option.textContent = key
      option.selected = key === state.board.boardBackground
      elements.background.append(option)
    }
  }

  function syncBoardNameInput() {
    elements.boardName.value = state.board.name ?? ''
  }

  function onBackgroundChange() {
    recordHistory()
    state.board.boardBackground = elements.background.value
    renderAll()
  }

  function onBoardNameChange() {
    recordHistory()
    state.board.name = elements.boardName.value
  }

  return {
    onBackgroundChange,
    onBoardNameChange,
    renderBackgroundOptions,
    syncBoardNameInput,
  }
}
