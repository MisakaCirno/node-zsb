import { createObjectPreview } from './iconPreview.js'
import { getSelectedIndexes } from './editorState.js'

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
  const selectedIndexes = getSelectedIndexes(state)
  state.board.objects.forEach((object, index) => {
    const row = document.createElement('div')
    row.className = 'layer-row'
    row.classList.toggle('active', selectedIndexes.includes(index))
    row.classList.toggle('primary', index === state.selectedIndex)
    row.classList.toggle('muted', Boolean(object.hidden))
    const preview = createObjectPreview({
      iconConfigs: state.iconConfigs,
      size: 24,
      type: object.type,
    })
    preview.classList.add('layer-preview')
    row.append(
      createLayerToggle({
        action: 'hidden',
        active: Boolean(object.hidden),
        offLabel: '隐藏',
        offIcon: eyeIcon(),
        onLabel: '显示',
        onIcon: eyeOffIcon(),
      }),
      createLayerToggle({
        action: 'locked',
        active: Boolean(object.locked),
        offLabel: '锁定',
        offIcon: unlockIcon(),
        onLabel: '解锁',
        onIcon: lockIcon(),
      }),
      preview,
      createLayerText('layer-name', `${index + 1}. ${object.type}`),
      createLayerText('layer-position', `${Math.round(object.x)}, ${Math.round(object.y)}`),
    )
    row.querySelector('[data-action="hidden"]').addEventListener('click', (event) => {
      event.stopPropagation()
      onToggleLayerFlag(index, 'hidden')
    })
    row.querySelector('[data-action="locked"]').addEventListener('click', (event) => {
      event.stopPropagation()
      onToggleLayerFlag(index, 'locked')
    })
    row.addEventListener('click', (event) => onSelectObject(index, {
      toggle: event.shiftKey || event.ctrlKey || event.metaKey,
    }))
    elements.layers.append(row)
  })
}

function createLayerToggle({
  action,
  active,
  offLabel,
  offIcon,
  onLabel,
  onIcon,
}) {
  const button = document.createElement('button')
  button.className = 'layer-toggle'
  button.type = 'button'
  button.dataset.action = action
  button.title = active ? onLabel : offLabel
  button.setAttribute('aria-label', active ? onLabel : offLabel)
  button.innerHTML = active ? onIcon : offIcon
  return button
}

function createLayerText(className, text) {
  const span = document.createElement('span')
  span.className = className
  span.textContent = text
  return span
}

function eyeIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>'
}

function eyeOffIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6a3 3 0 0 0 3.8 3.8"/><path d="M6.6 6.9C3.9 8.7 2.5 12 2.5 12s3.5 6 9.5 6c1.7 0 3.1-.4 4.3-1"/><path d="M12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.2 2.8"/></svg>'
}

function lockIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
}

function unlockIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/></svg>'
}
