export function bindAdaptiveSidebarTabs({ elements }) {
  const tabLists = [
    document.querySelector('.sidebar-tabs'),
    elements.paletteTabs,
  ].filter(Boolean)
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

function updateSidebarTabLayout(tabLists) {
  for (const tabList of tabLists) {
    tabList.classList.remove('compact-tabs')
    const shouldCompact = tabList.scrollWidth > tabList.clientWidth + 1
    tabList.classList.toggle('compact-tabs', shouldCompact)
  }
}
