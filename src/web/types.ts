export interface BoardObject {
  type: string
  x: number
  y: number
  editorId?: string
  size?: number
  color?: string
  transparency?: number
  text?: string
  endX?: number
  endY?: number
  angle?: number
  width?: number
  height?: number
  arcAngle?: number
  donutRadius?: number
  hidden?: boolean
  locked?: boolean
  [key: string]: unknown
}

export interface Board {
  name?: string
  boardBackground?: string
  objects: BoardObject[]
}

export interface NormalizedBoard {
  name: string
  boardBackground: string
  objects: BoardObject[]
}

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

export interface RectLike {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface IconConfig {
  src: string
  crop: Required<RectLike>
  size: number
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

export type LayerFlag = 'hidden' | 'locked'

export type Alignment =
  | 'left'
  | 'center-x'
  | 'right'
  | 'top'
  | 'center-y'
  | 'bottom'

export interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface ObjectCommands {
  addObject(type: string): void
  addObjectAt(type: string, point: { x: number, y: number }): void
  alignSelected(alignment: Alignment): void
  clearBoard(): void
  copySelected(): void
  deleteSelected(): void
  duplicateSelected(): void
  getLastLayerIndex(): number
  groupSelected(): void
  moveLayerNodeAfter(dragged: LayerNodeRef, target: LayerNodeRef): void
  moveLayerNodeBefore(dragged: LayerNodeRef, target: LayerNodeRef): void
  moveLayerNodeIntoGroup(dragged: LayerNodeRef, groupId: string): void
  moveLayerNodeToRoot(dragged: LayerNodeRef): void
  moveSelected(delta: number): void
  moveSelectedTo(target: number): void
  nudgeSelected(key: string, step: number): void
  pasteObject(): void
  renameLayerGroup(groupId: string, name: string): void
  reorderLayer(fromIndex: number, toIndex: number): void
  toggleLayerFlag(index: number, key: LayerFlag): void
  toggleLayerFlagForSelection?: (key: LayerFlag) => void
  toggleLayerGroup(groupId: string): void
  toggleLayerGroupFlag(groupId: string, key: LayerFlag): void
  toggleSelectedLayerFlag(key: LayerFlag): void
  ungroupSelectedGroup(): void
}

export interface InspectorControls {
  renderInspector(): void
  updateSelectedFromInspector(): void
  updateSelectionActions(): void
}

export interface BoardCodeActions {
  copyExportCode(): Promise<void>
  copyExportImage(): Promise<void>
  downloadPreviewImage(): void
  exportCode(): Promise<string>
  loadFromCode(code: string, options?: { record?: boolean }): Promise<void>
  renderPreview(): Promise<string>
}

export interface ProjectFileActions {
  downloadProjectFile(): void
  importProjectFile(file?: FileLike | null): Promise<boolean>
}

export interface BoardMetaControls {
  onBackgroundChange(background?: string): void
  onBoardNameChange(): void
  renderBackgroundOptions(): void
  syncBoardNameInput(): void
}

export interface LocalBoardsPanel {
  deleteLocalBoard(fileName: string): boolean
  deleteSelectedLocalBoards(): boolean
  loadLocalBoard(fileName: string): Promise<boolean>
  newLocalBoard(): Promise<boolean>
  renderLocalBoards(): void
  renameLocalBoard(fileName: string): Promise<boolean>
  saveLocalBoard(): Promise<boolean>
  saveLocalBoardAs(): Promise<boolean>
  updateLocalBoardButtons(): void
}

export interface EditorHistoryControls {
  redo(): void
  undo(): void
}

export interface EditorActionRegistry {
  applyFitZoom: ViewportControls['applyFitZoom']
  applyFitZoomOnResize: ViewportControls['applyFitZoomOnResize']
  addObjectAt: ObjectCommands['addObjectAt']
  alignSelected: ObjectCommands['alignSelected']
  clearBoard: ObjectCommands['clearBoard']
  copyExportCode: BoardCodeActions['copyExportCode']
  copyExportImage: BoardCodeActions['copyExportImage']
  copySelected: ObjectCommands['copySelected']
  deleteLocalBoard: LocalBoardsPanel['deleteLocalBoard']
  deleteSelectedLocalBoards: LocalBoardsPanel['deleteSelectedLocalBoards']
  deleteSelected: ObjectCommands['deleteSelected']
  deselect: EditorContext['deselect']
  downloadPreviewImage: BoardCodeActions['downloadPreviewImage']
  downloadProjectFile: ProjectFileActions['downloadProjectFile']
  duplicateSelected: ObjectCommands['duplicateSelected']
  exportCode: BoardCodeActions['exportCode']
  getLastLayerIndex: ObjectCommands['getLastLayerIndex']
  groupSelected: ObjectCommands['groupSelected']
  importProjectFile: ProjectFileActions['importProjectFile']
  loadFromCode: BoardCodeActions['loadFromCode']
  loadLocalBoard: LocalBoardsPanel['loadLocalBoard']
  moveLayerNodeAfter: ObjectCommands['moveLayerNodeAfter']
  moveLayerNodeBefore: ObjectCommands['moveLayerNodeBefore']
  moveLayerNodeIntoGroup: ObjectCommands['moveLayerNodeIntoGroup']
  moveLayerNodeToRoot: ObjectCommands['moveLayerNodeToRoot']
  moveSelected: ObjectCommands['moveSelected']
  moveSelectedTo: ObjectCommands['moveSelectedTo']
  newLocalBoard: LocalBoardsPanel['newLocalBoard']
  nudgeSelected: ObjectCommands['nudgeSelected']
  onBackgroundChange: BoardMetaControls['onBackgroundChange']
  onBoardNameChange: BoardMetaControls['onBoardNameChange']
  pasteObject: ObjectCommands['pasteObject']
  redo: EditorHistoryControls['redo']
  renderLocalBoards: LocalBoardsPanel['renderLocalBoards']
  renderPreview: BoardCodeActions['renderPreview']
  renameLayerGroup: ObjectCommands['renameLayerGroup']
  saveLocalBoard: LocalBoardsPanel['saveLocalBoard']
  saveLocalBoardAs: LocalBoardsPanel['saveLocalBoardAs']
  selectObject: EditorContext['selectObject']
  setGridDensity: ViewportControls['setGridDensity']
  setGridOpacity: ViewportControls['setGridOpacity']
  setStageZoom: ViewportControls['setStageZoom']
  stepZoom: ViewportControls['stepZoom']
  toggleGrid: ViewportControls['toggleGrid']
  toggleLayerFlagForSelection: NonNullable<ObjectCommands['toggleLayerFlagForSelection']>
  toggleLayerGroup: ObjectCommands['toggleLayerGroup']
  toggleLayerGroupFlag: ObjectCommands['toggleLayerGroupFlag']
  toggleSnapToGrid: ViewportControls['toggleSnapToGrid']
  undo: EditorHistoryControls['undo']
  ungroupSelectedGroup: ObjectCommands['ungroupSelectedGroup']
  updateLocalBoardButtons: LocalBoardsPanel['updateLocalBoardButtons']
  updateSelectedFromInspector: InspectorControls['updateSelectedFromInspector']
}

export interface FileLike {
  name?: string
  text(): Promise<string>
}

export interface BrowserClipboard {
  writeText(text: string): Promise<void>
  write?(items: unknown[]): Promise<void>
}

export interface BrowserWindow {
  ClipboardItem?: new (items: Record<string, Blob>) => unknown
  document: {
    body: { append(element: AnchorElement): void }
    createElement(tagName: 'a'): AnchorElement
  }
  history: {
    replaceState(data: unknown, unused: string, url?: string): void
  }
  location: {
    href: string
  }
  localStorage: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }
}

export interface AnchorElement {
  href: string
  download: string
  click(): void
  remove(): void
}

export interface ProjectBoardMeta {
  name: string
  boardBackground: string
}

export interface ProjectFile {
  format: 'node-zsb-project'
  version: number
  fileName: string
  board: ProjectBoardMeta
  objects: Record<string, BoardObject>
  layers: LayerNode[]
}

export interface LocalBoardSlot {
  id?: string
  name?: string
  board?: Board
  updatedAt?: string
  preview?: string
}

export interface LocalFile {
  name: string
  project: ProjectFile
  board: Board
  createdAt: string
  updatedAt: string
  preview: string
}

export interface CreateProjectOptions {
  fileName?: string
  layerTree?: LayerNode[]
}

export interface ObjectCapabilities {
  appearance: boolean
  text: boolean
  line: boolean
  arcAngle: boolean
  donutRadius: boolean
}
