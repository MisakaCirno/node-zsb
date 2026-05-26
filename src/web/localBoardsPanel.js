import { MAX_LOCAL_BOARDS } from './constants.js'
import { cleanBoard, normalizeBoard } from './board.js'
import { loadLocalBoards, persistLocalBoards } from './storage.js'

export function createLocalBoardsPanel({
  state,
  elements,
  recordHistory,
  renderAll,
  renderBackgroundOptions,
  showStatus,
  confirmAction,
}) {
  function renderLocalBoards(selectedId = elements.localBoardSelect.value) {
    const boards = loadLocalBoards()
    elements.localBoardSelect.innerHTML = ''
    if (boards.length === 0) {
      const option = document.createElement('option')
      option.value = ''
      option.textContent = '暂无本地存档'
      elements.localBoardSelect.append(option)
      updateLocalBoardButtons()
      return
    }

    for (const board of boards) {
      const option = document.createElement('option')
      option.value = board.id
      option.textContent = formatLocalBoardLabel(board)
      option.selected = board.id === selectedId
      elements.localBoardSelect.append(option)
    }
    if (!boards.some((board) => board.id === selectedId)) {
      elements.localBoardSelect.value = boards[0].id
    }
    updateLocalBoardButtons()
  }

  function updateLocalBoardButtons() {
    const hasSelection = Boolean(elements.localBoardSelect.value)
    elements.loadLocalBoard.disabled = !hasSelection
    elements.deleteLocalBoard.disabled = !hasSelection
  }

  function saveLocalBoard() {
    const boards = loadLocalBoards()
    const entry = {
      id: createLocalBoardId(),
      name: state.board.name || '未命名',
      updatedAt: new Date().toISOString(),
      board: cleanBoard(state.board),
    }
    boards.unshift(entry)
    if (!saveLocalBoards(boards.slice(0, MAX_LOCAL_BOARDS))) return
    renderLocalBoards(entry.id)
    showStatus('已保存到浏览器本地存储')
  }

  function loadLocalBoard() {
    const boards = loadLocalBoards()
    const entry = boards.find((board) => board.id === elements.localBoardSelect.value)
    if (!entry) return
    recordHistory()
    state.board = normalizeBoard(entry.board)
    state.selectedIndex = -1
    state.selectedIndexes = []
    elements.boardName.value = state.board.name ?? ''
    renderBackgroundOptions()
    renderAll()
    showStatus(`已读取本地存档 ${entry.name || '未命名'}`)
  }

  function deleteLocalBoard() {
    const boards = loadLocalBoards()
    const entry = boards.find((board) => board.id === elements.localBoardSelect.value)
    if (!entry) return
    if (!confirmAction(`删除本地存档“${entry.name || '未命名'}”？`)) return
    if (!saveLocalBoards(boards.filter((board) => board.id !== entry.id))) return
    renderLocalBoards()
    showStatus('已删除本地存档')
  }

  return {
    deleteLocalBoard,
    loadLocalBoard,
    renderLocalBoards,
    saveLocalBoard,
    updateLocalBoardButtons,
  }

  function saveLocalBoards(boards) {
    if (persistLocalBoards(boards)) {
      return true
    }
    showStatus('保存本地存档失败', { type: 'error' })
    return false
  }
}

function formatLocalBoardLabel(entry) {
  const date = new Date(entry.updatedAt)
  const time = Number.isNaN(date.getTime())
    ? ''
    : ` ${date.toLocaleString('zh-CN', { hour12: false })}`
  return `${entry.name || '未命名'}${time}`
}

function createLocalBoardId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
