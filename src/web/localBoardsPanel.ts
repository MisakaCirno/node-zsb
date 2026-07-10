import { normalizeBoard } from './board.js'
import { encodeBoardCode, renderPreviewImage } from './api.js'
import {
  createProjectFromBoard,
  createPureBoardFromProject,
  flattenProjectToBoard,
  normalizeProject,
} from './project.js'
import {
  createLocalFileSnapshot,
  detachDocumentAndMarkDirty,
  isDocumentDirty,
  markDocumentClean,
} from './documentState.js'
import { getBrowserDocument } from './browser.js'
import { syncFlatLayerTree } from './layerTree.js'
import { createNameDialogController } from './nameDialog.js'
import {
  clearAllProjectStorage,
  clearProjectStorageTarget,
  getBrowserStorageEstimate,
  getProjectStorageUsage,
  loadLocalFiles,
  persistLocalFilesDetailed,
  type BrowserStorageEstimateSummary,
  type ProjectStorageClearTarget,
  type ProjectStorageUsage,
  type ProjectStorageUsageEntry,
} from './storage.js'
import { DEFAULT_BOARD_BACKGROUND } from '../shared/backgrounds.js'
import type {
  Board,
  DocumentReplaceDecision,
  EditorState,
  LayerNode,
  LocalFile,
  RunEditorAction,
} from './types.js'

interface LocalBoardsPanelDeps {
  state: EditorState
  elements: LocalBoardsPanelElements
  renderAll(): Promise<void>
  runAction: RunEditorAction
  renderBackgroundOptions(): void
  updateHistoryButtons(): void
  showStatus(message: string, options?: { type?: string }): void
  confirmAction(message: string): boolean
  renderLocalPresets(): void
  stageRenderer: StagePreview
}

interface LocalBoardsPanelElements {
  localBoardDialog: DialogElement
  localStorageDetailsDialog: DialogElement
  localBoardNameDialog: DialogElement
  unsavedChangesDialog: DialogElement
  unsavedChangesMessage: TextElement
  localStorageSummary: HTMLElement
  localStorageDetails: HTMLElement
  localBoardList: ListElement
  localBoardNameInput: InputElement
  localBoardNameError: TextElement
  confirmLocalBoardName: DisabledElement
  selectAllLocalBoards: ButtonElement
  clearSelectedLocalBoards: ButtonElement
  deleteSelectedLocalBoards: ButtonElement
  saveLocalBoard: DisabledElement
  saveAsLocalBoard: DisabledElement
  newLocalBoard: DisabledElement
  fileName: InputElement
  fileNameCount: TextElement
  fileDirtyIndicator: TextElement & { hidden: boolean }
  boardName: InputElement
  shareNameCount: TextElement
}

interface StagePreview {
  exportCleanPreviewDataUrl(options?: { pixelRatio?: number }): string
}

interface DialogElement {
  open: boolean
  returnValue: string
  close(): void
  showModal(): void
  addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void
  querySelector(selector: 'form'): FormElement
  querySelector(selector: 'h2'): TextElement
  querySelector(selector: string): FormElement | TextElement | null
}

interface ListElement {
  innerHTML: string
  append(...nodes: unknown[]): void
  querySelectorAll<E extends Element = Element>(selector: string): NodeListOf<E>
}

interface FormElement {
  addEventListener(type: 'submit', listener: (event: SubmitLike) => void): void
}

interface SubmitLike {
  preventDefault(): void
  submitter?: { value?: string } | null
}

interface InputElement {
  value: string
  maxLength: number
  checked?: boolean
  addEventListener(type: string, listener: () => void): void
  focus(): void
  select(): void
  setAttribute(name: string, value: string): void
}

interface TextElement {
  textContent: string | null
}

interface DisabledElement {
  disabled: boolean
}

interface ButtonElement extends DisabledElement {
  addEventListener(type: 'click', listener: () => void): void
}

interface FileNameRequest {
  currentName: string
  title: string
  initialError?: string
  validate?: ((fileName: string) => string) | null
}

