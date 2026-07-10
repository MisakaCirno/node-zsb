import { MAX_TEXT_LENGTH } from './constants.js'
import type { TextElement } from './types.js'

export interface TextInputElements {
  text: HTMLTextAreaElement
  textCount: TextElement
}

export function normalizeObjectText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, MAX_TEXT_LENGTH)
}

export function bindTextInput(
  elements: TextInputElements,
  onChange: () => void,
  onCommit: () => void = () => {},
): void {
  syncTextInput(elements)
  elements.text.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    elements.text.blur()
  })
  elements.text.addEventListener('input', () => {
    const normalized = normalizeObjectText(elements.text.value)
    if (elements.text.value !== normalized) {
      elements.text.value = normalized
    }
    syncTextInput(elements)
    onChange()
  })
  elements.text.addEventListener('blur', onCommit)
}

export function syncTextInput(elements: TextInputElements, value = elements.text.value): void {
  const normalized = normalizeObjectText(value)
  elements.text.value = normalized
  elements.textCount.textContent = `${normalized.length}/${MAX_TEXT_LENGTH}`
  resizeTextInput(elements.text)
}

function resizeTextInput(input: HTMLTextAreaElement): void {
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight}px`
}
