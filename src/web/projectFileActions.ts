import { replaceBoard } from './editorState.js'
import {
  PROJECT_FILE_EXTENSION,
  createProjectFromBoard,
  createProjectSnapshot,
  flattenProjectToBoard,
  parseProjectJson,
  projectToJson,
} from './project.js'
import type {
  BrowserWindow,
  EditorState,
  FileLike,
  ProjectFileActions,
  ValueElement,
} from './types.js'

const browserWindow = (globalThis as unknown as { window: BrowserWindow }).window

interface ProjectFileElements {
  fileName: ValueElement
  boardName: ValueElement
}

interface ProjectFileActionsDeps {
  state: EditorState
  elements: ProjectFileElements
  recordHistory: () => void
  renderAll: () => Promise<void>
  renderBackgroundOptions: () => void
}

export function createProjectFileActions({
  state,
  elements,
  recordHistory,
  renderAll,
  renderBackgroundOptions,
}: ProjectFileActionsDeps): ProjectFileActions {
  function downloadProjectFile() {
    const projectFileName = stripProjectFileExtension(getCurrentFileName())
    const downloadName = normalizeProjectFileName(projectFileName)
    const project = createProjectFromBoard(state.board, {
      fileName: projectFileName,
      layerTree: state.layerTree,
    })
    const blob = new Blob([projectToJson(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = browserWindow.document.createElement('a')
    link.href = url
    link.download = downloadName
    browserWindow.document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function importProjectFile(file?: FileLike | null) {
    if (!file) return false
    const project = parseProjectJson(await file.text())
    const board = flattenProjectToBoard(project)
    recordHistory()
    replaceBoard(state, board)
    state.layerTree = project.layers
    const fileName = stripProjectFileExtension(file.name || project.fileName || '')
    state.currentFileName = fileName
    state.localFileSnapshot = createProjectSnapshot(state.board, {
      fileName,
      layerTree: state.layerTree,
    })
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

  function getCurrentFileName(): string {
    return elements.fileName.value || state.currentFileName || state.board.name || '未命名工程'
  }
}

function normalizeProjectFileName(name: unknown): string {
  const baseName = stripProjectFileExtension(String(name ?? '').trim()) || '未命名工程'
  return `${baseName}${PROJECT_FILE_EXTENSION}`
}

function stripProjectFileExtension(name: unknown): string {
  const value = String(name ?? '').trim()
  return value.endsWith(PROJECT_FILE_EXTENSION)
    ? value.slice(0, -PROJECT_FILE_EXTENSION.length)
    : value
}