interface StorageStats {
  browserEstimate: BrowserStorageEstimateSummary
  projectUsage: ProjectStorageUsage
}

interface StorageClearConfig {
  message: string
  success: string
}

const STORAGE_CLEAR_CONFIGS: Record<ProjectStorageClearTarget, StorageClearConfig> = {
  'editor-draft': {
    message: '清理自动草稿？当前画布不会立即改变，但刷新后不会恢复该草稿。',
    success: '已清理自动草稿',
  },
  'layout-settings': {
    message: '清理面板布局设置？刷新后会恢复默认布局。',
    success: '已清理面板布局设置',
  },
  'legacy-local-files': {
    message: '清理旧版本地文件数据？此操作无法恢复。',
    success: '已清理旧版本地文件数据',
  },
  'local-files': {
    message: '删除所有本地文件？此操作无法恢复。',
    success: '已删除所有本地文件',
  },
  'local-presets': {
    message: '删除所有本地预设？此操作无法恢复。',
    success: '已删除所有本地预设',
  },
  'other-local-storage': {
    message: '清理其他本项目本地数据？此操作无法恢复。',
    success: '已清理其他本项目本地数据',
  },
  'preset-preview-cache': {
    message: '清理预设缩略图缓存？需要时会重新生成。',
    success: '已清理预设缩略图缓存',
  },
  'view-settings': {
    message: '清理视图设置？刷新后会恢复默认视图设置。',
    success: '已清理视图设置',
  },
}

const CLEARABLE_STORAGE_TARGETS = new Set<ProjectStorageClearTarget>(
  Object.keys(STORAGE_CLEAR_CONFIGS) as ProjectStorageClearTarget[],
)

