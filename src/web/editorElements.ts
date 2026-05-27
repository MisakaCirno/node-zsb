export interface EditorElements {
  codeInput: HTMLTextAreaElement
  codeOutput: HTMLTextAreaElement
  shell: HTMLElement
  leftPanelResizer: HTMLElement
  rightPanelResizer: HTMLElement
  fileMenuButton: HTMLButtonElement
  fileMenu: HTMLElement
  editMenuButton: HTMLButtonElement
  editMenu: HTMLElement
  openLocalBoardDialog: HTMLButtonElement
  newLocalBoard: HTMLButtonElement
  manageLocalBoards: HTMLButtonElement
  openImportDialog: HTMLButtonElement
  importProjectFile: HTMLButtonElement
  projectFileInput: HTMLInputElement
  openExportCodeDialog: HTMLButtonElement
  exportProjectFile: HTMLButtonElement
  openExportImageDialog: HTMLButtonElement
  localBoardDialog: HTMLDialogElement
  localBoardNameDialog: HTMLDialogElement
  importDialog: HTMLDialogElement
  exportCodeDialog: HTMLDialogElement
  exportImageDialog: HTMLDialogElement
  closeLocalBoardDialog: HTMLButtonElement
  closeLocalBoardNameDialog: HTMLButtonElement
  closeImportDialog: HTMLButtonElement
  closeExportCodeDialog: HTMLButtonElement
  closeExportImageDialog: HTMLButtonElement
  loadCode: HTMLButtonElement
  copyExportCode: HTMLButtonElement
  copyExportImage: HTMLButtonElement
  downloadPreviewImage: HTMLButtonElement
  background: HTMLElement
  assetTabBackground: HTMLButtonElement
  assetTabObjects: HTMLButtonElement
  assetTabPresets: HTMLButtonElement
  assetPanelBackground: HTMLElement
  assetPanelObjects: HTMLElement
  assetPanelPresets: HTMLElement
  localBoardList: HTMLElement
  localBoardNameInput: HTMLInputElement
  localBoardNameError: HTMLElement
  presetList: HTMLElement
  presetNameDialog: HTMLDialogElement
  presetNameInput: HTMLInputElement
  presetNameError: HTMLElement
  confirmLocalBoardName: HTMLButtonElement
  confirmPresetName: HTMLButtonElement
  selectAllLocalBoards: HTMLButtonElement
  clearSelectedLocalBoards: HTMLButtonElement
  deleteSelectedLocalBoards: HTMLButtonElement
  saveLocalBoard: HTMLButtonElement
  saveAsLocalBoard: HTMLButtonElement
  quickSaveLocalBoard: HTMLButtonElement
  quickSaveAsLocalBoard: HTMLButtonElement
  quickOpenImportDialog: HTMLButtonElement
  quickOpenExportCodeDialog: HTMLButtonElement
  fileName: HTMLInputElement
  boardName: HTMLInputElement
  paletteTabs: HTMLElement
  palette: HTMLElement
  layers: HTMLElement
  layerCount: HTMLElement
  stageHost: HTMLElement
  preview: HTMLImageElement
  status: HTMLElement
  contextMenu: HTMLElement
  undo: HTMLButtonElement
  redo: HTMLButtonElement
  clearBoard: HTMLButtonElement
  copyObject: HTMLButtonElement
  deleteObject: HTMLButtonElement
  duplicateObject: HTMLButtonElement
  pasteObject: HTMLButtonElement
  menuUndo: HTMLButtonElement
  menuRedo: HTMLButtonElement
  menuCopyObject: HTMLButtonElement
  menuPasteObject: HTMLButtonElement
  menuDuplicateObject: HTMLButtonElement
  menuDeleteObject: HTMLButtonElement
  menuClearBoard: HTMLButtonElement
  moveTop: HTMLButtonElement
  moveUp: HTMLButtonElement
  moveDown: HTMLButtonElement
  moveBottom: HTMLButtonElement
  groupLayers: HTMLButtonElement
  ungroupLayers: HTMLButtonElement
  savePreset: HTMLButtonElement
  savePresetFromLayers: HTMLButtonElement
  toolGroupLayers: HTMLButtonElement
  toolUngroupLayers: HTMLButtonElement
  alignLeft: HTMLButtonElement
  alignCenterX: HTMLButtonElement
  alignRight: HTMLButtonElement
  alignTop: HTMLButtonElement
  alignCenterY: HTMLButtonElement
  alignBottom: HTMLButtonElement
  zoomOut: HTMLButtonElement
  zoomSelect: HTMLInputElement
  zoomIn: HTMLButtonElement
  zoomValue: HTMLOutputElement
  fitStage: HTMLButtonElement
  snap: HTMLInputElement
  grid: HTMLInputElement
  gridDensity: HTMLInputElement
  gridDensityValue: HTMLOutputElement
  gridOpacity: HTMLInputElement
  gridOpacityValue: HTMLOutputElement
  emptyState: HTMLElement
  inspector: HTMLElement
  type: HTMLInputElement
  x: HTMLInputElement
  y: HTMLInputElement
  size: HTMLInputElement
  angle: HTMLInputElement
  color: HTMLInputElement
  colorTrigger: HTMLButtonElement
  colorPreview: HTMLElement
  colorPopover: HTMLElement
  colorSaturation: HTMLElement
  colorSaturationHandle: HTMLElement
  colorHue: HTMLInputElement
  colorText: HTMLInputElement
  colorSwatches: HTMLElement
  transparency: HTMLInputElement
  transparencyRange: HTMLInputElement
  text: HTMLInputElement
  objectWidth: HTMLInputElement
  objectWidthRange: HTMLInputElement
  objectHeight: HTMLInputElement
  objectHeightRange: HTMLInputElement
  endX: HTMLInputElement
  endY: HTMLInputElement
  arc: HTMLInputElement
  arcRange: HTMLInputElement
  donut: HTMLInputElement
  donutRange: HTMLInputElement
  hidden: HTMLInputElement
  locked: HTMLInputElement
}

