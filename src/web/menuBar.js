export function bindMenuBar(elements) {
  const triggers = getMenuTriggers()
  const menus = getMenus()

  for (const trigger of triggers) {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation()
      if (isMenuOpen(trigger, elements)) {
        closeAllMenus(elements)
        return
      }
      openMenu(trigger, elements)
    })
    trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown') return
      event.preventDefault()
      openMenu(trigger, elements)
      focusFirstMenuItem(getControlledMenu(trigger))
    })
  }

  for (const menu of menus) {
    menu.addEventListener('click', (event) => {
      const button = event.target.closest('button')
      if (button && !button.disabled) closeAllMenus(elements)
    })
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllMenus(elements)
        getOpenTrigger(elements)?.focus()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      focusMenuItem(menu, event.key)
    })
  }

  document.addEventListener('click', (event) => {
    const clickedMenu = menus.some((menu) => menu.contains(event.target))
    const clickedTrigger = triggers.some((trigger) => trigger.contains(event.target))
    if (!clickedMenu && !clickedTrigger) closeAllMenus(elements)
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllMenus(elements)
  })
  window.addEventListener('resize', () => {
    const trigger = getOpenTrigger(elements)
    if (trigger) positionMenu(trigger)
  })
}

function getMenuTriggers() {
  return [...document.querySelectorAll('[data-menu-target]')]
}

function getMenus() {
  return getMenuTriggers()
    .map((trigger) => getControlledMenu(trigger))
    .filter(Boolean)
}

function openMenu(trigger, elements) {
  closeAllMenus(elements)
  const menu = getControlledMenu(trigger)
  if (!menu) return
  menu.classList.remove('hidden')
  trigger.setAttribute('aria-expanded', 'true')
  positionMenu(trigger)
}

function closeAllMenus(elements) {
  for (const trigger of getMenuTriggers()) {
    trigger.setAttribute('aria-expanded', 'false')
  }
  for (const menu of getMenus()) {
    menu.classList.add('hidden')
  }
}

function isMenuOpen(trigger) {
  return !getControlledMenu(trigger)?.classList.contains('hidden')
}

function getControlledMenu(trigger) {
  return document.querySelector(`#${trigger.dataset.menuTarget}`)
}

function getOpenTrigger() {
  return getMenuTriggers().find((trigger) => isMenuOpen(trigger))
}

function positionMenu(trigger) {
  const menu = getControlledMenu(trigger)
  if (!menu) return
  const rect = trigger.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const left = Math.min(rect.left, window.innerWidth - menuRect.width - 8)
  const top = Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 8)
  menu.style.left = `${Math.max(8, left)}px`
  menu.style.top = `${Math.max(8, top)}px`
}

function focusFirstMenuItem(menu) {
  menu?.querySelector('.file-menu-item:not(:disabled)')?.focus()
}

function focusMenuItem(menu, key) {
  const items = [...menu.querySelectorAll('.file-menu-item:not(:disabled)')]
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
