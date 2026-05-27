import type {
  BoardObject,
  IconConfig,
  NormalizedBoard,
} from './board.js'
import type {
  LayerNode,
} from './layers.js'

export interface EditorStateSlice {
  board: NormalizedBoard
  layerTree: LayerNode[]
  selectedIndex: number
  selectedIndexes: number[]
}

export type ZoomMode = 'fit' | 'manual'

export interface EditorSettings {
  snapToGrid: boolean
  showGrid: boolean
  gridSize: number
  gridOpacity: number
  zoom: number
  zoomMode: ZoomMode
}

export interface EditorData {
  backgrounds: Record<string, string>
  defaultCode: string
  iconConfigs: Record<string, IconConfig>
  iconGroups: Record<string, string[]>
}

export interface EditorState extends EditorStateSlice {
  selectedGroupId: string
  currentFileName: string
  localFileSnapshot: string
  revealSelectedLayer: boolean
  iconConfigs: Record<string, IconConfig>
  iconGroups: Record<string, string[]>
  backgrounds: Record<string, string>
  activeGroup: string
  snapToGrid: boolean
  showGrid: boolean
  gridSize: number
  gridOpacity: number
  zoom: number
  zoomMode: ZoomMode
  images: Map<string, Promise<unknown>>
  history: HistorySnapshot[]
  future: HistorySnapshot[]
  clipboard: BoardObject | null
  actionRunning: boolean
  statusTimer: number
}

export interface HistorySnapshot extends EditorStateSlice {
  selectedGroupId: string
}

export interface SelectionOptions {
  range?: boolean
  revealInLayers?: boolean
  toggle?: boolean
  primaryIndex?: number
}

export interface EditorContext {
  deselect(): void
  getSelected(): BoardObject | undefined
  getSelectedList(): BoardObject[]
  getSnapStep(): number
  normalizeCoordinate(value: number, min: number, max: number): number
  normalizePoint(x: number, y: number): { x: number, y: number }
  selectObject(index: number, options?: SelectionOptions): void
  selectLayerGroup(groupId: string): void
  selectObjects(indexes: number[], options?: SelectionOptions): void
}

export interface StageZoomOptions {
  mode?: ZoomMode
  persist?: boolean
  render?: boolean
  silent?: boolean
}

export interface EditorElements {
  stageHost: LayoutElement
  zoomSelect: ValueElement
  zoomValue: TextElement
  zoomOut: DisabledElement
  zoomIn: DisabledElement
  gridDensity: ValueElement
  gridDensityValue: TextElement
  gridOpacity: ValueElement
  gridOpacityValue: TextElement
  snap: CheckedElement
  grid: CheckedElement
}

export interface LayoutElement {
  clientWidth: number
  clientHeight: number
  ownerDocument: {
    defaultView?: {
      getComputedStyle(element: LayoutElement): StyleDeclaration
    } | null
  }
}

export interface StyleDeclaration {
  paddingLeft: string
  paddingRight: string
  paddingTop: string
  paddingBottom: string
}

export interface ValueElement {
  value: string
}

export interface TextElement {
  textContent: string | null
}

export interface DisabledElement {
  disabled: boolean
}

export interface CheckedElement {
  checked: boolean
}

export interface StageLike {
  scale(value: { x: number, y: number }): void
  width(value: number): void
  height(value: number): void
  batchDraw(): void
}

export interface GridRenderer {
  renderGrid(): void
}

export interface ViewportControls {
  applyInitialZoom(options?: StageZoomOptions): void
  applyFitZoom(options?: StageZoomOptions): void
  applyFitZoomOnResize(): void
  setGridDensity(gridSize: number, options?: StageZoomOptions): void
  setGridOpacity(gridOpacity: number, options?: StageZoomOptions): void
  setStageZoom(zoom: number, options?: StageZoomOptions): void
  stepZoom(direction: number): void
  syncControlStateFromDom(): void
  toggleGrid(): void
  toggleSnapToGrid(): void
}
