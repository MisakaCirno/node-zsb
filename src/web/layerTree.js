export function createLayerTreeFromBoard(board) {
  return (board.objects ?? []).map((object) => ({
    type: 'object',
    id: object.editorId,
  })).filter((node) => Boolean(node.id))
}

export function syncFlatLayerTree(state) {
  state.layerTree = createLayerTreeFromBoard(state.board)
}

export function appendObjectLayerNode(layerTree, objectId) {
  if (!objectId) return
  layerTree.push({
    type: 'object',
    id: objectId,
  })
}

export function removeObjectLayerNodes(layerTree, objectIds) {
  const ids = new Set(objectIds)
  removeObjectNodes(layerTree, ids)
}

export function hasLayerGroups(layerTree) {
  return (layerTree ?? []).some((node) =>
    node.type === 'group' || hasLayerGroups(node.children))
}

export function getGroupObjectIds(layerTree, groupId) {
  const group = findGroup(layerTree, groupId)
  return group ? collectObjectIds(group.children) : []
}

export function renameGroup(layerTree, groupId, name) {
  const group = findGroup(layerTree, groupId)
  if (!group) return false
  const normalizedName = String(name ?? '').trim()
  if (!normalizedName || normalizedName === group.name) return false
  group.name = normalizedName
  return true
}

export function toggleGroupFlag(layerTree, groupId, key) {
  const group = findGroup(layerTree, groupId)
  if (!group || !['hidden', 'locked'].includes(key)) return null
  group[key] = group[key] ? undefined : true
  return {
    active: Boolean(group[key]),
    objectIds: collectObjectIds(group.children),
  }
}

export function toggleGroupCollapsed(layerTree, groupId) {
  const group = findGroup(layerTree, groupId)
  if (!group) return false
  group.collapsed = !group.collapsed
  return true
}

export function groupObjectIds(layerTree, objectIds, name = '组') {
  const selectedIds = new Set(objectIds)
  if (selectedIds.size < 2) return null
  const parentInfo = findSharedParent(layerTree, selectedIds)
  const parent = parentInfo?.parent ?? layerTree
  const selectedIndexes = parent
    .map((node, index) => node.type === 'object' && selectedIds.has(node.id) ? index : -1)
    .filter((index) => index >= 0)
  if (selectedIndexes.length !== selectedIds.size) {
    return groupAcrossTree(layerTree, selectedIds, name)
  }
  const firstIndex = Math.min(...selectedIndexes)
  const groupedNodes = selectedIndexes.map((index) => parent[index])
  for (const index of [...selectedIndexes].sort((a, b) => b - a)) {
    parent.splice(index, 1)
  }
  const group = createGroupNode(name, groupedNodes)
  parent.splice(firstIndex, 0, group)
  return group
}

export function ungroupLayer(layerTree, groupId) {
  const parentInfo = findGroupParent(layerTree, groupId)
  if (!parentInfo) return false
  const { parent, index, group } = parentInfo
  parent.splice(index, 1, ...(group.children ?? []))
  return true
}

export function moveLayerNodeBefore(layerTree, dragged, target) {
  if (!dragged?.id || !target?.id || dragged.id === target.id) return false
  if (dragged.type === 'group' && containsGroup(layerTree, dragged.id, target.id)) return false
  const removed = removeLayerNode(layerTree, dragged)
  if (!removed) return false
  const targetInfo = findLayerNodeParent(layerTree, target)
  if (!targetInfo) {
    layerTree.push(removed)
    return false
  }
  targetInfo.parent.splice(targetInfo.index, 0, removed)
  return true
}

export function moveLayerNodeAfter(layerTree, dragged, target) {
  if (!dragged?.id || !target?.id || dragged.id === target.id) return false
  if (dragged.type === 'group' && containsGroup(layerTree, dragged.id, target.id)) return false
  const removed = removeLayerNode(layerTree, dragged)
  if (!removed) return false
  const targetInfo = findLayerNodeParent(layerTree, target)
  if (!targetInfo) {
    layerTree.push(removed)
    return false
  }
  targetInfo.parent.splice(targetInfo.index + 1, 0, removed)
  return true
}

export function moveLayerNodeIntoGroup(layerTree, dragged, groupId) {
  if (!dragged?.id || !groupId || dragged.id === groupId) return false
  if (dragged.type === 'group' && containsGroup(layerTree, dragged.id, groupId)) return false
  const removed = removeLayerNode(layerTree, dragged)
  if (!removed) return false
  const group = findGroup(layerTree, groupId)
  if (!group) {
    layerTree.push(removed)
    return false
  }
  group.children = group.children ?? []
  group.children.push(removed)
  group.collapsed = false
  return true
}

