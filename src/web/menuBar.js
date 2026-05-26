export function bindMenuBar(elements) {
  elements.fileMenuButton.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isFileMenuOpen(elements)) {
      closeFileMenu(elements)
      return
    }
    openFileMenu(elements)
  })
  elements.fileMenuButton.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    openFileMenu(elements)
    focusFirstFileMenuItem(elements)
  })
  elements.fileMenu.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (button && !button.disabled) closeFileMenu(elements)
  })
  elements.fileMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeFileMenu(elements)
      elements.fileMenuButton.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    focusFileMenuItem(elements, event.key)
  })
  document.addEventListener('click', (event) => {
    if (
      !elements.fileMenu.contains(event.target)
      && !elements.fileMenuButton.contains(event.target)
    ) {
      closeFileMenu(elements)
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeFileMenu(elements)
  })
  window.addEventListener('resize', () => {
    if (isFileMenuOpen(elements)) positionFileMenu(elements)
  })
}

function openFileMenu(elements) {
  elements.fileMenu.classList.remove('hidden')
  elements.fileMenuButton.setAttribute('aria-expanded', 'true')
  positionFileMenu(elements)
}

function closeFileMenu(elements) {
  elements.fileMenu.classList.add('hidden')
  elements.fileMenuButton.setAttribute('aria-expanded', 'false')
}

function isFileMenuOpen(elements) {
  return !elements.fileMenu.classList.contains('hidden')
}

function positionFileMenu(elements) {
  const rect = elements.fileMenuButton.getBoundingClientRect()
  const menuRect = elements.fileMenu.getBoundingClientRect()
  const left = Math.min(rect.left, window.innerWidth - menuRect.width - 8)
  const top = Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 8)
  elements.fileMenu.style.left = `${Math.max(8, left)}px`
  elements.fileMenu.style.top = `${Math.max(8, top)}px`
}

function focusFirstFileMenuItem(elements) {
  elements.fileMenu.querySelector('.file-menu-item:not(:disabled)')?.focus()
}

function focusFileMenuItem(elements, key) {
  const items = [...elements.fileMenu.querySelectorAll('.file-menu-item:not(:disabled)')]
  if (items.length === 0) return
  const currentIndex = items.indexOf(document.activeElement)
  if (key === 'Home') {
    items[0].focus()
    return
  }
  if (key === 'End') {
    items.at(-1).focus()
    return
  }
  const delta = key === 'ArrowUp' ? -1 : 1
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + delta + items.length) % items.length
  items[nextIndex].focus()
}
