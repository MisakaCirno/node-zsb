import { getBrowserDocument } from './browser.js'

interface DialogActionOptions {
  id?: string
  label: string
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
    button.type = 'submit'
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
