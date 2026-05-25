export function renderLayers({
  state,
  elements,
  onSelectObject,
  onToggleLayerFlag,
}) {
  elements.layers.innerHTML = ''
  elements.layerCount.textContent = String(state.board.objects.length)
  if (state.board.objects.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'layer-empty'
    empty.textContent = '暂无对象'
    elements.layers.append(empty)
    return
  }
  state.board.objects.forEach((object, index) => {
    const row = document.createElement('div')
    row.className = 'layer-row'
    row.classList.toggle('active', index === state.selectedIndex)
    row.classList.toggle('muted', Boolean(object.hidden))
    row.innerHTML = `
      <button class="layer-toggle" type="button" data-action="hidden" title="${object.hidden ? '显示' : '隐藏'}">${object.hidden ? '隐' : '显'}</button>
      <button class="layer-toggle" type="button" data-action="locked" title="${object.locked ? '解锁' : '锁定'}">${object.locked ? '锁' : '开'}</button>
      <span class="layer-name">${index + 1}. ${object.type}</span>
      <span class="layer-position">${Math.round(object.x)}, ${Math.round(object.y)}</span>
    `
    row.querySelector('[data-action="hidden"]').addEventListener('click', (event) => {
      event.stopPropagation()
      onToggleLayerFlag(index, 'hidden')
    })
    row.querySelector('[data-action="locked"]').addEventListener('click', (event) => {
      event.stopPropagation()
      onToggleLayerFlag(index, 'locked')
    })
    row.addEventListener('click', () => onSelectObject(index))
    elements.layers.append(row)
  })
}
