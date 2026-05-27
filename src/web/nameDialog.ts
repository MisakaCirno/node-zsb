interface NameDialogElements {
  dialog: DialogElement
  input: InputElement
  error: TextElement
  title?: TextElement | null
}

interface NameDialogOptions {
  elements: NameDialogElements
  normalizeName?: (name: unknown) => string
}

export interface NameDialogRequest {
  currentName: string
  title?: string
  initialError?: string
  validate?: ((name: string) => string) | null
}

interface DialogElement {
  returnValue: string
  showModal(): void
  addEventListener(type: 'close', listener: () => void): void
  querySelector(selector: 'form'): FormElement
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
  focus(): void
  select(): void
  setAttribute(name: string, value: string): void
  addEventListener(type: 'input', listener: () => void): void
}

interface TextElement {
  textContent: string | null
}

interface PendingNameRequest {
  resolve(name: string): void
  validate?: ((name: string) => string) | null
}

export function createNameDialogController({
  elements,
  normalizeName = defaultNormalizeName,
}: NameDialogOptions) {
  let pendingRequest: PendingNameRequest | null = null

  elements.dialog.querySelector('form').addEventListener('submit', (event) => {
    if (!pendingRequest) return
    if (event.submitter?.value === 'cancel') return
    const error = validatePendingName()
    if (!error) return
    event.preventDefault()
    showNameError(error)
  })

  elements.input.addEventListener('input', () => {
    if (!pendingRequest) return
    showNameError(validatePendingName())
  })

  elements.dialog.addEventListener('close', () => {
    if (!pendingRequest) return
    const name = elements.dialog.returnValue === 'confirm'
      ? normalizeName(elements.input.value)
      : ''
    pendingRequest.resolve(name)
    pendingRequest = null
    showNameError('')
  })

  function requestName({
    currentName,
    title,
    initialError = '',
    validate = null,
  }: NameDialogRequest) {
    return new Promise<string>((resolve) => {
      pendingRequest = { resolve, validate }
      if (title && elements.title) {
        elements.title.textContent = title
      }
      elements.input.value = currentName
      showNameError(initialError)
      elements.dialog.showModal()
      elements.input.focus()
      elements.input.select()
    })
  }

  function validatePendingName() {
    return pendingRequest?.validate?.(normalizeName(elements.input.value)) ?? ''
  }

  function showNameError(message: string) {
    elements.error.textContent = message
    elements.input.setAttribute('aria-invalid', message ? 'true' : 'false')
  }

  return {
    requestName,
  }
}

function defaultNormalizeName(name: unknown) {
  return String(name ?? '').trim()
}
