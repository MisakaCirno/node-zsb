import { MAX_LOCAL_BOARDS } from './constants.js'
import { cleanBoard, normalizeBoard } from './board.js'
import { encodeBoardCode, renderPreviewImage } from './api.js'
import {
  createProjectFromBoard,
  createPureBoardFromProject,
  flattenProjectToBoard,
} from './project.js'
import { loadLocalFiles, persistLocalFiles } from './storage.js'

export function createLocalBoardsPanel({
  state,
  elements,
  recordHistory,
  renderAll,
  renderBackgroundOptions,
  showStatus,
  confirmAction,
  stage,
}) {
  let pendingNameRequest = null

  function renderLocalBoards() {
    const files = loadLocalFiles()
    elements.localBoardList.innerHTML = ''
    if (files.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'empty-state local-board-empty'
      empty.textContent = '暂无本地文件'
      elements.localBoardList.append(empty)
      updateLocalBoardButtons()
      return
    }

    for (const file of files) {
      elements.localBoardList.append(createLocalFileRow(file))
    }
    updateLocalBoardButtons()
  }

  function updateLocalBoardButtons() {
    elements.newLocalBoard.disabled = false
    elements.saveLocalBoard.disabled = false
    elements.saveAsLocalBoard.disabled = false
    const selectableCount = getSelectableFilesCount()
    const selectedCount = getSelectedFileNames().length
    elements.selectAllLocalBoards.disabled = selectableCount === 0 || selectedCount === selectableCount
    elements.clearSelectedLocalBoards.disabled = selectedCount === 0
    elements.deleteSelectedLocalBoards.disabled = selectedCount === 0
  }

  async function saveLocalBoard() {
    const rawName = getCurrentFileName()
    const fileName = rawName || await requestFileName({
      currentName: state.currentFileName || state.board.name || '未命名文件',
      title: '保存文件',
      validate: uniqueFileNameValidator(state.currentFileName),
    })
    if (!fileName) return false
    if (fileExists(fileName) && fileName !== state.currentFileName) {
      const nextName = await requestFileName({
        currentName: fileName,
        title: '保存文件',
        initialError: '已有同名文件，请换一个名称',
        validate: uniqueFileNameValidator(state.currentFileName),
      })
      if (!nextName) return false
      return saveFile(nextName, { allowOverwrite: false })
    }
    return saveFile(fileName, { allowOverwrite: true })
  }

  async function saveLocalBoardAs() {
    const fileName = await requestFileName({
      currentName: getCurrentFileName() || state.board.name || '未命名文件',
      title: '另存为',
      validate: uniqueFileNameValidator(''),
    })
    if (!fileName) return false
    return saveFile(fileName, { allowOverwrite: false })
  }

  async function newLocalBoard() {
    if (isCurrentFileDirty()) {
      const shouldSave = confirmAction('当前文件有未保存修改，新建文件前是否先保存当前文件？')
      if (shouldSave && !await saveLocalBoard()) return false
    }
    state.board = normalizeBoard({
      name: '',
      boardBackground: 'checkered',
      objects: [],
    })
    state.selectedIndex = -1
    state.selectedIndexes = []
    state.history = []
    state.future = []
    setCurrentFile('', cleanBoard(state.board))
    elements.boardName.value = ''
    renderBackgroundOptions()
    renderLocalBoards()
    await renderAll()
    showStatus('已新建文件')
    return true
  }

  async function loadLocalBoard(fileName) {
    const files = loadLocalFiles()
    const file = files.find((entry) => entry.name === fileName)
    if (!file) return false
    if (isCurrentFileDirty()) {
      const shouldSave = confirmAction('当前文件有未保存修改，打开其他文件前是否先保存当前文件？')
      if (shouldSave && !await saveLocalBoard()) return false
    }
    recordHistory()
    state.board = normalizeBoard(file.project ? flattenProjectToBoard(file.project) : file.board)
    state.selectedIndex = -1
    state.selectedIndexes = []
    setCurrentFile(file.name, cleanBoard(state.board))
    elements.boardName.value = state.board.name ?? ''
    renderBackgroundOptions()
    renderLocalBoards()
    await renderAll()
    closeLocalBoardDialog()
    showStatus(`已打开文件 ${file.name}`)
    return true
  }

  async function renameLocalBoard(fileName) {
    const files = loadLocalFiles()
    const file = files.find((entry) => entry.name === fileName)
    if (!file) return false
    const name = await requestFileName({
      currentName: file.name,
      title: '重命名文件',
      validate: uniqueFileNameValidator(file.name),
    })
    if (!name || name === file.name) return false
    if (files.some((entry) => entry.name === name)) {
      showStatus('已有同名文件，请换一个名称', { type: 'error' })
      return false
    }
    file.name = name
    file.updatedAt = new Date().toISOString()
    if (!saveLocalFiles(files)) return false
    if (state.currentFileName === fileName) {
      state.currentFileName = name
      elements.fileName.value = name
    }
    renderLocalBoards()
    showStatus('已重命名本地文件')
    return true
  }

  function deleteLocalBoard(fileName) {
    const files = loadLocalFiles()
    const file = files.find((entry) => entry.name === fileName)
    if (!file) return false
    if (!confirmAction(`删除本地文件“${file.name}”？`)) return false
    const nextFiles = files.filter((entry) => entry.name !== file.name)
    if (!saveLocalFiles(nextFiles)) return false
    if (state.currentFileName === file.name) {
      setCurrentFile('', cleanBoard(state.board))
    }
    renderLocalBoards()
    showStatus('已删除本地文件')
    return true
  }

  function deleteSelectedLocalBoards() {
    const names = getSelectedFileNames()
    if (names.length === 0) return false
    if (!confirmAction(`删除选中的 ${names.length} 个本地文件？`)) return false
    const nextFiles = loadLocalFiles().filter((file) => !names.includes(file.name))
    if (!saveLocalFiles(nextFiles)) return false
    if (names.includes(state.currentFileName)) {
      setCurrentFile('', cleanBoard(state.board))
    }
    renderLocalBoards()
    showStatus(`已删除 ${names.length} 个本地文件`)
    return true
  }

  function selectAllLocalBoards() {
    setLocalBoardSelection(true)
  }

  function clearSelectedLocalBoards() {
    setLocalBoardSelection(false)
  }

  elements.localBoardNameDialog.querySelector('form').addEventListener('submit', (event) => {
    if (!pendingNameRequest) return
    if (event.submitter?.value === 'cancel') return
    const name = normalizeFileName(elements.localBoardNameInput.value)
    const error = validatePendingFileName(name)
    if (!error) return
    event.preventDefault()
    showFileNameError(error)
  })

  elements.localBoardNameInput.addEventListener('input', () => {
    if (!pendingNameRequest) return
    showFileNameError(validatePendingFileName(normalizeFileName(elements.localBoardNameInput.value)))
  })

  elements.localBoardNameDialog.addEventListener('close', () => {
    if (!pendingNameRequest) return
    const name = elements.localBoardNameDialog.returnValue === 'confirm'
      ? normalizeFileName(elements.localBoardNameInput.value)
      : ''
    pendingNameRequest.resolve(name)
    pendingNameRequest = null
    showFileNameError('')
  })

  elements.deleteSelectedLocalBoards.addEventListener('click', deleteSelectedLocalBoards)
  elements.selectAllLocalBoards.addEventListener('click', selectAllLocalBoards)
  elements.clearSelectedLocalBoards.addEventListener('click', clearSelectedLocalBoards)

  return {
    deleteLocalBoard,
    deleteSelectedLocalBoards,
    loadLocalBoard,
    newLocalBoard,
    renderLocalBoards,
    renameLocalBoard,
    saveLocalBoard,
    saveLocalBoardAs,
    updateLocalBoardButtons,
  }

  async function saveFile(fileName, { allowOverwrite }) {
    const name = normalizeFileName(fileName)
    if (!name) return false
    const files = loadLocalFiles()
    const existingIndex = files.findIndex((file) => file.name === name)
    if (existingIndex >= 0 && !allowOverwrite) return false
    const now = new Date().toISOString()
    const project = createProjectFromBoard(state.board, { fileName: name })
    const board = createPureBoardFromProject(project)
    const preview = await createPreview(board)
    const current = existingIndex >= 0 ? files[existingIndex] : null
    const file = {
      name,
      project,
      board,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      preview,
    }
    const nextFiles = existingIndex >= 0
      ? files.map((entry, index) => index === existingIndex ? file : entry)
      : [file, ...files].slice(0, MAX_LOCAL_BOARDS)
    if (!saveLocalFiles(nextFiles)) return false
    setCurrentFile(name, board)
    renderLocalBoards()
    showStatus('已保存本地文件')
    return true
  }

  function createLocalFileRow(file) {
    const row = document.createElement('article')
    row.className = 'local-board-row'
    const select = document.createElement('label')
    select.className = 'local-board-select'
    select.title = '选择文件'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = file.name
    checkbox.setAttribute('aria-label', `选择 ${file.name}`)
    checkbox.addEventListener('change', updateLocalBoardButtons)
    select.append(checkbox)

    const preview = document.createElement('button')
    preview.type = 'button'
    preview.className = 'local-board-preview'
    preview.title = `打开 ${file.name}`
    preview.addEventListener('click', () => loadLocalBoard(file.name))
    if (file.preview) {
      const image = document.createElement('img')
      image.src = file.preview
      image.alt = ''
      preview.append(image)
    } else {
      preview.textContent = '无预览'
    }

    const meta = document.createElement('div')
    meta.className = 'local-board-meta'
    const name = document.createElement('strong')
    name.textContent = file.name
    const shareName = document.createElement('span')
    shareName.textContent = `分享名：${file.project?.board?.name || file.board?.name || '未命名'}`
    const time = document.createElement('span')
    time.textContent = formatLocalFileTime(file)
    meta.append(name, shareName, time)

    const actions = document.createElement('div')
    actions.className = 'local-board-actions'
    actions.append(
      createRowButton('打开', () => loadLocalBoard(file.name)),
      createRowButton('重命名', () => renameLocalBoard(file.name)),
      createRowButton('删除', () => deleteLocalBoard(file.name)),
    )
    row.append(select, preview, meta, actions)
    return row
  }

  function createRowButton(label, onClick) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', onClick)
    return button
  }

  function requestFileName({ currentName, title, initialError = '', validate = null }) {
    return new Promise((resolve) => {
      pendingNameRequest = { resolve, validate }
      elements.localBoardNameDialog.querySelector('h2').textContent = title
      elements.localBoardNameInput.value = currentName
      showFileNameError(initialError)
      elements.localBoardNameDialog.showModal()
      elements.localBoardNameInput.focus()
      elements.localBoardNameInput.select()
    })
  }

  function getCurrentFileName() {
    return normalizeFileName(elements.fileName.value || state.currentFileName)
  }

  function setCurrentFile(fileName, board) {
    state.currentFileName = fileName
    state.localFileSnapshot = boardSnapshot(board)
    elements.fileName.value = fileName
  }

  function isCurrentFileDirty() {
    return boardSnapshot(cleanBoard(state.board)) !== state.localFileSnapshot
  }

  function saveLocalFiles(files) {
    if (persistLocalFiles(files)) {
      return true
    }
    showStatus('保存本地文件失败', { type: 'error' })
    return false
  }

  function getSelectedFileNames() {
    return [...elements.localBoardList.querySelectorAll('input[type="checkbox"]:checked')]
      .map((input) => input.value)
  }

  function getSelectableFilesCount() {
    return elements.localBoardList.querySelectorAll('input[type="checkbox"]').length
  }

  function setLocalBoardSelection(selected) {
    for (const checkbox of elements.localBoardList.querySelectorAll('input[type="checkbox"]')) {
      checkbox.checked = selected
    }
    updateLocalBoardButtons()
  }

  function fileExists(fileName) {
    return loadLocalFiles().some((file) => file.name === fileName)
  }

  function uniqueFileNameValidator(allowedFileName) {
    return (fileName) => {
      if (!fileName) return '请输入文件名'
      if (fileName !== allowedFileName && fileExists(fileName)) return '已有同名文件，请换一个名称'
      return ''
    }
  }

  function validatePendingFileName(fileName) {
    return pendingNameRequest?.validate?.(fileName) ?? ''
  }

  function showFileNameError(message) {
    elements.localBoardNameError.textContent = message
    elements.localBoardNameInput.setAttribute('aria-invalid', message ? 'true' : 'false')
  }

  function closeLocalBoardDialog() {
    if (elements.localBoardDialog.open) {
      elements.localBoardDialog.close()
    }
  }

  async function createPreview(board) {
    try {
      const code = await encodeBoardCode(board)
      const data = await renderPreviewImage(code)
      return `/preview/${data.hash}.webp`
    } catch (error) {
      console.warn('Failed to create local file preview', error)
      try {
        await renderAll()
        return stage.toDataURL({ pixelRatio: 0.18 })
      } catch {
        return ''
      }
    }
  }
}

function boardSnapshot(board) {
  return JSON.stringify(cleanBoard(board))
}

function formatLocalFileTime(file) {
  const date = new Date(file.updatedAt)
  return Number.isNaN(date.getTime())
    ? ''
    : `保存于 ${date.toLocaleString('zh-CN', { hour12: false })}`
}

function normalizeFileName(name) {
  return String(name ?? '').trim()
}
