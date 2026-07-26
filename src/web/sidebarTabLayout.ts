interface SidebarTabLayoutDeps {
  elements: {
    shell: HTMLElement
  }
}

export function bindAdaptiveSidebarTabs({ elements }: SidebarTabLayoutDeps) {
  const tabLists = [document.querySelector<HTMLElement>('.sidebar-tabs')]
    .filter((tabList): tabList is HTMLElement => Boolean(tabList))
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

function updateSidebarTabLayout(tabLists: HTMLElement[]) {
  for (const tabList of tabLists) {
    tabList.classList.remove('compact-tabs')
    const shouldCompact = tabList.scrollWidth > tabList.clientWidth + 1
    tabList.classList.toggle('compact-tabs', shouldCompact)
  }
}