export function moveLayerNodeToRoot(layerTree, dragged) {
  if (!dragged?.id) return false
  const removed = removeLayerNode(layerTree, dragged)
  if (!removed) return false
  layerTree.push(removed)
  return true
}

export function syncBoardOrderFromLayerTree(state) {
  const selectedIds = (state.selectedIndexes ?? [])
    .map((index) => state.board.objects[index]?.editorId)
    .filter(Boolean)
  const order = collectObjectIds(state.layerTree)
  const objectById = new Map(state.board.objects.map((object) => [object.editorId, object]))
  const ordered = order.map((id) => objectById.get(id)).filter(Boolean)
  const usedIds = new Set(ordered.map((object) => object.editorId))
  const orphans = state.board.objects.filter((object) => !usedIds.has(object.editorId))
  state.board.objects = [...ordered, ...orphans]
  const indexById = new Map(state.board.objects.map((object, index) => [object.editorId, index]))
  state.selectedIndexes = selectedIds
    .map((id) => indexById.get(id))
    .filter((index) => index !== undefined)
  state.selectedIndex = state.selectedIndexes.at(-1) ?? -1
}

function containsGroup(layerTree, groupId, targetGroupId) {
  const group = findGroup(layerTree, groupId)
  if (!group) return false
  return Boolean(findGroup(group.children ?? [], targetGroupId))
}

function removeLayerNode(layerTree, target) {
  const info = findLayerNodeParent(layerTree, target)
  if (!info) return null
  const [node] = info.parent.splice(info.index, 1)
  return node
}

function findLayerNodeParent(nodes, target, parent = nodes) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.type === target.type && node.id === target.id) {
      return { parent, index, node }
    }
    if (node.type === 'group') {
      const result = findLayerNodeParent(node.children ?? [], target, node.children)
      if (result) return result
    }
  }
  return null
}

function groupAcrossTree(layerTree, selectedIds, name) {
  const orderedNodes = []
  removeSelectedObjectNodes(layerTree, selectedIds, orderedNodes)
  if (orderedNodes.length < 2) return null
  const group = createGroupNode(name, orderedNodes)
  layerTree.unshift(group)
  return group
}

function removeSelectedObjectNodes(nodes, selectedIds, removed) {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node.type === 'object' && selectedIds.has(node.id)) {
      removed.unshift(...nodes.splice(index, 1))
      continue
    }
    if (node.type === 'group') {
      removeSelectedObjectNodes(node.children ?? [], selectedIds, removed)
    }
  }
}

function removeObjectNodes(nodes, objectIds) {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node.type === 'object' && objectIds.has(node.id)) {
      nodes.splice(index, 1)
      continue
    }
    if (node.type === 'group') {
      removeObjectNodes(node.children ?? [], objectIds)
      if ((node.children ?? []).length === 0) {
        nodes.splice(index, 1)
      }
    }
  }
}

function findSharedParent(nodes, selectedIds, parent = nodes) {
  const directMatches = nodes.filter((node) => node.type === 'object' && selectedIds.has(node.id))
  if (directMatches.length === selectedIds.size) {
    return { parent }
  }
  for (const node of nodes) {
    if (node.type !== 'group') continue
    const result = findSharedParent(node.children ?? [], selectedIds, node.children)
    if (result) return result
  }
  return null
}

function findGroup(nodes, groupId) {
  const info = findGroupParent(nodes, groupId)
  return info?.group ?? null
}

function findGroupParent(nodes, groupId, parent = nodes) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.type === 'group' && node.id === groupId) {
      return { parent, index, group: node }
    }
    if (node.type === 'group') {
      const result = findGroupParent(node.children ?? [], groupId, node.children)
      if (result) return result
    }
  }
  return null
}

function collectObjectIds(nodes = []) {
  const ids = []
  for (const node of nodes) {
    if (node.type === 'object') {
      ids.push(node.id)
      continue
    }
    if (node.type === 'group') {
      ids.push(...collectObjectIds(node.children ?? []))
    }
  }
  return ids
}

function createGroupNode(name, children) {
  return {
    type: 'group',
    id: createGroupId(),
    name,
    collapsed: false,
    children,
  }
}

function createGroupId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `grp_${Date.now().toString(36)}_${random}`
}
