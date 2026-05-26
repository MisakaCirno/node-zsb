export function createLayerTreeFromBoard(board) {
  return (board.objects ?? []).map((object) => ({
    type: 'object',
    id: object.editorId,
  })).filter((node) => Boolean(node.id))
}

export function syncFlatLayerTree(state) {
  state.layerTree = createLayerTreeFromBoard(state.board)
}

