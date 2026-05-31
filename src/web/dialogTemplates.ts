import { getBrowserDocument } from './browser.js'
import {
  createButton,
  createEditorDialog,
  createNameDialog,
  createTextareaField,
  mountDialogOnce,
} from './dialogBuilder.js'

export function mountEditorDialogTemplates() {
  const document = getBrowserDocument()
  const mount = document.querySelector('#editor-dialog-root') ?? document.body
  for (const createDialog of EDITOR_DIALOG_TEMPLATES) {
    mountDialogOnce(mount, createDialog())
  }
}

const EDITOR_DIALOG_TEMPLATES = [
  createLocalBoardDialog,
  createLocalStorageDetailsDialog,
  createLocalBoardNameDialog,
  createPresetNameDialog,
  createImportDialog,
  createExportCodeDialog,
  createExportImageDialog,
]

function createLocalBoardDialog() {
  const document = getBrowserDocument()
  const storageSummary = document.createElement('section')
  storageSummary.id = 'local-storage-summary'
  storageSummary.className = 'local-storage-summary'
  storageSummary.setAttribute('aria-label', '本地存储空间')
  storageSummary.textContent = '正在统计存储空间...'

  const bulkActions = document.createElement('div')
  bulkActions.className = 'local-board-bulk-actions'
  bulkActions.append(
    createButton({
      id: 'select-all-local-boards',
      label: '全选',
      type: 'button',
      disabled: true,
    }),
    createButton({
      id: 'clear-selected-local-boards',
      label: '全不选',
      type: 'button',
      disabled: true,
    }),
    createButton({
      className: 'danger-button',
      id: 'delete-selected-local-boards',
      label: '删除所选',
      type: 'button',
      disabled: true,
    }),
  )

  const list = document.createElement('div')
  list.id = 'local-board-list'
  list.className = 'local-board-list'
  list.setAttribute('aria-label', '本地文件列表')

  const storageDivider = document.createElement('hr')
  storageDivider.className = 'local-storage-divider'
  storageDivider.setAttribute('aria-hidden', 'true')

  return createEditorDialog({
    id: 'local-board-dialog',
    title: '本地文件',
    closeButtonId: 'close-local-board-dialog',
    body: [bulkActions, list, storageDivider, storageSummary],
  })
}

function createLocalStorageDetailsDialog() {
  const document = getBrowserDocument()
  const details = document.createElement('section')
  details.id = 'local-storage-details'
  details.className = 'local-storage-details'
  details.setAttribute('aria-label', '本地存储空间详情')
  details.textContent = '正在统计存储空间...'

  return createEditorDialog({
    id: 'local-storage-details-dialog',
    title: '存储空间详情',
    closeButtonId: 'close-local-storage-details-dialog',
    body: [details],
  })
}

function createLocalBoardNameDialog() {
  return createNameDialog({
    id: 'local-board-name-dialog',
    title: '文件命名',
    titleId: 'local-board-name-title',
    closeButtonId: 'close-local-board-name-dialog',
    label: '文件名',
    inputId: 'local-board-name-input',
    errorId: 'local-board-name-error',
    actions: [
      {
        id: 'confirm-local-board-name',
        label: '确定',
        value: 'confirm',
      },
    ],
  })
}

function createPresetNameDialog() {
  return createNameDialog({
    id: 'preset-name-dialog',
    title: '保存预设',
    closeButtonId: 'close-preset-name-dialog',
    label: '预设名称',
    inputId: 'preset-name-input',
    errorId: 'preset-name-error',
    actions: [
      {
        label: '取消',
        value: 'cancel',
      },
      {
        id: 'confirm-preset-name',
        label: '保存',
        value: 'confirm',
      },
    ],
  })
}

function createImportDialog() {
  return createEditorDialog({
    id: 'import-dialog',
    title: '导入战术板代码',
    closeButtonId: 'close-import-dialog',
    body: [
      createTextareaField({
        id: 'code-input',
        label: '战术板代码',
      }),
    ],
    actions: [
      {
        id: 'load-code',
        label: '导入',
        type: 'button',
      },
    ],
  })
}

function createExportCodeDialog() {
  return createEditorDialog({
    id: 'export-code-dialog',
    title: '导出分享码',
    closeButtonId: 'close-export-code-dialog',
    body: [
      createTextareaField({
        id: 'code-output',
        label: '分享码',
        readonly: true,
      }),
    ],
    actions: [
      {
        id: 'copy-export-code',
        label: '复制分享码',
        type: 'button',
      },
    ],
  })
}

function createExportImageDialog() {
  const document = getBrowserDocument()
  const image = document.createElement('img')
  image.id = 'preview-image'
  image.alt = '战术板预览图'
  return createEditorDialog({
    id: 'export-image-dialog',
    title: '导出图片',
    closeButtonId: 'close-export-image-dialog',
    body: [image],
    actions: [
      {
        id: 'copy-export-image',
        label: '复制图片',
        type: 'button',
      },
      {
        id: 'download-preview-image',
        label: '下载图片',
        type: 'button',
      },
    ],
  })
}
