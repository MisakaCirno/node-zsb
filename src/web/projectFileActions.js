import { cleanBoard } from './board.js'
import { replaceBoard } from './editorState.js'
import {
  PROJECT_FILE_EXTENSION,
  createProjectFromBoard,
  flattenProjectToBoard,
  parseProjectJson,
  projectToJson,
} from './project.js'

export function createProjectFileActions({
  state,
  elements,
  recordHistory,
  renderAll,
  renderBackgroundOptions,
}) {
  function downloadProjectFile() {
    const fileName = normalizeProjectFileName(getCurrentFileName())
    const project = createProjectFromBoard(state.board, {
      fileName,
      layerTree: state.layerTree,
    })
    const blob = new Blob([projectToJson(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function importProjectFile(file) {
    if (!file) return false
    const project = parseProjectJson(await file.text())
    const board = flattenProjectToBoard(project)
    recordHistory()
    replaceBoard(state, board)
    state.layerTree = project.layers
    const fileName = stripProjectFileExtension(file.name || project.fileName || '')
    state.currentFileName = fileName
    state.localFileSnapshot = JSON.stringify(cleanBoard(board))
    elements.fileName.value = fileName
    elements.boardName.value = state.board.name ?? ''
    renderBackgroundOptions()
    await renderAll()
    return true
  }

  return {
    downloadProjectFile,
    importProjectFile,
  }

  function getCurrentFileName() {
    return elements.fileName.value || state.currentFileName || state.board.name || '未命名工程'
  }
}

function normalizeProjectFileName(name) {
  const baseName = stripProjectFileExtension(String(name ?? '').trim()) || '未命名工程'
  return `${baseName}${PROJECT_FILE_EXTENSION}`
}

function stripProjectFileExtension(name) {
  const value = String(name ?? '').trim()
  return value.endsWith(PROJECT_FILE_EXTENSION)
    ? value.slice(0, -PROJECT_FILE_EXTENSION.length)
    : value
}