export function createLocalBoardsPanel({
  state,
  elements,
  renderAll,
  runAction,
  renderBackgroundOptions,
  updateHistoryButtons,
  showStatus,
  confirmAction,
  renderLocalPresets,
  stageRenderer,
}: LocalBoardsPanelDeps) {
  const browserDocument = getBrowserDocument()
  const runLocalFileAction = (action: () => unknown | Promise<unknown>) => {
    void runAction(action, '', { busyMessage: '正在处理本地文件...' })
  }
  let storageSummaryRequestId = 0
  let currentStorageStats: StorageStats | null = null
  const fileNameDialog = createNameDialogController({
    elements: {
      dialog: elements.localBoardNameDialog,
      input: elements.localBoardNameInput,
      error: elements.localBoardNameError,
      title: elements.localBoardNameDialog.querySelector('h2'),
    },
    normalizeName: normalizeFileName,
  })
  elements.localStorageSummary.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('#open-local-storage-details')
      : null
    if (!trigger) return
    openLocalStorageDetails()
  })

  function renderLocalBoards() {
    void updateLocalStorageSummary()
    const files = loadLocalFiles()
    elements.localBoardList.innerHTML = ''
    if (files.length === 0) {
      const empty = browserDocument.createElement('p')
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
      validate: uniqueFileNameValidator(state.associatedLocalFileName),
    })
    if (!fileName) return false
    if (fileExists(fileName) && fileName !== state.associatedLocalFileName) {
      const nextName = await requestFileName({
        currentName: fileName,
        title: '保存文件',
        initialError: '已有同名文件，请换一个名称',
        validate: uniqueFileNameValidator(state.associatedLocalFileName),
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
    if (!await confirmDocumentReplacement('新建文件')) return false
    state.board = normalizeBoard({
      name: '',
      boardBackground: DEFAULT_BOARD_BACKGROUND,
      objects: [],
    })
    syncFlatLayerTree(state)
    state.selectedIndex = -1
    state.selectedIndexes = []
    state.selectedGroupId = ''
    state.history = []
    state.future = []
    updateHistoryButtons()
    setCurrentDocument('', '')
    markDocumentClean(state)
    syncDocumentStatus()
    elements.boardName.value = ''
    syncNameCounter(elements.boardName, elements.shareNameCount)
    renderBackgroundOptions()
    renderLocalBoards()
    await renderAll()
    showStatus('已新建文件')
    return true
  }

  async function loadLocalBoard(fileName: string) {
    const files = loadLocalFiles()
    const file = files.find((entry) => entry.name === fileName)
    if (!file) return false
    if (!await confirmDocumentReplacement('打开其他文件')) return false
    const project = file.project ? normalizeProject(file.project) : null
    state.board = normalizeBoard(project ? flattenProjectToBoard(project) : file.board)
    state.layerTree = project?.layers ?? state.board.objects.map((object) => ({
      type: 'object',
      id: object.editorId,
    })).filter((node): node is LayerNode => Boolean(node.id))
    state.selectedIndex = -1
    state.selectedIndexes = []
    state.selectedGroupId = ''
    state.history = []
    state.future = []
    updateHistoryButtons()
    setCurrentDocument(file.name, file.name)
    state.documentBaselineSnapshot = createLocalFileSnapshot(file)
    syncDocumentStatus()
    elements.boardName.value = state.board.name ?? ''
    syncNameCounter(elements.boardName, elements.shareNameCount)
    renderBackgroundOptions()
    renderLocalBoards()
    await renderAll()
    closeLocalBoardDialog()
    showStatus(`已打开文件 ${file.name}`)
    return true
  }

  async function renameLocalBoard(fileName: string) {
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
    file.project.fileName = name
    file.updatedAt = new Date().toISOString()
    if (!saveLocalFiles(files)) return false
    if (state.associatedLocalFileName === fileName) {
      const shouldRenameDisplay = state.currentFileName === fileName
      state.associatedLocalFileName = name
      if (shouldRenameDisplay) {
        state.currentFileName = name
        elements.fileName.value = name
        syncNameCounter(elements.fileName, elements.fileNameCount)
      }
      state.documentBaselineSnapshot = createLocalFileSnapshot(file)
      syncDocumentStatus()
      await renderAll()
    }
    renderLocalBoards()
    showStatus('已重命名本地文件')
    return true
  }

  async function deleteLocalBoard(fileName: string) {
    const files = loadLocalFiles()
    const file = files.find((entry) => entry.name === fileName)
    if (!file) return false
    if (!confirmAction(`删除本地文件“${file.name}”？`)) return false
    const nextFiles = files.filter((entry) => entry.name !== file.name)
    if (!saveLocalFiles(nextFiles)) return false
    if (state.associatedLocalFileName === file.name) {
      detachDocumentAndMarkDirty(state)
      syncDocumentStatus()
      await renderAll()
    }
    renderLocalBoards()
    showStatus('已删除本地文件')
    return true
  }

  async function deleteSelectedLocalBoards() {
    const names = getSelectedFileNames()
    if (names.length === 0) return false
    if (!confirmAction(`删除选中的 ${names.length} 个本地文件？`)) return false
    const nextFiles = loadLocalFiles().filter((file) => !names.includes(file.name))
    if (!saveLocalFiles(nextFiles)) return false
    if (names.includes(state.associatedLocalFileName)) {
      detachDocumentAndMarkDirty(state)
      syncDocumentStatus()
      await renderAll()
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

  elements.deleteSelectedLocalBoards.addEventListener('click', () =>
    runLocalFileAction(deleteSelectedLocalBoards))
  elements.selectAllLocalBoards.addEventListener('click', selectAllLocalBoards)
  elements.clearSelectedLocalBoards.addEventListener('click', clearSelectedLocalBoards)

  return {
    confirmDocumentReplacement,
    deleteLocalBoard,
    deleteSelectedLocalBoards,
    loadLocalBoard,
    newLocalBoard,
    onFileNameInput,
    renderLocalBoards,
    renameLocalBoard,
    saveLocalBoard,
    saveLocalBoardAs,
    updateLocalBoardButtons,
  }

  async function saveFile(fileName: string, { allowOverwrite }: { allowOverwrite: boolean }) {
    const name = normalizeFileName(fileName)
    if (!name) return false
    const files = loadLocalFiles()
    const existingIndex = files.findIndex((file) => file.name === name)
    if (existingIndex >= 0 && !allowOverwrite) return false
    const now = new Date().toISOString()
    const project = createProjectFromBoard(state.board, {
      fileName: name,
      layerTree: state.layerTree,
    })
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
      : [file, ...files]
    if (!saveLocalFiles(nextFiles)) return false
    setCurrentDocument(name, name)
    markDocumentClean(state, {
      associatedLocalFileName: name,
      fileName: name,
    })
    syncDocumentStatus()
    await renderAll()
    renderLocalBoards()
    showStatus('已保存本地文件')
    return true
  }

  function createLocalFileRow(file: LocalFile) {
    const row = browserDocument.createElement('article')
    row.className = 'local-board-row'
    const select = browserDocument.createElement('label')
    select.className = 'local-board-select'
    select.title = '选择文件'
    const checkbox = browserDocument.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = file.name
    checkbox.setAttribute('aria-label', `选择 ${file.name}`)
    checkbox.addEventListener('change', updateLocalBoardButtons)
    select.append(checkbox)

    const preview = browserDocument.createElement('button')
    preview.type = 'button'
    preview.className = 'local-board-preview'
    preview.title = `打开 ${file.name}`
    preview.addEventListener('click', () =>
      runLocalFileAction(() => loadLocalBoard(file.name)))
    if (file.preview) {
      const image = browserDocument.createElement('img')
      image.src = file.preview
      image.alt = ''
      preview.append(image)
    } else {
      preview.textContent = '无预览'
    }

    const meta = browserDocument.createElement('div')
    meta.className = 'local-board-meta'
    const name = browserDocument.createElement('strong')
    name.textContent = file.name
    const shareName = browserDocument.createElement('span')
    shareName.textContent = `分享名：${file.project?.board?.name || file.board?.name || '未命名'}`
    const size = browserDocument.createElement('span')
    size.textContent = `占用：${formatBytes(getSerializedBytes(file))}`
    const time = browserDocument.createElement('span')
    time.textContent = formatLocalFileTime(file)
    meta.append(name, shareName, size, time)

    const actions = browserDocument.createElement('div')
    actions.className = 'local-board-actions'
    actions.append(
      createRowButton('打开', () => loadLocalBoard(file.name)),
      createRowButton('重命名', () => renameLocalBoard(file.name)),
      createRowButton('删除', () => deleteLocalBoard(file.name)),
    )
    row.append(select, preview, meta, actions)
    return row
  }

  function createRowButton(
    label: string,
    onClick: () => unknown | Promise<unknown>,
  ) {
    const button = browserDocument.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', () => runLocalFileAction(onClick))
    return button
  }

  function requestFileName({ currentName, title, initialError = '', validate = null }: FileNameRequest) {
    return fileNameDialog.requestName({
      currentName,
      title,
      initialError,
      validate,
    })
  }

  function getCurrentFileName() {
    return normalizeFileName(state.currentFileName)
  }

  function setCurrentDocument(fileName: string, associatedLocalFileName: string) {
    state.currentFileName = fileName
    state.associatedLocalFileName = associatedLocalFileName
    elements.fileName.value = fileName
    syncNameCounter(elements.fileName, elements.fileNameCount)
  }

  function onFileNameInput() {
    state.currentFileName = elements.fileName.value
    syncNameCounter(elements.fileName, elements.fileNameCount)
    syncDocumentStatus()
    void renderAll()
  }

  function syncNameCounter(input: InputElement, output: TextElement) {
    const maxLength = input.maxLength > 0 ? input.maxLength : input.value.length
    output.textContent = `${input.value.length}/${maxLength}`
  }

  function syncDocumentStatus() {
    const dirty = isDocumentDirty(state)
    elements.fileDirtyIndicator.hidden = !dirty
    elements.fileDirtyIndicator.textContent = dirty ? '未保存' : ''
  }

  async function confirmDocumentReplacement(actionLabel: string): Promise<boolean> {
    if (!isDocumentDirty(state)) return true
    const decision = await requestDocumentReplaceDecision(actionLabel)
    if (decision === 'cancel') return false
    if (decision === 'discard') return true
    return saveLocalBoard()
  }

  function requestDocumentReplaceDecision(actionLabel: string): Promise<DocumentReplaceDecision> {
    elements.unsavedChangesMessage.textContent = `当前文件有未保存修改。${actionLabel}前是否保存？`
    elements.unsavedChangesDialog.returnValue = 'cancel'
    elements.unsavedChangesDialog.showModal()
    return new Promise((resolve) => {
      elements.unsavedChangesDialog.addEventListener('close', () => {
        const value = elements.unsavedChangesDialog.returnValue
        resolve(value === 'save' || value === 'discard' ? value : 'cancel')
      }, { once: true })
    })
  }

  async function updateLocalStorageSummary() {
    const requestId = ++storageSummaryRequestId
    renderLocalStoragePreviewLoading()
    if (elements.localStorageDetailsDialog.open) {
      elements.localStorageDetails.textContent = '正在统计存储空间...'
    }
    const [browserEstimate, projectUsage] = await Promise.all([
      getBrowserStorageEstimate(),
      getProjectStorageUsage(),
    ])
    if (requestId !== storageSummaryRequestId) return
    currentStorageStats = { browserEstimate, projectUsage }
    renderLocalStoragePreview(browserEstimate, projectUsage)
    if (elements.localStorageDetailsDialog.open) {
      renderLocalStorageDetails(browserEstimate, projectUsage)
    }
  }

  function renderLocalStoragePreviewLoading() {
    elements.localStorageSummary.textContent = '正在统计存储空间...'
  }

  function renderLocalStoragePreview(
    browserEstimate: BrowserStorageEstimateSummary,
    projectUsage: ProjectStorageUsage,
  ) {
    const wrapper = browserDocument.createElement('div')
    wrapper.className = 'local-storage-preview'

    const main = browserDocument.createElement('div')
    main.className = 'local-storage-preview-main'
    const label = browserDocument.createElement('span')
    label.textContent = '本项目已用'
    const value = browserDocument.createElement('strong')
    value.textContent = formatBytes(projectUsage.totalBytes)
    main.append(label, value)

    const meta = browserDocument.createElement('div')
    meta.className = 'local-storage-preview-meta'
    const localFiles = projectUsage.entries.find((entry) => entry.id === 'local-files')
    const localFilesText = browserDocument.createElement('span')
    localFilesText.textContent = `本地文件 ${formatBytes(localFiles?.bytes ?? 0)}`
    const browserUsageText = browserDocument.createElement('span')
    browserUsageText.textContent = browserEstimate.usageBytes !== null && browserEstimate.quotaBytes !== null
      ? `浏览器已用 ${formatBytes(browserEstimate.usageBytes)} / ${formatBytes(browserEstimate.quotaBytes)}`
      : '浏览器已用不可用'
    const availableText = browserDocument.createElement('span')
    availableText.textContent = browserEstimate.supported
      ? `可用 ${formatOptionalBytes(browserEstimate.availableBytes)}`
      : '可用空间不可用'
    meta.append(localFilesText, browserUsageText, availableText)

    const bar = browserDocument.createElement('span')
    bar.className = 'local-storage-preview-bar'
    bar.setAttribute('aria-label', '浏览器存储已用比例')
    const fill = browserDocument.createElement('span')
    fill.style.width = browserEstimate.usageBytes !== null && browserEstimate.quotaBytes !== null && browserEstimate.quotaBytes > 0
      ? `${Math.max(2, Math.min(100, Math.round((browserEstimate.usageBytes / browserEstimate.quotaBytes) * 100)))}%`
      : '0%'
    bar.append(fill)

    const button = browserDocument.createElement('button')
    button.id = 'open-local-storage-details'
    button.type = 'button'
    button.textContent = '查看详情'

    wrapper.append(main, meta, bar, button)
    elements.localStorageSummary.replaceChildren(wrapper)
  }

  function openLocalStorageDetails() {
    if (elements.localBoardDialog.open) {
      elements.localBoardDialog.close()
    }
    if (currentStorageStats) {
      renderLocalStorageDetails(currentStorageStats.browserEstimate, currentStorageStats.projectUsage)
    } else {
      elements.localStorageDetails.textContent = '正在统计存储空间...'
    }
    elements.localStorageDetailsDialog.showModal()
    void updateLocalStorageSummary()
  }

  function renderLocalStorageDetails(
    browserEstimate: BrowserStorageEstimateSummary,
    projectUsage: ProjectStorageUsage,
  ) {
    const overview = browserDocument.createElement('div')
    overview.className = 'local-storage-overview'
    overview.append(
      createStorageMetric('可用空间', formatOptionalBytes(browserEstimate.availableBytes)),
      createStorageMetric(
        '浏览器已用',
        browserEstimate.usageBytes !== null && browserEstimate.quotaBytes !== null
          ? `${formatBytes(browserEstimate.usageBytes)} / ${formatBytes(browserEstimate.quotaBytes)}`
          : '不可用',
      ),
      createStorageMetric('本项目', formatBytes(projectUsage.totalBytes)),
    )

    const actions = browserDocument.createElement('div')
    actions.className = 'local-storage-detail-actions'
    const clearAllButton = browserDocument.createElement('button')
    clearAllButton.type = 'button'
    clearAllButton.className = 'danger-button'
    clearAllButton.disabled = projectUsage.totalBytes === 0
    clearAllButton.textContent = '清理全部'
    clearAllButton.addEventListener('click', () => {
      runLocalFileAction(clearAllStorage)
    })
    actions.append(clearAllButton)

    const usageList = browserDocument.createElement('div')
    usageList.className = 'local-storage-usage-list'
    for (const entry of projectUsage.entries) {
      const row = browserDocument.createElement('div')
      row.className = 'local-storage-usage-row'
      const label = browserDocument.createElement('span')
      label.textContent = entry.label
      const value = browserDocument.createElement('strong')
      value.textContent = formatBytes(entry.bytes)
      const action = createStorageClearButton(entry)
      const bar = browserDocument.createElement('span')
      bar.className = 'local-storage-usage-bar'
      const fill = browserDocument.createElement('span')
      fill.style.width = projectUsage.totalBytes > 0
        ? `${Math.max(2, Math.round((entry.bytes / projectUsage.totalBytes) * 100))}%`
        : '0%'
      bar.append(fill)
      row.append(label, value, action, bar)
      usageList.append(row)
    }

    const note = browserDocument.createElement('p')
    note.className = 'local-storage-note'
    note.textContent = browserEstimate.supported
      ? '空间为浏览器估算值，保存时以实际写入结果为准。'
      : '当前浏览器不支持存储空间估算，保存时以实际写入结果为准。'

    elements.localStorageDetails.replaceChildren(overview, actions, usageList, note)
  }

  function createStorageClearButton(entry: ProjectStorageUsageEntry) {
    const button = browserDocument.createElement('button')
    button.type = 'button'
    button.textContent = '清理'
    const target = isStorageClearTarget(entry.id) ? entry.id : null
    button.disabled = entry.bytes === 0 || !target
    if (target) {
      button.addEventListener('click', () => {
        runLocalFileAction(() => clearStorageTarget(target))
      })
    }
    return button
  }

  function createStorageMetric(label: string, value: string) {
    const metric = browserDocument.createElement('span')
    metric.className = 'local-storage-metric'
    const labelNode = browserDocument.createElement('span')
    labelNode.textContent = label
    const valueNode = browserDocument.createElement('strong')
    valueNode.textContent = value
    metric.append(labelNode, valueNode)
    return metric
  }

  function getSerializedBytes(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length
  }

  async function clearStorageTarget(target: ProjectStorageClearTarget) {
    const config = STORAGE_CLEAR_CONFIGS[target]
    if (!confirmAction(config.message)) return false
    const ok = await clearProjectStorageTarget(target)
    if (!ok) {
      showStatus('清理存储失败', { type: 'error' })
      return false
    }
    await refreshAfterStorageClear(target)
    showStatus(config.success)
    return true
  }

  async function clearAllStorage() {
    if (!confirmAction('清理所有本项目本地存储？这会删除本地文件、本地预设、自动草稿、视图设置、面板布局、旧数据和预设缩略图缓存，且无法恢复。')) {
      return false
    }
    const ok = await clearAllProjectStorage()
    if (!ok) {
      showStatus('清理存储失败', { type: 'error' })
      return false
    }
    await refreshAfterStorageClear('local-files', { clearedAll: true })
    showStatus('已清理所有本项目本地存储')
    return true
  }

  async function refreshAfterStorageClear(
    target: ProjectStorageClearTarget,
    options: { clearedAll?: boolean } = {},
  ) {
    const shouldRefreshLocalFiles = options.clearedAll || target === 'local-files'
    const shouldRefreshLocalPresets = options.clearedAll || target === 'local-presets'
    if (shouldRefreshLocalFiles) {
      detachDocumentAndMarkDirty(state)
      syncDocumentStatus()
      await renderAll()
      renderLocalBoards()
    } else {
      await updateLocalStorageSummary()
    }
    if (shouldRefreshLocalPresets) {
      renderLocalPresets()
    }
  }

  function isStorageClearTarget(id: string): id is ProjectStorageClearTarget {
    return CLEARABLE_STORAGE_TARGETS.has(id as ProjectStorageClearTarget)
  }

  function saveLocalFiles(files: LocalFile[]) {
    const result = persistLocalFilesDetailed(files)
    if (result.ok) {
      return true
    }
    if (result.reason === 'quota') {
      showStatus('浏览器本地存储空间不足，请删除旧文件后再保存', { type: 'error' })
      return false
    }
    showStatus('保存本地文件失败', { type: 'error' })
    return false
  }

  function getSelectedFileNames() {
    return [...elements.localBoardList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')]
      .map((input) => input.value)
  }

  function getSelectableFilesCount() {
    return elements.localBoardList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').length
  }

  function setLocalBoardSelection(selected: boolean) {
    for (const checkbox of elements.localBoardList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      checkbox.checked = selected
    }
    updateLocalBoardButtons()
  }

  function fileExists(fileName: string) {
    return loadLocalFiles().some((file) => file.name === fileName)
  }

  function uniqueFileNameValidator(allowedFileName: string) {
    return (fileName: string) => {
      if (!fileName) return '请输入文件名'
      if (fileName !== allowedFileName && fileExists(fileName)) return '已有同名文件，请换一个名称'
      return ''
    }
  }

  function closeLocalBoardDialog() {
    if (elements.localBoardDialog.open) {
      elements.localBoardDialog.close()
    }
  }

  async function createPreview(board: Board) {
    try {
      const code = await encodeBoardCode(board)
      const data = await renderPreviewImage(code)
      return `/preview/${data.hash}.webp`
    } catch (error) {
      console.warn('Failed to create local file preview', error)
      try {
        await renderAll()
        return stageRenderer.exportCleanPreviewDataUrl({ pixelRatio: 0.18 })
      } catch {
        return ''
      }
    }
  }
}

function formatLocalFileTime(file: LocalFile) {
  const date = new Date(file.updatedAt)
  return Number.isNaN(date.getTime())
    ? ''
    : `保存于 ${date.toLocaleString('zh-CN', { hour12: false })}`
}

function normalizeFileName(name: unknown) {
  return String(name ?? '').trim()
}

function formatOptionalBytes(bytes: number | null) {
  return bytes === null ? '不可用' : formatBytes(bytes)
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const digits = unitIndex === 0 || value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}
