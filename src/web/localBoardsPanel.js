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
  let pendingNameRequest = null

  function renderLocalBoards() {
    const boards = loadLocalBoards()
    elements.localBoardList.innerHTML = ''
    if (boards.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'empty-state local-board-empty'
      empty.textContent = '暂无本地存档'
      elements.localBoardList.append(empty)
      updateLocalBoardButtons()
      return
    }

    for (const board of boards) {
      elements.localBoardList.append(createLocalBoardRow(board))
    }
    updateLocalBoardButtons()
  }

  function updateLocalBoardButtons() {
    elements.saveLocalBoard.disabled = false
  }

  async function saveLocalBoard(options = {}) {
    const boards = loadLocalBoards()
    const baseName = options.name ?? state.board.name ?? '未命名'
    const name = await resolveAvailableBoardName(baseName, boards)
    if (!name) return false
    const entry = {
      id: createLocalBoardId(),
      name,
      updatedAt: new Date().toISOString(),
      board: cleanBoard({ ...state.board, name }),
    }
    const nextBoards = [entry, ...boards].slice(0, MAX_LOCAL_BOARDS)
    if (!saveLocalBoards(nextBoards)) return false
    state.board.name = name
    elements.boardName.value = name
    state.localBoardSnapshot = boardSnapshot(entry.board)
    renderLocalBoards()
    showStatus('已保存到浏览器本地存储')
    return true
  }

  async function loadLocalBoard(id) {
    const boards = loadLocalBoards()
    const entry = boards.find((board) => board.id === id)
    if (!entry) return false
    if (isCurrentBoardDirty()) {
      const shouldSave = confirmAction('当前画板有未保存修改，打开其他存档前是否先保存当前画板？')
      if (shouldSave && !await saveLocalBoard()) return false
    }
    recordHistory()
    state.board = normalizeBoard(entry.board)
    state.selectedIndex = -1
    state.selectedIndexes = []
    state.localBoardSnapshot = boardSnapshot(cleanBoard(state.board))
    elements.boardName.value = state.board.name ?? ''
    renderBackgroundOptions()
    renderLocalBoards()
    await renderAll()
    showStatus(`已读取本地存档 ${entry.name || '未命名'}`)
    return true
  }

  async function renameLocalBoard(id) {
    const boards = loadLocalBoards()
    const entry = boards.find((board) => board.id === id)
    if (!entry) return false
    const name = await requestBoardName({
      currentName: entry.name || '未命名',
      title: '重命名存档',
    })
    if (!name) return false
    if (boards.some((board) => board.id !== id && board.name === name)) {
      showStatus('已有同名存档，请换一个名称', { type: 'error' })
      return false
    }
    const previousSnapshot = boardSnapshot(entry.board)
    entry.name = name
    entry.updatedAt = new Date().toISOString()
    entry.board = cleanBoard({ ...entry.board, name })
    if (!saveLocalBoards(boards)) return false
    if (state.localBoardSnapshot === previousSnapshot) {
      state.board.name = name
      elements.boardName.value = name
      state.localBoardSnapshot = boardSnapshot(entry.board)
    }
    renderLocalBoards()
    showStatus('已重命名本地存档')
    return true
  }

  function deleteLocalBoard(id) {
    const boards = loadLocalBoards()
    const entry = boards.find((board) => board.id === id)
    if (!entry) return false
    if (!confirmAction(`删除本地存档“${entry.name || '未命名'}”？`)) return false
    if (!saveLocalBoards(boards.filter((board) => board.id !== entry.id))) return false
    renderLocalBoards()
    showStatus('已删除本地存档')
    return true
  }

  elements.localBoardNameDialog.addEventListener('close', () => {
    if (!pendingNameRequest) return
    const name = elements.localBoardNameDialog.returnValue === 'confirm'
      ? elements.localBoardNameInput.value.trim()
      : ''
    pendingNameRequest.resolve(name)
    pendingNameRequest = null
  })

  elements.useRecommendedBoardName.addEventListener('click', () => {
    if (!pendingNameRequest) return
    elements.localBoardNameInput.value = pendingNameRequest.recommendedName
    elements.localBoardNameInput.focus()
    elements.localBoardNameInput.select()
  })

  return {
    deleteLocalBoard,
    loadLocalBoard,
    renderLocalBoards,
    renameLocalBoard,
    saveLocalBoard,
    updateLocalBoardButtons,
  }

  function createLocalBoardRow(entry) {
    const row = document.createElement('article')
    row.className = 'local-board-row'
    const meta = document.createElement('div')
    meta.className = 'local-board-meta'
    const name = document.createElement('strong')
    name.textContent = entry.name || '未命名'
    const time = document.createElement('span')
    time.textContent = formatLocalBoardTime(entry)
    meta.append(name, time)

    const actions = document.createElement('div')
    actions.className = 'local-board-actions'
    actions.append(
      createRowButton('打开', () => loadLocalBoard(entry.id)),
      createRowButton('重命名', () => renameLocalBoard(entry.id)),
      createRowButton('删除', () => deleteLocalBoard(entry.id)),
    )
    row.append(meta, actions)
    return row
  }

  function createRowButton(label, onClick) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', onClick)
    return button
  }

  async function resolveAvailableBoardName(baseName, boards) {
    const fallbackName = (baseName || '未命名').trim() || '未命名'
    if (!boards.some((board) => board.name === fallbackName)) {
      return fallbackName
    }
    return requestBoardName({
      currentName: fallbackName,
      title: '存档名称已存在',
    })
  }

  function requestBoardName({ currentName, title }) {
    return new Promise((resolve) => {
      pendingNameRequest = {
        recommendedName: createRecommendedName(currentName),
        resolve,
      }
      elements.localBoardNameDialog.querySelector('h2').textContent = title
      elements.localBoardNameInput.value = currentName
      elements.localBoardNameDialog.showModal()
      elements.localBoardNameInput.focus()
      elements.localBoardNameInput.select()
    })
  }

  function isCurrentBoardDirty() {
    return boardSnapshot(cleanBoard(state.board)) !== state.localBoardSnapshot
  }

  function saveLocalBoards(boards) {
    if (persistLocalBoards(boards)) {
      return true
    }
    showStatus('保存本地存档失败', { type: 'error' })
    return false
  }

}

function boardSnapshot(board) {
  return JSON.stringify(cleanBoard(board))
}

function formatLocalBoardTime(entry) {
  const date = new Date(entry.updatedAt)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('zh-CN', { hour12: false })
}

function createRecommendedName(name) {
  const date = new Date()
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('')
  return `${name || '未命名'}-${stamp}`
}

function createLocalBoardId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
