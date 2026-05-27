export interface ObjectLayerNode {
  type: 'object'
  id: string
}

export interface GroupLayerNode {
  type: 'group'
  id: string
  name: string
  collapsed?: boolean
  hidden?: boolean
  locked?: boolean
  children: LayerNode[]
}

export type LayerNode = ObjectLayerNode | GroupLayerNode

export type LayerNodeRef = Pick<LayerNode, 'type' | 'id'>

export type LayerFlag = 'hidden' | 'locked'
