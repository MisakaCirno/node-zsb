import type {
  Alignment,
} from './board.js'
import type {
  EditorContext,
  ViewportControls,
} from './editor.js'
import type {
  LayerFlag,
  LayerNodeRef,
} from './layers.js'
import type {
  FileLike,
} from './project.js'

export type RunEditorAction = (
  action: () => unknown | Promise<unknown>,
  successMessage?: string,
  options?: { busyMessage?: string },
) => Promise<void>

export interface ObjectCommands {
  addObject(type: string): boolean
  addObjectAt(type: string, point: { x: number, y: number }): boolean
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
  finishInspectorEdit(): void
  renderInspector(): void
  updateSelectedFromInspector(options?: { continuous?: boolean }): void
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
  confirmDocumentReplacement(actionLabel: string): Promise<boolean>
  deleteLocalBoard(fileName: string): Promise<boolean>
  deleteSelectedLocalBoards(): Promise<boolean>
  loadLocalBoard(fileName: string): Promise<boolean>
  newLocalBoard(): Promise<boolean>
  onFileNameInput(): void
  renderLocalBoards(): void
  renameLocalBoard(fileName: string): Promise<boolean>
  saveLocalBoard(): Promise<boolean>
  saveLocalBoardAs(): Promise<boolean>
  updateLocalBoardButtons(): void
}

export interface LocalPresetsPanel {
  deletePreset(id: string): Promise<boolean>
  insertPresetAt(id: string, point?: { x: number, y: number }): Promise<boolean>
  renamePreset(id: string): Promise<boolean>
  renderLocalPresets(): void
  saveSelectedPreset(): Promise<boolean>
  updatePresetButtons(): void
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
  finishInspectorEdit: InspectorControls['finishInspectorEdit']
  getLastLayerIndex: ObjectCommands['getLastLayerIndex']
  groupSelected: ObjectCommands['groupSelected']
  importProjectFile: ProjectFileActions['importProjectFile']
  loadFromCode: BoardCodeActions['loadFromCode']
  loadLocalBoard: LocalBoardsPanel['loadLocalBoard']
  deletePreset: LocalPresetsPanel['deletePreset']
  insertPresetAt: LocalPresetsPanel['insertPresetAt']
  renamePreset: LocalPresetsPanel['renamePreset']
  moveLayerNodeAfter: ObjectCommands['moveLayerNodeAfter']
  moveLayerNodeBefore: ObjectCommands['moveLayerNodeBefore']
  moveLayerNodeIntoGroup: ObjectCommands['moveLayerNodeIntoGroup']
  moveLayerNodeToRoot: ObjectCommands['moveLayerNodeToRoot']
  moveSelected: ObjectCommands['moveSelected']
  moveSelectedTo: ObjectCommands['moveSelectedTo']
  newLocalBoard: LocalBoardsPanel['newLocalBoard']
  onFileNameInput: LocalBoardsPanel['onFileNameInput']
  nudgeSelected: ObjectCommands['nudgeSelected']
  onBackgroundChange: BoardMetaControls['onBackgroundChange']
  onBoardNameChange: BoardMetaControls['onBoardNameChange']
  pasteObject: ObjectCommands['pasteObject']
  redo: EditorHistoryControls['redo']
  renderLocalBoards: LocalBoardsPanel['renderLocalBoards']
  renderLocalPresets: LocalPresetsPanel['renderLocalPresets']
  renderPreview: BoardCodeActions['renderPreview']
  renameLayerGroup: ObjectCommands['renameLayerGroup']
  saveLocalBoard: LocalBoardsPanel['saveLocalBoard']
  saveLocalBoardAs: LocalBoardsPanel['saveLocalBoardAs']
  saveSelectedPreset: LocalPresetsPanel['saveSelectedPreset']
  selectLayerGroup: EditorContext['selectLayerGroup']
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
  updatePresetButtons: LocalPresetsPanel['updatePresetButtons']
  updateSelectedFromInspector: InspectorControls['updateSelectedFromInspector']
}
