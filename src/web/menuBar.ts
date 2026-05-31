type MenuKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

export function bindMenuBar() {
  const triggers = getMenuTriggers()
  const menus = getMenus()

  for (const trigger of triggers) {
    trigger.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation()
      if (isMenuOpen(trigger)) {
        closeAllMenus()
        return
      }
      openMenu(trigger)
    })
    trigger.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown') return
      event.preventDefault()
      openMenu(trigger)
      focusFirstMenuItem(getControlledMenu(trigger))
    })
  }

  for (const menu of menus) {
    menu.addEventListener('click', (event: MouseEvent) => {
      const button = getClosestElement(event.target, 'button')
      if (button && !button.disabled) closeAllMenus()
    })
    menu.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAllMenus()
        getOpenTrigger()?.focus()
        return
      }
      if (!isMenuKey(event.key)) return
      event.preventDefault()
      focusMenuItem(menu, event.key)
    })
  }

  document.addEventListener('click', (event: MouseEvent) => {
    if (!(event.target instanceof Node)) return
    const clickedMenu = menus.some((menu) => menu.contains(event.target as Node))
    const clickedTrigger = triggers.some((trigger) => trigger.contains(event.target as Node))
    if (!clickedMenu && !clickedTrigger) closeAllMenus()
  })
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeAllMenus()
  })
  window.addEventListener('resize', () => {
    const trigger = getOpenTrigger()
    if (trigger) positionMenu(trigger)
  })
}

function getMenuTriggers(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-menu-target]')]
}

function getMenus(): HTMLElement[] {
  return getMenuTriggers()
    .map((trigger) => getControlledMenu(trigger))
    .filter((menu): menu is HTMLElement => Boolean(menu))
}

function openMenu(trigger: HTMLElement) {
  closeAllMenus()
  const menu = getControlledMenu(trigger)
  if (!menu) return
  menu.classList.remove('hidden')
  trigger.setAttribute('aria-expanded', 'true')
  positionMenu(trigger)
}

function closeAllMenus() {
  for (const trigger of getMenuTriggers()) {
    trigger.setAttribute('aria-expanded', 'false')
  }
  for (const menu of getMenus()) {
    menu.classList.add('hidden')
  }
}

function isMenuOpen(trigger: HTMLElement) {
  return !getControlledMenu(trigger)?.classList.contains('hidden')
}

function getControlledMenu(trigger: HTMLElement): HTMLElement | null {
  const target = trigger.dataset.menuTarget
  return target ? document.querySelector<HTMLElement>(`#${target}`) : null
}

function getOpenTrigger() {
  return getMenuTriggers().find((trigger) => isMenuOpen(trigger))
}

function positionMenu(trigger: HTMLElement) {
  const menu = getControlledMenu(trigger)
  if (!menu) return
  const rect = trigger.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const left = Math.min(rect.left, window.innerWidth - menuRect.width - 8)
  const top = Math.min(rect.bottom + 6, window.innerHeight - menuRect.height - 8)
  menu.style.left = `${Math.max(8, left)}px`
  menu.style.top = `${Math.max(8, top)}px`
}

function focusFirstMenuItem(menu: HTMLElement | null) {
  menu?.querySelector<HTMLElement>('.file-menu-item:not(:disabled)')?.focus()
}

function focusMenuItem(menu: HTMLElement, key: MenuKey) {
  const items = [...menu.querySelectorAll<HTMLElement>('.file-menu-item:not(:disabled)')]
  if (items.length === 0) return
  const currentElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  const currentIndex = currentElement ? items.indexOf(currentElement) : -1
  if (key === 'Home') {
    items[0]?.focus()
    return
  }
  if (key === 'End') {
    items.at(-1)?.focus()
    return
  }
  const delta = key === 'ArrowUp' ? -1 : 1
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + delta + items.length) % items.length
  items[nextIndex]?.focus()
}

function isMenuKey(key: string): key is MenuKey {
  return ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)
}

function getClosestElement(target: EventTarget | null, selector: string): HTMLButtonElement | null {
  const element = target instanceof Element ? target.closest(selector) : null
  return element instanceof HTMLButtonElement ? element : null
}
