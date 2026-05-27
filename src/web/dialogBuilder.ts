import { getBrowserDocument } from './browser.js'

export interface DialogActionOptions {
  className?: string
  disabled?: boolean
  id?: string
  label: string
  type?: 'button' | 'submit'
  value?: string
}

export interface EditorDialogOptions {
  id: string
  title: string
  titleId?: string
  compact?: boolean
  closeButtonId?: string
  body: Node[]
  actions?: DialogActionOptions[]
}

export interface NameDialogOptions {
  id: string
  title: string
  titleId?: string
  closeButtonId: string
  label: string
  inputId: string
  errorId: string
  actions: DialogActionOptions[]
}

export function createNameDialog(options: NameDialogOptions) {
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

export function createTextareaField({
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

export function createEditorDialog({
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

export function createButton({
  className,
  disabled = false,
  id,
  label,
  type = 'submit',
  value,
}: DialogActionOptions) {
  const document = getBrowserDocument()
  const button = document.createElement('button')
  button.type = type
  button.disabled = disabled
  if (className) {
    button.className = className
  }
  if (id) {
    button.id = id
  }
  if (value) {
    button.value = value
  }
  button.textContent = label
  return button
}

export function mountDialogOnce(mount: Element, dialog: HTMLDialogElement) {
  if (getBrowserDocument().getElementById(dialog.id)) {
    return
  }
  mount.append(dialog)
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
    footer.append(createButton(action))
  }
  return footer
}
