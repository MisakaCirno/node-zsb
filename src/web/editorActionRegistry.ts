import type {
  BoardCodeActions,
  BoardMetaControls,
  EditorActionRegistry,
  EditorContext,
  EditorHistoryControls,
  InspectorControls,
  LocalBoardsPanel,
  LocalPresetsPanel,
  ObjectCommands,
  ProjectFileActions,
  ViewportControls,
} from './types.js'

interface EditorActionRegistryDeps {
  boardCodeActions: BoardCodeActions
  boardMetaControls: BoardMetaControls
  editorContext: EditorContext
  historyControls: EditorHistoryControls
  inspectorControls: InspectorControls
  localBoardsPanel: LocalBoardsPanel
  localPresetsPanel: LocalPresetsPanel
  objectCommands: ObjectCommands
  projectFileActions: ProjectFileActions
  viewportControls: ViewportControls
}

export function createEditorActionRegistry({
  boardCodeActions,
  boardMetaControls,
  editorContext,
  historyControls,
  inspectorControls,
  localBoardsPanel,
  localPresetsPanel,
  objectCommands,
  projectFileActions,
  viewportControls,
}: EditorActionRegistryDeps): EditorActionRegistry {
  return {
    applyFitZoom: viewportControls.applyFitZoom,
    applyFitZoomOnResize: viewportControls.applyFitZoomOnResize,
    addObjectAt: objectCommands.addObjectAt,
    alignSelected: objectCommands.alignSelected,
    clearBoard: objectCommands.clearBoard,
    copySelected: objectCommands.copySelected,
    copyExportCode: boardCodeActions.copyExportCode,
    copyExportImage: boardCodeActions.copyExportImage,
    deleteLocalBoard: localBoardsPanel.deleteLocalBoard,
    deleteSelectedLocalBoards: localBoardsPanel.deleteSelectedLocalBoards,
    deleteSelected: objectCommands.deleteSelected,
    deselect: editorContext.deselect,
    duplicateSelected: objectCommands.duplicateSelected,
    downloadPreviewImage: boardCodeActions.downloadPreviewImage,
    downloadProjectFile: projectFileActions.downloadProjectFile,
    exportCode: boardCodeActions.exportCode,
    importProjectFile: projectFileActions.importProjectFile,
    loadFromCode: boardCodeActions.loadFromCode,
    loadLocalBoard: localBoardsPanel.loadLocalBoard,
    deletePreset: localPresetsPanel.deletePreset,
    insertPresetAt: localPresetsPanel.insertPresetAt,
    newLocalBoard: localBoardsPanel.newLocalBoard,
    onFileNameInput: localBoardsPanel.onFileNameInput,
    getLastLayerIndex: objectCommands.getLastLayerIndex,
    groupSelected: objectCommands.groupSelected,
    moveLayerNodeAfter: objectCommands.moveLayerNodeAfter,
    moveLayerNodeBefore: objectCommands.moveLayerNodeBefore,
    moveLayerNodeIntoGroup: objectCommands.moveLayerNodeIntoGroup,
    moveLayerNodeToRoot: objectCommands.moveLayerNodeToRoot,
    ungroupSelectedGroup: objectCommands.ungroupSelectedGroup,
    toggleLayerGroup: objectCommands.toggleLayerGroup,
    toggleLayerGroupFlag: objectCommands.toggleLayerGroupFlag,
    renameLayerGroup: objectCommands.renameLayerGroup,
    moveSelected: objectCommands.moveSelected,
    moveSelectedTo: objectCommands.moveSelectedTo,
    nudgeSelected: objectCommands.nudgeSelected,
    onBackgroundChange: boardMetaControls.onBackgroundChange,
    onBoardNameChange: boardMetaControls.onBoardNameChange,
    pasteObject: objectCommands.pasteObject,
    redo: historyControls.redo,
    renderLocalBoards: localBoardsPanel.renderLocalBoards,
    renderLocalPresets: localPresetsPanel.renderLocalPresets,
    renderPreview: boardCodeActions.renderPreview,
    saveLocalBoard: localBoardsPanel.saveLocalBoard,
    saveLocalBoardAs: localBoardsPanel.saveLocalBoardAs,
    saveSelectedPreset: localPresetsPanel.saveSelectedPreset,
    selectLayerGroup: editorContext.selectLayerGroup,
    selectObject: editorContext.selectObject,
    setGridDensity: viewportControls.setGridDensity,
    setGridOpacity: viewportControls.setGridOpacity,
    setStageZoom: viewportControls.setStageZoom,
    stepZoom: viewportControls.stepZoom,
    toggleGrid: viewportControls.toggleGrid,
    toggleLayerFlagForSelection: objectCommands.toggleSelectedLayerFlag,
    toggleSnapToGrid: viewportControls.toggleSnapToGrid,
    undo: historyControls.undo,
    updateLocalBoardButtons: localBoardsPanel.updateLocalBoardButtons,
    updatePresetButtons: localPresetsPanel.updatePresetButtons,
    updateSelectedFromInspector: inspectorControls.updateSelectedFromInspector,
  }
}