type ElementConstructor<T extends Element> = {
  new (...args: never[]): T
}

export function getEditorElements(): EditorElements {
  return {
    codeInput: queryElement('#code-input', HTMLTextAreaElement),
    codeOutput: queryElement('#code-output', HTMLTextAreaElement),
    shell: queryElement('#editor-shell', HTMLElement),
    leftPanelResizer: queryElement('#left-panel-resizer', HTMLElement),
    rightPanelResizer: queryElement('#right-panel-resizer', HTMLElement),
    fileMenuButton: queryElement('#file-menu-button', HTMLButtonElement),
    fileMenu: queryElement('#file-menu', HTMLElement),
    editMenuButton: queryElement('#edit-menu-button', HTMLButtonElement),
    editMenu: queryElement('#edit-menu', HTMLElement),
    openLocalBoardDialog: queryElement('#open-local-board-dialog', HTMLButtonElement),
    newLocalBoard: queryElement('#new-local-board', HTMLButtonElement),
    manageLocalBoards: queryElement('#manage-local-boards', HTMLButtonElement),
    openImportDialog: queryElement('#open-import-dialog', HTMLButtonElement),
    importProjectFile: queryElement('#import-project-file', HTMLButtonElement),
    projectFileInput: queryElement('#project-file-input', HTMLInputElement),
    openExportCodeDialog: queryElement('#open-export-code-dialog', HTMLButtonElement),
    exportProjectFile: queryElement('#export-project-file', HTMLButtonElement),
    openExportImageDialog: queryElement('#open-export-image-dialog', HTMLButtonElement),
    localBoardDialog: queryElement('#local-board-dialog', HTMLDialogElement),
    localBoardNameDialog: queryElement('#local-board-name-dialog', HTMLDialogElement),
    importDialog: queryElement('#import-dialog', HTMLDialogElement),
    exportCodeDialog: queryElement('#export-code-dialog', HTMLDialogElement),
    exportImageDialog: queryElement('#export-image-dialog', HTMLDialogElement),
    closeLocalBoardDialog: queryElement('#close-local-board-dialog', HTMLButtonElement),
    closeLocalBoardNameDialog: queryElement('#close-local-board-name-dialog', HTMLButtonElement),
    closeImportDialog: queryElement('#close-import-dialog', HTMLButtonElement),
    closeExportCodeDialog: queryElement('#close-export-code-dialog', HTMLButtonElement),
    closeExportImageDialog: queryElement('#close-export-image-dialog', HTMLButtonElement),
    loadCode: queryElement('#load-code', HTMLButtonElement),
    copyExportCode: queryElement('#copy-export-code', HTMLButtonElement),
    copyExportImage: queryElement('#copy-export-image', HTMLButtonElement),
    downloadPreviewImage: queryElement('#download-preview-image', HTMLButtonElement),
    background: queryElement('#background-list', HTMLElement),
    assetTabBackground: queryElement('#asset-tab-background', HTMLButtonElement),
    assetTabObjects: queryElement('#asset-tab-objects', HTMLButtonElement),
    assetTabPresets: queryElement('#asset-tab-presets', HTMLButtonElement),
    assetPanelBackground: queryElement('#asset-panel-background', HTMLElement),
    assetPanelObjects: queryElement('#asset-panel-objects', HTMLElement),
    assetPanelPresets: queryElement('#asset-panel-presets', HTMLElement),
    localBoardList: queryElement('#local-board-list', HTMLElement),
    localBoardNameInput: queryElement('#local-board-name-input', HTMLInputElement),
    localBoardNameError: queryElement('#local-board-name-error', HTMLElement),
    presetList: queryElement('#preset-list', HTMLElement),
    presetNameDialog: queryElement('#preset-name-dialog', HTMLDialogElement),
    presetNameInput: queryElement('#preset-name-input', HTMLInputElement),
    presetNameError: queryElement('#preset-name-error', HTMLElement),
    confirmLocalBoardName: queryElement('#confirm-local-board-name', HTMLButtonElement),
    confirmPresetName: queryElement('#confirm-preset-name', HTMLButtonElement),
    selectAllLocalBoards: queryElement('#select-all-local-boards', HTMLButtonElement),
    clearSelectedLocalBoards: queryElement('#clear-selected-local-boards', HTMLButtonElement),
    deleteSelectedLocalBoards: queryElement('#delete-selected-local-boards', HTMLButtonElement),
    saveLocalBoard: queryElement('#save-local-board', HTMLButtonElement),
    saveAsLocalBoard: queryElement('#save-as-local-board', HTMLButtonElement),
    quickSaveLocalBoard: queryElement('#quick-save-local-board', HTMLButtonElement),
    quickSaveAsLocalBoard: queryElement('#quick-save-as-local-board', HTMLButtonElement),
    quickOpenImportDialog: queryElement('#quick-open-import-dialog', HTMLButtonElement),
    quickOpenExportCodeDialog: queryElement('#quick-open-export-code-dialog', HTMLButtonElement),
    fileName: queryElement('#file-name', HTMLInputElement),
    boardName: queryElement('#board-name', HTMLInputElement),
    paletteTabs: queryElement('#palette-tabs', HTMLElement),
    palette: queryElement('#palette', HTMLElement),
    layers: queryElement('#layers', HTMLElement),
    layerCount: queryElement('#layer-count', HTMLElement),
    stageHost: queryElement('#stage-host', HTMLElement),
    preview: queryElement('#preview-image', HTMLImageElement),
    status: queryElement('#status', HTMLElement),
    contextMenu: queryElement('#context-menu', HTMLElement),
    undo: queryElement('#undo-action', HTMLButtonElement),
    redo: queryElement('#redo-action', HTMLButtonElement),
    clearBoard: queryElement('#clear-board', HTMLButtonElement),
    copyObject: queryElement('#copy-object', HTMLButtonElement),
    deleteObject: queryElement('#delete-object', HTMLButtonElement),
    duplicateObject: queryElement('#duplicate-object', HTMLButtonElement),
    pasteObject: queryElement('#paste-object', HTMLButtonElement),
    menuUndo: queryElement('#menu-undo-action', HTMLButtonElement),
    menuRedo: queryElement('#menu-redo-action', HTMLButtonElement),
    menuCopyObject: queryElement('#menu-copy-object', HTMLButtonElement),
    menuPasteObject: queryElement('#menu-paste-object', HTMLButtonElement),
    menuDuplicateObject: queryElement('#menu-duplicate-object', HTMLButtonElement),
    menuDeleteObject: queryElement('#menu-delete-object', HTMLButtonElement),
    menuClearBoard: queryElement('#menu-clear-board', HTMLButtonElement),
    moveTop: queryElement('#move-top', HTMLButtonElement),
    moveUp: queryElement('#move-up', HTMLButtonElement),
    moveDown: queryElement('#move-down', HTMLButtonElement),
    moveBottom: queryElement('#move-bottom', HTMLButtonElement),
    groupLayers: queryElement('#group-layers', HTMLButtonElement),
    ungroupLayers: queryElement('#ungroup-layers', HTMLButtonElement),
    savePreset: queryElement('#save-preset', HTMLButtonElement),
    savePresetFromLayers: queryElement('#save-preset-from-layers', HTMLButtonElement),
    toolGroupLayers: queryElement('#tool-group-layers', HTMLButtonElement),
    toolUngroupLayers: queryElement('#tool-ungroup-layers', HTMLButtonElement),
    alignLeft: queryElement('#align-left', HTMLButtonElement),
    alignCenterX: queryElement('#align-center-x', HTMLButtonElement),
    alignRight: queryElement('#align-right', HTMLButtonElement),
    alignTop: queryElement('#align-top', HTMLButtonElement),
    alignCenterY: queryElement('#align-center-y', HTMLButtonElement),
    alignBottom: queryElement('#align-bottom', HTMLButtonElement),
    zoomOut: queryElement('#zoom-out', HTMLButtonElement),
    zoomSelect: queryElement('#zoom-select', HTMLInputElement),
    zoomIn: queryElement('#zoom-in', HTMLButtonElement),
    zoomValue: queryElement('#zoom-value', HTMLOutputElement),
    fitStage: queryElement('#fit-stage', HTMLButtonElement),
    snap: queryElement('#snap-toggle', HTMLInputElement),
    grid: queryElement('#grid-toggle', HTMLInputElement),
    gridDensity: queryElement('#grid-density', HTMLInputElement),
    gridDensityValue: queryElement('#grid-density-value', HTMLOutputElement),
    gridOpacity: queryElement('#grid-opacity', HTMLInputElement),
    gridOpacityValue: queryElement('#grid-opacity-value', HTMLOutputElement),
    emptyState: queryElement('#empty-state', HTMLElement),
    inspector: queryElement('#inspector-form', HTMLElement),
    type: queryElement('#object-type', HTMLInputElement),
    x: queryElement('#object-x', HTMLInputElement),
    y: queryElement('#object-y', HTMLInputElement),
    size: queryElement('#object-size', HTMLInputElement),
    angle: queryElement('#object-angle', HTMLInputElement),
    color: queryElement('#object-color', HTMLInputElement),
    colorTrigger: queryElement('#object-color-trigger', HTMLButtonElement),
    colorPreview: queryElement('#object-color-preview', HTMLElement),
    colorPopover: queryElement('#object-color-popover', HTMLElement),
    colorSaturation: queryElement('#object-color-saturation', HTMLElement),
    colorSaturationHandle: queryElement('#object-color-saturation-handle', HTMLElement),
    colorHue: queryElement('#object-color-hue', HTMLInputElement),
    colorText: queryElement('#object-color-text', HTMLInputElement),
    colorSwatches: queryElement('#object-color-swatches', HTMLElement),
    transparency: queryElement('#object-transparency', HTMLInputElement),
    transparencyRange: queryElement('#object-transparency-range', HTMLInputElement),
    text: queryElement('#object-text', HTMLInputElement),
    objectWidth: queryElement('#object-width', HTMLInputElement),
    objectWidthRange: queryElement('#object-width-range', HTMLInputElement),
    objectHeight: queryElement('#object-height', HTMLInputElement),
    objectHeightRange: queryElement('#object-height-range', HTMLInputElement),
    endX: queryElement('#object-end-x', HTMLInputElement),
    endY: queryElement('#object-end-y', HTMLInputElement),
    arc: queryElement('#object-arc', HTMLInputElement),
    arcRange: queryElement('#object-arc-range', HTMLInputElement),
    donut: queryElement('#object-donut', HTMLInputElement),
    donutRange: queryElement('#object-donut-range', HTMLInputElement),
    hidden: queryElement('#object-hidden', HTMLInputElement),
    locked: queryElement('#object-locked', HTMLInputElement),
  }
}

function queryElement<T extends Element>(
  selector: string,
  constructor: ElementConstructor<T>,
): T {
  const element = document.querySelector(selector)
  if (!(element instanceof constructor)) {
    throw new Error(`Missing editor element: ${selector}`)
  }
  return element
}
