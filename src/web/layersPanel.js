import { createObjectPreview } from './iconPreview.js'
import { getSelectedIndexes } from './editorState.js'

export function renderLayers({
  state,
  elements,
  onReorderLayer,
  onRenameLayerGroup,
  onMoveLayerNodeAfter,
  onMoveLayerNodeBefore,
  onMoveLayerNodeIntoGroup,
  onMoveLayerNodeToRoot,
  onSelectGroup,
  onSelectObject,
  onToggleLayerGroup,
  onToggleLayerGroupFlag,
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
  const objectIndexById = new Map(state.board.objects.map((object, index) => [object.editorId, index]))
  let primaryRow = null
  const layerTree = state.layerTree?.length
    ? state.layerTree
    : state.board.objects.map((object) => ({ type: 'object', id: object.editorId }))
  bindRootLayerDropTarget()
  for (const node of layerTree) {
    renderLayerNode(node, 0)
  }
  if (primaryRow && state.revealSelectedLayer) {
    state.revealSelectedLayer = false
    requestAnimationFrame(() => {
      primaryRow.scrollIntoView({
        block: 'nearest',
      })
    })
  }

  function renderLayerNode(node, depth) {
    if (node.type === 'group') {
      renderGroupRow(node, depth)
      if (!node.collapsed) {
        for (const child of node.children ?? []) {
          renderLayerNode(child, depth + 1)
        }
      }
      return
    }
    const index = objectIndexById.get(node.id)
    if (index === undefined) return
    renderObjectRow(state.board.objects[index], index, depth)
  }

  function renderGroupRow(group, depth) {
    const row = document.createElement('div')
    row.className = 'layer-row layer-group-row'
    row.draggable = true
    row.dataset.groupId = group.id
    row.style.setProperty('--layer-depth', String(depth))
    row.classList.toggle('active', state.selectedGroupId === group.id)
    row.classList.toggle('muted', Boolean(group.hidden))
    const toggle = document.createElement('button')
    toggle.className = 'layer-group-toggle'
    toggle.type = 'button'
    toggle.title = group.collapsed ? '展开组' : '折叠组'
    toggle.setAttribute('aria-label', toggle.title)
    toggle.innerHTML = group.collapsed ? chevronRightIcon() : chevronDownIcon()
    toggle.addEventListener('click', (event) => {
      event.stopPropagation()
      onToggleLayerGroup(group.id)
    })
    const name = createLayerText('layer-name', group.name ?? '组')
    name.title = '双击重命名'
    let selectTimer = 0
    name.addEventListener('click', (event) => {
      event.stopPropagation()
      window.clearTimeout(selectTimer)
      selectTimer = window.setTimeout(() => {
        onSelectGroup(group.id)
      }, 180)
    })
    name.addEventListener('dblclick', (event) => {
      event.stopPropagation()
      window.clearTimeout(selectTimer)
      startGroupRename(name, group, onRenameLayerGroup)
    })
    row.append(
      toggle,
      createLayerToggle({
        action: 'hidden',
        active: Boolean(group.hidden),
        offLabel: '隐藏组',
        offIcon: eyeIcon(),
        onLabel: '显示组',
        onIcon: eyeOffIcon(),
      }),
      createLayerToggle({
        action: 'locked',
        active: Boolean(group.locked),
        offLabel: '锁定组',
        offIcon: unlockIcon(),
        onLabel: '解锁组',
        onIcon: lockIcon(),
      }),
      createGroupIcon(),
      name,
      createLayerText('layer-position', `${countLayerObjects(group.children)} 个对象`),
    )
    row.querySelector('[data-action="hidden"]').addEventListener('click', (event) => {
      event.stopPropagation()
      onToggleLayerGroupFlag(group.id, 'hidden')
    })
    row.querySelector('[data-action="locked"]').addEventListener('click', (event) => {
      event.stopPropagation()
      onToggleLayerGroupFlag(group.id, 'locked')
    })
    bindLayerDrag({
      node: { type: 'group', id: group.id },
      onDropAfter: onMoveLayerNodeAfter,
      onDropBefore: onMoveLayerNodeBefore,
      onDropIntoGroup: onMoveLayerNodeIntoGroup,
      row,
      targetNode: { type: 'group', id: group.id },
    })
    row.addEventListener('click', () => onSelectGroup(group.id))
    elements.layers.append(row)
  }

  function bindRootLayerDropTarget() {
    elements.layers.ondragenter = (event) => {
      if (!isLayerRootDropEvent(event, elements.layers)) return
      event.preventDefault()
      elements.layers.classList.add('root-drop-target')
    }
    elements.layers.ondragover = (event) => {
      if (!isLayerRootDropEvent(event, elements.layers)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      elements.layers.classList.add('root-drop-target')
    }
    elements.layers.ondragleave = (event) => {
      if (elements.layers.contains(event.relatedTarget)) return
      elements.layers.classList.remove('root-drop-target')
    }
    elements.layers.ondrop = (event) => {
      if (!isLayerRootDropEvent(event, elements.layers)) return
      const dragged = getDraggedLayerNode(event)
      if (!dragged) return
      event.preventDefault()
      elements.layers.classList.remove('root-drop-target')
      const selectedGroup = state.selectedGroupId && state.selectedGroupId !== dragged.id
        ? { type: 'group', id: state.selectedGroupId }
        : null
      onMoveLayerNodeToRoot(selectedGroup ?? dragged)
    }
  }

  function renderObjectRow(object, index, depth) {
    const row = document.createElement('div')
    row.className = 'layer-row'
    row.draggable = true
    row.dataset.index = String(index)
    row.style.setProperty('--layer-depth', String(depth))
    row.classList.toggle('active', selectedIndexes.includes(index))
    row.classList.toggle('primary', index === state.selectedIndex)
    if (index === state.selectedIndex) primaryRow = row
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
    row.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
      event.dataTransfer.setData(
        'application/x-node-zsb-layer',
        JSON.stringify({ type: 'object', id: object.editorId }),
      )
      row.classList.add('dragging')
    })
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging')
    })
    row.addEventListener('dragover', (event) => {
      if (!hasLayerDragData(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropPlacementClass(row, getLayerDropPlacement(event, row, { type: 'object' }))
    })
    row.addEventListener('dragleave', () => {
      clearLayerDropClasses(row)
    })
    row.addEventListener('drop', (event) => {
      event.preventDefault()
      clearLayerDropClasses(row)
      const dragged = getDraggedLayerNode(event)
      if (dragged) {
        const placement = getLayerDropPlacement(event, row, { type: 'object' })
        const target = { type: 'object', id: object.editorId }
        if (placement === 'after') {
          onMoveLayerNodeAfter(dragged, target)
          return
        }
        onMoveLayerNodeBefore(dragged, target)
        return
      }
      const fromIndex = Number(event.dataTransfer.getData('text/plain'))
      onReorderLayer(fromIndex, index)
    })
    row.addEventListener('click', (event) => onSelectObject(index, {
      range: event.shiftKey,
      toggle: event.ctrlKey || event.metaKey,
    }))
    elements.layers.append(row)
  }
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

function bindLayerDrag({
  node,
  onDropAfter,
  onDropBefore,
  onDropIntoGroup,
  row,
  targetNode,
}) {
  row.addEventListener('dragstart', (event) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-node-zsb-layer', JSON.stringify(node))
    row.classList.add('dragging')
  })
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging')
  })
  row.addEventListener('dragover', (event) => {
    if (!hasLayerDragData(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropPlacementClass(row, getLayerDropPlacement(event, row, targetNode))
  })
  row.addEventListener('dragleave', () => {
    clearLayerDropClasses(row)
  })
  row.addEventListener('drop', (event) => {
    const dragged = getDraggedLayerNode(event)
    if (!dragged) return
    event.preventDefault()
    clearLayerDropClasses(row)
    const placement = getLayerDropPlacement(event, row, targetNode)
    if (placement === 'inside' && targetNode.type === 'group') {
      onDropIntoGroup(dragged, targetNode.id)
      return
    }
    if (placement === 'after') {
      onDropAfter(dragged, targetNode)
      return
    }
    onDropBefore(dragged, targetNode)
  })
}

function getLayerDropPlacement(event, row, targetNode) {
  const rect = row.getBoundingClientRect()
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5
  if (targetNode.type === 'group') {
    if (ratio < 0.25) return 'before'
    if (ratio > 0.75) return 'after'
    return 'inside'
  }
  return ratio < 0.5 ? 'before' : 'after'
}

function setDropPlacementClass(row, placement) {
  clearLayerDropClasses(row)
  row.classList.add(`drop-${placement}`)
}

function clearLayerDropClasses(row) {
  row.classList.remove('drop-before', 'drop-after', 'drop-inside')
}

function isLayerRootDropEvent(event, root) {
  return event.target === root && hasLayerDragData(event)
}

function hasLayerDragData(event) {
  return Array.from(event.dataTransfer.types).includes('application/x-node-zsb-layer')
}

function getDraggedLayerNode(event) {
  try {
    const raw = event.dataTransfer.getData('application/x-node-zsb-layer')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function startGroupRename(nameElement, group, onRenameLayerGroup) {
  const input = document.createElement('input')
  input.className = 'layer-name-input'
  input.maxLength = 32
  input.value = group.name ?? '组'
  nameElement.replaceWith(input)
  input.focus()
  input.select()

  function commit() {
    const name = input.value.trim()
    if (!name || name === group.name) {
      input.replaceWith(nameElement)
      return
    }
    onRenameLayerGroup(group.id, name)
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      input.replaceWith(nameElement)
    }
  })
  input.addEventListener('blur', commit)
}

function countLayerObjects(nodes = []) {
  return nodes.reduce((count, node) => {
    if (node.type === 'object') return count + 1
    if (node.type === 'group') return count + countLayerObjects(node.children)
    return count
  }, 0)
}

function createGroupIcon() {
  const span = document.createElement('span')
  span.className = 'layer-group-icon'
  span.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 3h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/></svg>'
  return span
}

function chevronRightIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
}

function chevronDownIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
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
