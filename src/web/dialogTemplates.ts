import { getBrowserDocument } from './browser.js'

interface DialogActionOptions {
  id?: string
  label: string
  type?: 'button' | 'submit'
  value?: string
}

interface EditorDialogOptions {
  id: string
  title: string
  titleId?: string
  compact?: boolean
  closeButtonId?: string
  body: Node[]
  actions?: DialogActionOptions[]
}

interface NameDialogOptions {
  id: string
  title: string
  titleId?: string
  closeButtonId: string
  label: string
  inputId: string
  errorId: string
  actions: DialogActionOptions[]
}

export function mountEditorDialogTemplates() {
  const document = getBrowserDocument()
  const mount = document.querySelector('#editor-dialog-root') ?? document.body
  mountDialogOnce(mount, createLocalBoardNameDialog())
  mountDialogOnce(mount, createPresetNameDialog())
  mountDialogOnce(mount, createImportDialog())
  mountDialogOnce(mount, createExportCodeDialog())
  mountDialogOnce(mount, createExportImageDialog())
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

function createNameDialog(options: NameDialogOptions) {
  const document = getBrowserDocument()
  const field = document.createElement('label')
  field.className = 'field'
  const label = document.createElement('span')
  label.textContent = options.label
  const input = document.createElement('input')
  input.id = options.inputId
  input.maxLength = 48
  const error = document.createElement('span')
  error.id = options.errorId
  error.className = 'field-error'
  error.setAttribute('aria-live', 'polite')
  field.append(label, input, error)

  return createEditorDialog({
    id: options.id,
    title: options.title,
    titleId: options.titleId,
    compact: true,
    closeButtonId: options.closeButtonId,
    body: [field],
    actions: options.actions,
  })
}

function createTextareaField({
  id,
  label,
  readonly = false,
}: {
  id: string
  label: string
  readonly?: boolean
}) {
  const document = getBrowserDocument()
  const field = document.createElement('label')
  field.className = 'field'
  const labelElement = document.createElement('span')
  labelElement.textContent = label
  const textarea = document.createElement('textarea')
  textarea.id = id
  textarea.spellcheck = false
  textarea.readOnly = readonly
  field.append(labelElement, textarea)
  return field
}

function createEditorDialog({
  id,
  title,
  titleId,
  compact = false,
  closeButtonId,
  body,
  actions = [],
}: EditorDialogOptions) {
  const document = getBrowserDocument()
  const dialog = document.createElement('dialog')
  dialog.id = id
  dialog.className = compact ? 'editor-dialog compact-dialog' : 'editor-dialog'

  const form = document.createElement('form')
  form.method = 'dialog'
  form.className = 'dialog-panel'
  form.append(
    createDialogHeader({
      closeButtonId,
      title,
      titleId,
    }),
    ...body,
  )

  if (actions.length > 0) {
    form.append(createDialogActions(actions))
  }
  dialog.append(form)
  return dialog
}

function createDialogHeader({
  closeButtonId,
  title,
  titleId,
}: Pick<EditorDialogOptions, 'closeButtonId' | 'title' | 'titleId'>) {
  const document = getBrowserDocument()
  const header = document.createElement('header')
  header.className = 'dialog-header'
  const heading = document.createElement('h2')
  if (titleId) {
    heading.id = titleId
  }
  heading.textContent = title
  const closeButton = document.createElement('button')
  closeButton.type = 'submit'
  closeButton.value = 'cancel'
  closeButton.className = 'icon-button'
  closeButton.setAttribute('aria-label', '关闭')
  if (closeButtonId) {
    closeButton.id = closeButtonId
  }
  closeButton.textContent = 'x'
  header.append(heading, closeButton)
  return header
}

function createDialogActions(actions: DialogActionOptions[]) {
  const document = getBrowserDocument()
  const footer = document.createElement('footer')
  footer.className = 'dialog-actions'
  for (const action of actions) {
    const button = document.createElement('button')
    button.type = action.type ?? 'submit'
    if (action.id) {
      button.id = action.id
    }
    if (action.value) {
      button.value = action.value
    }
    button.textContent = action.label
    footer.append(button)
  }
  return footer
}

function mountDialogOnce(mount: Element, dialog: HTMLDialogElement) {
  if (getBrowserDocument().getElementById(dialog.id)) {
    return
  }
  mount.append(dialog)
}
