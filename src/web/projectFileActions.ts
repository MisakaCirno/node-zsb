import { replaceBoard } from './editorState.js'
import { getBrowserWindow } from './browser.js'
import {
  PROJECT_FILE_EXTENSION,
  createProjectFromBoard,
  flattenProjectToBoard,
  parseProjectJson,
  projectToJson,
} from './project.js'
import { markDocumentClean } from './documentState.js'
import type {
  EditorState,
  FileLike,
  ProjectFileActions,
  TextElement,
  ValueElement,
} from './types.js'

const browserWindow = getBrowserWindow()

interface ProjectFileElements {
  fileName: ValueElement & { maxLength: number }
  fileNameCount: TextElement
  boardName: ValueElement & { maxLength: number }
  shareNameCount: TextElement
}

interface ProjectFileActionsDeps {
  state: EditorState
  elements: ProjectFileElements
  confirmDocumentReplacement(actionLabel: string): Promise<boolean>
  renderAll: () => Promise<void>
  renderBackgroundOptions: () => void
  updateHistoryButtons(): void
}

export function createProjectFileActions({
  state,
  elements,
  confirmDocumentReplacement,
  renderAll,
  renderBackgroundOptions,
  updateHistoryButtons,
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
    if (!await confirmDocumentReplacement('导入工程文件')) return false
    replaceBoard(state, board)
    state.layerTree = project.layers
    const fileName = stripProjectFileExtension(file.name || project.fileName || '')
    state.history = []
    state.future = []
    markDocumentClean(state, {
      associatedLocalFileName: '',
      fileName,
    })
    updateHistoryButtons()
    elements.fileName.value = fileName
    elements.boardName.value = state.board.name ?? ''
    syncNameCounter(elements.fileName, elements.fileNameCount)
    syncNameCounter(elements.boardName, elements.shareNameCount)
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

function syncNameCounter(input: ValueElement & { maxLength: number }, output: TextElement) {
  const maxLength = input.maxLength > 0 ? input.maxLength : input.value.length
  output.textContent = `${input.value.length}/${maxLength}`
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
