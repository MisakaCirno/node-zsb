export function createLayerTreeFromBoard(board) {
  return (board.objects ?? []).map((object) => ({
    type: 'object',
    id: object.editorId,
  })).filter((node) => Boolean(node.id))
}

export function syncFlatLayerTree(state) {
  state.layerTree = createLayerTreeFromBoard(state.board)
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
