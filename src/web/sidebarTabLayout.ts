declare const document: DocumentLike
declare const window: WindowLike
declare const ResizeObserver: ResizeObserverConstructor
declare const MutationObserver: MutationObserverConstructor

interface SidebarTabLayoutDeps {
  elements: {
    paletteTabs: TabListElement
    shell: TabListElement
  }
}

interface TabListElement {
  clientWidth: number
  scrollWidth: number
  classList: {
    remove(className: string): void
    toggle(className: string, force?: boolean): void
  }
}

interface DocumentLike {
  querySelector(selector: string): TabListElement | null
}

interface WindowLike {
  ResizeObserver?: ResizeObserverConstructor
  addEventListener(type: 'resize', listener: () => void): void
  requestAnimationFrame(callback: () => void): number
}

interface ResizeObserverConstructor {
  new(callback: () => void): {
    observe(element: TabListElement): void
  }
}

interface MutationObserverConstructor {
  new(callback: () => void): {
    observe(element: TabListElement, options: { childList?: boolean, subtree?: boolean }): void
  }
}

export function bindAdaptiveSidebarTabs({ elements }: SidebarTabLayoutDeps) {
  const tabLists = [
    document.querySelector('.sidebar-tabs'),
    elements.paletteTabs,
  ].filter((tabList): tabList is TabListElement => Boolean(tabList))
  const update = () => updateSidebarTabLayout(tabLists)
  const scheduleUpdate = () => window.requestAnimationFrame(update)

  scheduleUpdate()
  window.addEventListener('resize', scheduleUpdate)
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(elements.shell)
    tabLists.forEach((tabList) => resizeObserver.observe(tabList))
  }
  const mutationObserver = new MutationObserver(scheduleUpdate)
  tabLists.forEach((tabList) =>
    mutationObserver.observe(tabList, { childList: true, subtree: true }))
}

function updateSidebarTabLayout(tabLists: TabListElement[]) {
  for (const tabList of tabLists) {
    tabList.classList.remove('compact-tabs')
    const shouldCompact = tabList.scrollWidth > tabList.clientWidth + 1
    tabList.classList.toggle('compact-tabs', shouldCompact)
  }
}
