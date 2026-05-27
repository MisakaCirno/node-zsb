import { expect, test, type Dialog, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { MAX_BOARD_OBJECTS } from '../src/web/constants.js'

async function openImportDialog(page: Page) {
  await clickFileMenuAction(page, '#open-import-dialog')
  await expect(page.locator('#import-dialog')).toBeVisible()
  await expect(page.locator('#editor-dialog-root > #import-dialog')).toHaveCount(1)
}

async function openExportCodeDialog(page: Page) {
  await clickFileMenuAction(page, '#open-export-code-dialog')
  await expect(page.locator('#export-code-dialog')).toBeVisible()
  await expect(page.locator('#editor-dialog-root > #export-code-dialog')).toHaveCount(1)
}

async function openExportImageDialog(page: Page) {
  await clickFileMenuAction(page, '#open-export-image-dialog')
  await expect(page.locator('#export-image-dialog')).toBeVisible()
  await expect(page.locator('#editor-dialog-root > #export-image-dialog')).toHaveCount(1)
}

async function openLocalBoardDialog(page: Page) {
  await clickFileMenuAction(page, '#open-local-board-dialog')
  await expect(page.locator('#local-board-dialog')).toBeVisible()
  await expect(page.locator('#editor-dialog-root > #local-board-dialog')).toHaveCount(1)
}

async function openFileMenu(page: Page) {
  for (let attempt = 0; attempt < 2 && await page.locator('#file-menu').isHidden(); attempt += 1) {
    await page.locator('#file-menu-button').click()
  }
  await expect(page.locator('#file-menu')).toBeVisible()
}

async function clickFileMenuAction(page: Page, selector: string) {
  await openFileMenu(page)
  await page.locator(selector).click()
}

async function getGridCanvasStats(page: Page) {
  return page.evaluate(`(() => {
    const gridCanvas = document.querySelectorAll('#stage-host canvas')[1]
    const data = gridCanvas
      ?.getContext('2d')
      ?.getImageData(0, 0, gridCanvas.width, gridCanvas.height)
      .data
    if (!data) return null
    let visiblePixels = 0
    let alphaSum = 0
    let strongPixels = 0
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3]
      if (alpha > 0) {
        visiblePixels += 1
        alphaSum += alpha
      }
      if (alpha >= 64) {
        strongPixels += 1
      }
    }
    return {
      averageAlpha: alphaSum / visiblePixels,
      visiblePixels,
      strongPixels,
    }
  })()`) as Promise<{
    averageAlpha: number,
    strongPixels: number,
    visiblePixels: number,
  } | null>
}

async function countPresetPreviewCache(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<unknown | null>((resolve) => {
      const request = (globalThis as unknown as { indexedDB: {
        open(name: string): {
          onerror: (() => void) | null
          onsuccess: (() => void) | null
          result: unknown
        }
      } }).indexedDB.open('node-zsb-preview-cache')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    })
    if (!database) return 0
    return new Promise<number>((resolve) => {
      const request = (database as {
        transaction(storeName: string, mode: string): {
          objectStore(storeName: string): {
            count(): { onsuccess: (() => void) | null, onerror: (() => void) | null, result: number }
          }
        }
      })
        .transaction('preset-previews', 'readonly')
        .objectStore('preset-previews')
        .count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })
  })
}

async function exportBoardCode(page: Page) {
  await openExportCodeDialog(page)
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)
  return page.locator('#code-output').inputValue()
}

async function exportProjectFile(page: Page) {
  await openFileMenu(page)
  const downloadPromise = page.waitForEvent('download')
  await page.locator('#export-project-file').click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Project download path is unavailable')
  return JSON.parse(await readFile(path, 'utf8'))
}

async function dragLayerRowToVerticalZone(
  page: Page,
  sourceIndex: number,
  targetIndex: number,
  ratio: number,
) {
  const source = page.locator('#layers .layer-group-row').nth(sourceIndex)
  const target = page.locator('#layers .layer-group-row').nth(targetIndex)
  const box = await target.boundingBox()
  if (!box) throw new Error('Target layer row is not visible')
  await source.dragTo(target, {
    force: true,
    targetPosition: {
      x: Math.min(24, box.width / 2),
      y: box.height * ratio,
    },
  })
}

async function dragLayerIntoGroup(source: Locator, target: Locator) {
  const box = await target.boundingBox()
  if (!box) throw new Error('Target group row is not visible')
  await source.dragTo(target, {
    force: true,
    targetPosition: {
      x: Math.min(42, box.width / 2),
      y: box.height / 2,
    },
  })
}

test('editor loads, edits an object, exports code, and renders a preview', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/editor')

  await expect(page).toHaveTitle('战术板编辑器')
  await expect(page.locator('#stage-host canvas').first()).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '文件' })).toBeVisible()
  await openFileMenu(page)
  await expect(page.getByRole('menuitem', { name: '导出分享码' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '导出图片' })).toBeVisible()
  await page.keyboard.press('Escape')

  const canvas = page.locator('#stage-host canvas').first()
  await expect(canvas).toBeVisible()
  const before = await canvas.screenshot()
  expect(before.length).toBeGreaterThan(1_000)

  await page.getByTitle('tank').first().click()
  await expect(page.locator('#object-type')).toHaveValue('tank')

  await page.locator('#object-x').fill('260')
  await page.locator('#object-y').fill('196')
  await expect(page.locator('#layers')).toContainText('tank')

  await openExportCodeDialog(page)
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)
  await page.locator('#export-code-dialog').evaluate((dialog) => dialog.close())

  await openExportImageDialog(page)
  await expect(page.locator('#preview-image')).toBeVisible()
  await expect(page.locator('#preview-image')).toHaveAttribute(
    'src',
    /\/preview\/[a-f0-9]{64}\.webp/,
  )

  expect(consoleErrors).toEqual([])
})

test('editor creates an object by dragging from the palette to the canvas', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const target = {
    x: Math.round(box.width * 0.25),
    y: Math.round(box.height * 0.4),
  }

  await expect(page.getByTitle('tank').first()).toHaveAttribute('draggable', 'true')
  await page.getByTitle('tank').first().dragTo(canvas, {
    force: true,
    targetPosition: target,
  })

  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)
  await expect(page.locator('#object-type')).toHaveValue('tank')
  const objectX = Number(await page.locator('#object-x').inputValue())
  const objectY = Number(await page.locator('#object-y').inputValue())
  expect(Math.abs(objectX - Math.round((target.x / box.width) * 512))).toBeLessThanOrEqual(1)
  expect(Math.abs(objectY - Math.round((target.y / box.height) * 384))).toBeLessThanOrEqual(1)
})

test('editor exports and imports project JSON files', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('123')
  await page.locator('#object-y').fill('234')

  await openFileMenu(page)
  const downloadPromise = page.waitForEvent('download')
  await page.locator('#export-project-file').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.zsb\.json$/)
  const path = await download.path()
  if (!path) throw new Error('Project download path is unavailable')
  const project = JSON.parse(await readFile(path, 'utf8'))
  expect(project.format).toBe('node-zsb-project')
  expect(project.layers[0]).toMatchObject({ type: 'object' })
  expect(project.objects[project.layers[0].id].editorId).toBeUndefined()

  const importedProject = {
    format: 'node-zsb-project',
    version: 1,
    fileName: 'imported',
    board: {
      name: 'JSON',
      boardBackground: 'checkered',
    },
    objects: {
      obj_imported_text: {
        type: 'text',
        x: 111,
        y: 222,
        text: 'Project JSON',
        color: '#ffffff',
      },
    },
    layers: [
      {
        type: 'object',
        id: 'obj_imported_text',
      },
    ],
  }
  await page.locator('#project-file-input').setInputFiles({
    name: 'imported.zsb.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedProject)),
  })

  await expect(page.locator('#layers')).toContainText('text')
  await expect(page.locator('#file-name')).toHaveValue('imported')
  await expect(page.locator('#board-name')).toHaveValue('JSON')
})

test('editor groups selected layers and exports the group in project JSON', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(1).click({ modifiers: ['Shift'] })
  await expect(page.locator('#group-layers')).toBeEnabled()
  await page.locator('#group-layers').click()

  await expect(page.locator('#layers .layer-group-row')).toHaveCount(1)
  const groupRow = page.locator('#layers .layer-group-row')
  await groupRow.locator('.layer-name').click()
  await expect(groupRow).toHaveClass(/active/)
  await expect(page.locator('#ungroup-layers')).toBeEnabled()
  await groupRow.locator('.layer-name').dblclick()
  await groupRow.locator('.layer-name-input').fill('第一组')
  await page.keyboard.press('Enter')
  await expect(groupRow.locator('.layer-name')).toHaveText('第一组')

  await dragLayerIntoGroup(page.locator('#layers .layer-row').filter({ hasText: 'dps' }).first(), groupRow)
  await expect(groupRow.locator('.layer-position')).toHaveText('3 个对象')
  await page.getByTitle('tank').first().click()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(1)
  await expect(groupRow.locator('.layer-position')).toHaveText('3 个对象')

  await groupRow.locator('[data-action="hidden"]').click()
  await expect(groupRow).toHaveClass(/muted/)
  await expect(page.locator('#layers .layer-row').nth(1)).toHaveClass(/muted/)
  await groupRow.locator('[data-action="locked"]').click()
  await page.locator('#layers .layer-row').nth(1).click()
  await expect(page.locator('#object-x')).toBeDisabled()
  await groupRow.click()
  await expect(page.locator('#ungroup-layers')).toBeEnabled()
  await groupRow.locator('.layer-group-toggle').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(3)
  await groupRow.locator('.layer-group-toggle').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(6)

  await openFileMenu(page)
  const downloadPromise = page.waitForEvent('download')
  await page.locator('#export-project-file').click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Project download path is unavailable')
  const project = JSON.parse(await readFile(path, 'utf8'))
  expect(project.layers[0]).toMatchObject({
    type: 'group',
    name: '第一组',
    hidden: true,
    locked: true,
    children: [
      { type: 'object' },
      { type: 'object' },
      { type: 'object' },
    ],
  })

  await page.locator('#layers .layer-group-row').click()
  await page.locator('#ungroup-layers').click()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(0)
})

test('editor groups and ungroups layers from the left toolrail', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await expect(page.locator('#tool-group-layers')).toBeDisabled()
  await expect(page.locator('#tool-ungroup-layers')).toBeDisabled()
  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(1).click({ modifiers: ['Shift'] })
  await expect(page.locator('#tool-group-layers')).toBeEnabled()
  await page.locator('#tool-group-layers').click()

  const groupRow = page.locator('#layers .layer-group-row')
  await expect(groupRow).toHaveCount(1)
  await expect(groupRow).toHaveClass(/active/)
  await expect(page.locator('#tool-ungroup-layers')).toBeEnabled()
  await page.locator('#tool-ungroup-layers').click()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(0)
})

test('editor saves reusable presets and inserts them from the preset tab', async ({ page }) => {
  await page.goto('/editor')
  await page.evaluate(async () => {
    localStorage.removeItem('node-zsb-editor-local-presets-v1')
    await new Promise<void>((resolve) => {
      const request = (globalThis as unknown as { indexedDB: {
        deleteDatabase(name: string): {
          onblocked: (() => void) | null
          onerror: (() => void) | null
          onsuccess: (() => void) | null
        }
      } }).indexedDB.deleteDatabase('node-zsb-preview-cache')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })
  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(1).click({ modifiers: ['Shift'] })
  await page.locator('#group-layers').click()
  await expect(page.locator('#save-preset-from-layers')).toBeEnabled()

  await page.locator('#asset-tab-presets').click()
  await expect(page.locator('#asset-panel-presets')).toBeVisible()
  await expect(page.locator('#save-preset')).toBeEnabled()
  await page.locator('#save-preset').click()
  await expect(page.locator('#preset-name-dialog')).toBeVisible()
  await expect(page.locator('#editor-dialog-root > #preset-name-dialog')).toHaveCount(1)
  await expect(page.locator('#preset-name-dialog form')).toHaveClass(/dialog-panel/)
  await expect(page.locator('#preset-name-dialog header')).toHaveClass(/dialog-header/)
  await expect(page.locator('#preset-name-dialog footer')).toHaveClass(/dialog-actions/)
  const presetNameInputBox = await page.locator('#preset-name-input').boundingBox()
  expect(presetNameInputBox?.width).toBeGreaterThan(240)
  await page.locator('#preset-name-input').fill('开场站位')
  await page.locator('#confirm-preset-name').click()

  const presetCard = page.locator('.preset-card').filter({ hasText: '开场站位' })
  await expect(presetCard).toHaveCount(1)
  await expect(presetCard).toContainText('2 个对象')
  await expect(presetCard.locator('.preset-preview img')).toHaveAttribute('src', /^blob:/)
  const presetPreviewBox = await presetCard.locator('.preset-preview').boundingBox()
  const presetPreviewImageBox = await presetCard.locator('.preset-preview img').boundingBox()
  expect(presetPreviewImageBox?.width).toBeLessThanOrEqual(presetPreviewBox?.width ?? 0)
  expect(presetPreviewImageBox?.height).toBeLessThanOrEqual(presetPreviewBox?.height ?? 0)
  const storedPreset = await page.evaluate(() => {
    const presets = JSON.parse(localStorage.getItem('node-zsb-editor-local-presets-v1') ?? '[]')
    return presets[0]
  })
  expect(storedPreset.name).toBe('开场站位')
  expect(storedPreset.preview).toBeUndefined()
  expect(storedPreset.layers[0].type).toBe('group')
  await expect.poll(() => countPresetPreviewCache(page)).toBeGreaterThan(0)

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.locator('#clear-board').click()
  await expect(page.locator('#layer-count')).toHaveText(`0 / ${MAX_BOARD_OBJECTS}`)
  await presetCard.locator('.preset-preview').click()
  await expect(page.locator('#layer-count')).toHaveText(`2 / ${MAX_BOARD_OBJECTS}`)
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(1)

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.locator('#clear-board').click()
  const canvas = page.locator('#stage-host canvas').first()
  await presetCard.locator('.preset-preview').dragTo(canvas, {
    force: true,
    targetPosition: { x: 120, y: 140 },
  })
  await expect(page.locator('#layer-count')).toHaveText(`2 / ${MAX_BOARD_OBJECTS}`)

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await presetCard.getByRole('button', { name: '删除' }).click()
  await expect(presetCard).toHaveCount(0)
  await expect.poll(() => countPresetPreviewCache(page)).toBe(0)
})

test('editor preserves layer groups across autosave reloads', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(1).click({ modifiers: ['Shift'] })
  await page.locator('#group-layers').click()

  const groupRow = page.locator('#layers .layer-group-row')
  await expect(groupRow).toHaveCount(1)
  await groupRow.locator('.layer-name').dblclick()
  await groupRow.locator('.layer-name-input').fill('Persist Group')
  await page.keyboard.press('Enter')
  await expect(groupRow.locator('.layer-name')).toHaveText('Persist Group')

  await page.waitForFunction(() => {
    const raw = localStorage.getItem('node-zsb-editor-board-v1')
    if (!raw) return false
    const saved = JSON.parse(raw)
    return saved.format === 'node-zsb-project'
      && saved.layers?.[0]?.type === 'group'
      && saved.layers?.[0]?.name === 'Persist Group'
  })

  await page.reload()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(1)
  await expect(page.locator('#layers .layer-group-row .layer-name')).toHaveText('Persist Group')

  const project = await exportProjectFile(page)
  expect(project.layers[0]).toMatchObject({
    type: 'group',
    name: 'Persist Group',
  })
})

test('editor drags nested groups back to the layer root', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(1).click({ modifiers: ['Shift'] })
  await page.locator('#group-layers').click()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(1)

  await page.locator('#layers .layer-row').nth(3).click()
  await page.locator('#layers .layer-row').nth(4).click({ modifiers: ['Shift'] })
  await page.locator('#group-layers').click()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(2)

  const outerGroup = page.locator('#layers .layer-group-row').nth(0)
  const innerGroup = page.locator('#layers .layer-group-row').nth(1)
  await dragLayerIntoGroup(innerGroup, outerGroup)
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(2)
  const nestedProject = await exportProjectFile(page)
  expect(nestedProject.layers[0].children.some((node: { type: string }) =>
    node.type === 'group')).toBe(true)

  await expect(page.locator('#layer-root-drop')).toHaveCount(0)
  const innerGroupId = await innerGroup.evaluate((element) =>
    (element as { dataset: { groupId?: string } }).dataset.groupId)
  await page.locator('#layers').evaluate((element, groupId) => {
    const browserWindow = globalThis as any
    const dataTransfer = new browserWindow.DataTransfer()
    dataTransfer.setData('application/x-node-zsb-layer', JSON.stringify({
      type: 'group',
      id: groupId,
    }))
    element.dispatchEvent(new browserWindow.DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }))
  }, innerGroupId)
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(2)
  const project = await exportProjectFile(page)
  expect(project.layers.filter((node: { type: string }) => node.type === 'group')).toHaveLength(2)
})

test('editor reorders layer groups by dropping above and below rows', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(1).click({ modifiers: ['Shift'] })
  await page.locator('#group-layers').click()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(1)

  await page.locator('#layers .layer-row').nth(3).click()
  await page.locator('#layers .layer-row').nth(4).click({ modifiers: ['Shift'] })
  await page.locator('#group-layers').click()
  await expect(page.locator('#layers .layer-group-row')).toHaveCount(2)

  const initialProject = await exportProjectFile(page)
  const initialGroupIds = initialProject.layers
    .filter((node: { type: string }) => node.type === 'group')
    .map((node: { id: string }) => node.id)
  expect(initialGroupIds).toHaveLength(2)

  await dragLayerRowToVerticalZone(page, 1, 0, 0.05)
  const beforeProject = await exportProjectFile(page)
  expect(beforeProject.layers
    .filter((node: { type: string }) => node.type === 'group')
    .map((node: { id: string }) => node.id)).toEqual([
    initialGroupIds[1],
    initialGroupIds[0],
  ])

  await dragLayerRowToVerticalZone(page, 0, 1, 0.95)
  const afterProject = await exportProjectFile(page)
  expect(afterProject.layers
    .filter((node: { type: string }) => node.type === 'group')
    .map((node: { id: string }) => node.id)).toEqual([
    initialGroupIds[0],
    initialGroupIds[1],
  ])
})

test('editor resizes side panels and keeps object tabs visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const shellColumns = async () =>
    page.locator('#editor-shell').evaluate((shell) =>
      shell.ownerDocument.defaultView
        ?.getComputedStyle(shell)
        .gridTemplateColumns
        .split(' ')
        .map(Number.parseFloat) ?? [])
  const tabsFit = async () =>
    page.locator('#palette-tabs').evaluate((tabs) => tabs.scrollWidth <= tabs.clientWidth)
  const toolrailFitsHorizontally = async () =>
    page.locator('.editor-toolrail').evaluate((toolrail) =>
      toolrail.scrollWidth <= toolrail.clientWidth)
  const paletteColumnCount = async () =>
    page.locator('#palette').evaluate((palette) =>
      palette.ownerDocument.defaultView
        ?.getComputedStyle(palette)
        .gridTemplateColumns
        .split(' ')
        .length ?? 0)
  const paletteTabWritingMode = async () =>
    page.locator('#palette-tabs button').first().evaluate((tab) =>
      tab.ownerDocument.defaultView?.getComputedStyle(tab).writingMode ?? '')

  await expect(page.locator('#left-panel-resizer')).toHaveAttribute('role', 'separator')
  await expect(page.locator('#right-panel-resizer')).toHaveAttribute('role', 'separator')
  const assetBox = await page.locator('.asset-panel').boundingBox()
  const toolbarBox = await page.locator('.stage-toolbar').boundingBox()
  const toolrailBox = await page.locator('.editor-toolrail').boundingBox()
  const stageHostBox = await page.locator('#stage-host').boundingBox()
  const stageBox = await page.locator('.stage-wrap').boundingBox()
  if (!assetBox || !toolbarBox || !toolrailBox || !stageHostBox || !stageBox) {
    throw new Error('Editor layout is not visible')
  }
  expect(stageBox.x).toBeGreaterThan(assetBox.x + assetBox.width)
  expect(toolrailBox.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height)
  expect(stageHostBox.x).toBeGreaterThanOrEqual(toolrailBox.x + toolrailBox.width)
  expect(await toolrailFitsHorizontally()).toBe(true)
  expect(await tabsFit()).toBe(true)
  expect(await paletteTabWritingMode()).toBe('horizontal-tb')
  const initialPaletteColumns = await paletteColumnCount()

  const initialColumns = await shellColumns()
  expect(initialColumns[0]).toBeGreaterThanOrEqual(390)

  const leftHandle = await page.locator('#left-panel-resizer').boundingBox()
  if (!leftHandle) throw new Error('Left resizer is not visible')
  await page.mouse.move(leftHandle.x + leftHandle.width / 2, leftHandle.y + 40)
  await page.mouse.down()
  await page.mouse.move(leftHandle.x + leftHandle.width / 2 - 180, leftHandle.y + 40)
  await page.mouse.up()
  const narrowLeftColumns = await shellColumns()
  expect(narrowLeftColumns[0]).toBeCloseTo(276, 0)
  expect(await paletteColumnCount()).toBe(3)
  expect(await tabsFit()).toBe(true)
  expect(await paletteTabWritingMode()).toBe('vertical-rl')

  await page.locator('#left-panel-resizer').dblclick()
  await expect.poll(() => shellColumns()).toEqual(expect.arrayContaining([390]))
  const resetLeftHandle = await page.locator('#left-panel-resizer').boundingBox()
  if (!resetLeftHandle) throw new Error('Left resizer is not visible after reset')
  await page.mouse.move(resetLeftHandle.x + resetLeftHandle.width / 2, resetLeftHandle.y + 40)
  await page.mouse.down()
  await page.mouse.move(resetLeftHandle.x + resetLeftHandle.width / 2 + 120, resetLeftHandle.y + 40)
  await page.mouse.up()
  const widerLeftColumns = await shellColumns()
  expect(widerLeftColumns[0]).toBeGreaterThan(initialColumns[0])
  expect(await paletteColumnCount()).toBeGreaterThan(initialPaletteColumns)

  const rightHandle = await page.locator('#right-panel-resizer').boundingBox()
  if (!rightHandle) throw new Error('Right resizer is not visible')
  await page.mouse.move(rightHandle.x + rightHandle.width / 2, rightHandle.y + 40)
  await page.mouse.down()
  await page.mouse.move(rightHandle.x + rightHandle.width / 2 - 32, rightHandle.y + 40)
  await page.mouse.up()
  const widerRightColumns = await shellColumns()
  expect(widerRightColumns[4]).toBeGreaterThan(widerLeftColumns[4])

  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')
  const persistedColumns = await shellColumns()
  expect(persistedColumns[0]).toBeCloseTo(widerRightColumns[0], 0)
  expect(persistedColumns[4]).toBeCloseTo(widerRightColumns[4], 0)
})

test('editor renders readable Chinese labels', async ({ page }) => {
  await page.goto('/editor')

  await expect(page).toHaveTitle('战术板编辑器')
  await expect(page.getByRole('menubar', { name: '主菜单' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '文件' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '编辑' })).toBeVisible()
  await expect(page.locator('#file-menu')).toBeHidden()
  await expect(page.locator('#edit-menu')).toBeHidden()
  await expect(page.locator('#file-menu-button')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#file-menu-button')).toHaveAttribute('aria-haspopup', 'menu')
  await expect(page.locator('#file-menu-button svg')).toHaveCSS('stroke', 'rgb(217, 224, 228)')
  await expect(page.locator('#file-menu-button svg')).toHaveCSS('width', '14px')
  const menuBox = await page.locator('#file-menu-button').boundingBox()
  const fileNameBox = await page.locator('#file-name').boundingBox()
  if (!menuBox || !fileNameBox) throw new Error('File menu or file name input is not visible')
  expect(fileNameBox.x).toBeGreaterThan(menuBox.x + menuBox.width)
  await openFileMenu(page)
  await expect(page.locator('#file-menu-button')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('menuitem', { name: '新建文件' })).toBeVisible()
  await expect(page.locator('#save-local-board kbd')).toHaveText('Ctrl+S')
  await expect(page.locator('#save-as-local-board kbd')).toHaveText('Ctrl+Shift+S')
  await expect(page.getByRole('menuitem', { name: '导入分享码' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '导出分享码' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '导出图片' })).toBeVisible()
  await expect(page.locator('#new-local-board')).toHaveAttribute('title', '新建文件')
  await expect(page.locator('#open-import-dialog')).toHaveAttribute('title', '导入分享码')
  await expect(page.locator('#open-export-code-dialog')).toHaveAttribute('title', '导出分享码')
  await expect(page.locator('#open-export-image-dialog')).toHaveAttribute('title', '导出图片')
  await expect(page.locator('#new-local-board')).toContainText('新建文件')
  await expect(page.locator('#new-local-board svg')).toBeVisible()
  const newFileItemBox = await page.locator('#new-local-board').boundingBox()
  expect(Math.round(newFileItemBox?.width ?? 0)).toBeGreaterThan(180)
  await expect(page.locator('#open-import-dialog')).toContainText('导入分享码')
  await expect(page.locator('#open-import-dialog svg')).toBeVisible()
  await expect(page.locator('#open-import-dialog svg')).toHaveCSS('stroke', 'rgb(217, 224, 228)')
  await expect(page.locator('#open-import-dialog svg path')).toHaveCount(5)
  await expect(page.locator('#open-import-dialog')).toHaveCSS('width', '238px')
  await expect(page.locator('.file-menu-code-actions .file-menu-separator')).toHaveCount(1)
  await expect(page.locator('#open-export-code-dialog svg')).toBeVisible()
  await expect(page.locator('#open-export-image-dialog svg')).toBeVisible()
  await expect(page.locator('#open-export-code-dialog')).toContainText('导出分享码')
  await expect(page.locator('#open-export-image-dialog')).toContainText('导出图片')
  await page.keyboard.press('Escape')
  await expect(page.locator('#file-menu')).toBeHidden()
  await page.locator('#edit-menu-button').click()
  await expect(page.locator('#edit-menu')).toBeVisible()
  await expect(page.locator('#menu-copy-object kbd')).toHaveText('Ctrl+C')
  await expect(page.locator('#menu-paste-object kbd')).toHaveText('Ctrl+V')
  await expect(page.locator('#menu-duplicate-object kbd')).toHaveText('Ctrl+D')
  await page.keyboard.press('Escape')
  await expect(page.locator('#edit-menu')).toBeHidden()
  await expect(page.locator('#quick-open-import-dialog')).toHaveAttribute('title', '导入分享码')
  await expect(page.locator('#quick-open-export-code-dialog')).toHaveAttribute('title', '导出分享码')
  await expect(page.locator('#quick-open-import-dialog svg')).toBeVisible()
  await expect(page.locator('#quick-open-export-code-dialog svg')).toBeVisible()
  await expect(page.locator('.top-command-icons .toolbar-separator')).toHaveCount(4)
  await expect(page.locator('.board-name-group')).toHaveCount(1)
  await expect(page.locator('.file-menu-local-actions')).toHaveCount(1)
  await expect(page.locator('.file-menu-code-actions')).toHaveCount(1)
  await expect(page.locator('.board-name-label')).toHaveText('文件名')
  await expect(page.locator('.share-section > .section-title')).toHaveText('分享名')
  await expect(page.locator('.share-name-field span')).toHaveCount(0)
  await expect(page.locator('.inspector-section')).toHaveCount(3)
  await expect(page.locator('.share-section .share-name-field')).toBeVisible()
  await expect(page.locator('.property-section > .section-title')).toHaveText('属性')
  await expect(page.locator('.layers-section > .section-title')).toContainText('图层')
  await expect(page.locator('.layers-title')).toHaveCSS('display', 'flex')
  await expect(page.locator('#layer-count')).toHaveText(new RegExp(`^\\d+ / ${MAX_BOARD_OBJECTS}$`))
  await openExportCodeDialog(page)
  await expect(page.locator('#copy-export-code')).toBeVisible()
  await expect(page.getByPlaceholder('分享名')).toBeVisible()
  await page.locator('#export-code-dialog').evaluate((dialog) => dialog.close())
  await expect(page.locator('#layers')).toContainText('tank')
  await expect(page.locator('#layer-count')).not.toHaveText('0')
  await expect(page.getByTitle('tank').first().locator('.object-preview')).toHaveCSS(
    'background-image',
    /tab1\.webp/,
  )
  await expect(page.locator('#layers .layer-row').first().locator('.layer-preview')).toHaveCSS(
    'background-image',
    /tab1\.webp/,
  )
  await expect(page.locator('.stage-toolbar-row')).toHaveCount(1)
  await expect(page.locator('.stage-statusbar #zoom-select')).toHaveCount(1)
  await expect(page.locator('.stage-statusbar #zoom-select')).toHaveAttribute('type', 'range')
  await expect(page.locator('.stage-statusbar #zoom-select')).toHaveAttribute('min', '0.25')
  await expect(page.locator('.stage-statusbar #zoom-select')).toHaveAttribute('max', '2')
  await expect(page.locator('.stage-statusbar #zoom-out')).toBeVisible()
  await expect(page.locator('.stage-statusbar #zoom-in')).toBeVisible()
  await expect(page.locator('.stage-statusbar #zoom-value')).toBeVisible()
  await expect(page.locator('.stage-statusbar #snap-toggle')).toHaveCount(1)
  await expect(page.locator('.stage-statusbar #grid-toggle')).toHaveCount(1)
  await expect(page.locator('.stage-statusbar #grid-density')).toHaveAttribute('type', 'range')
  await expect(page.locator('.stage-statusbar #grid-density')).toHaveAttribute('min', '8')
  await expect(page.locator('.stage-statusbar #grid-density')).toHaveAttribute('max', '64')
  await expect(page.locator('.stage-statusbar #grid-density-value')).toHaveText('16px')
  await expect(page.locator('.stage-statusbar #grid-opacity')).toHaveAttribute('type', 'range')
  await expect(page.locator('.stage-statusbar #grid-opacity')).toHaveAttribute('min', '0.15')
  await expect(page.locator('.stage-statusbar #grid-opacity')).toHaveAttribute('max', '1')
  await expect(page.locator('.stage-statusbar #grid-opacity-value')).toHaveText('55%')
  await expect(page.locator('.top-command-icons #undo-action')).toHaveCount(1)
  await expect(page.locator('.editor-toolrail #align-left')).toHaveCount(1)
  await expect(page.locator('#align-left')).toHaveText('')
  await expect(page.locator('#align-left svg')).toBeVisible()
  await expect(page.locator('#marquee-mode')).toHaveCount(0)
  await expect(page.locator('.layer-toolbar-group')).toHaveCount(3)
  await expect(page.locator('#asset-tab-background')).toHaveAttribute('role', 'tab')
  await expect(page.locator('#asset-tab-objects')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#asset-tab-presets')).toHaveAttribute('role', 'tab')
  await expect(page.locator('#asset-tab-presets')).toHaveText('预设')
  await expect(page.locator('#palette-tabs')).toHaveAttribute('role', 'tablist')
  await expect(page.getByRole('tab', { name: '形状' })).toHaveAttribute('aria-selected', 'false')
  await page.getByRole('tab', { name: '形状' }).click()
  await expect(page.getByRole('tab', { name: '形状' })).toHaveAttribute('aria-selected', 'true')
  for (const shapeType of ['line', 'line_aoe', 'circle_aoe', 'fan_aoe', 'donut']) {
    await expect(page.locator(`button[title="${shapeType}"] svg`)).toBeVisible()
  }
  await expect(page.locator('.section-title')).toContainText([
    '属性',
    '图层',
  ])
})

test('editor opens share code dialogs from toolbar shortcuts', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#quick-open-import-dialog').click()
  await expect(page.locator('#import-dialog')).toBeVisible()
  await page.locator('#import-dialog').evaluate((dialog) => dialog.close())

  await page.locator('#quick-open-export-code-dialog').click()
  await expect(page.locator('#export-code-dialog')).toBeVisible()
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)
})

test('editor disables async action buttons while exporting', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  let releaseExport: () => void = () => {}
  await page.route('**/utils/json2code', async (route) => {
    await new Promise<void>((resolve) => {
      releaseExport = resolve
    })
    await route.continue()
  })

  await openFileMenu(page)
  await page.locator('#open-export-code-dialog').click()
  await expect(page.locator('#load-code')).toBeDisabled()
  await expect(page.locator('#file-menu-button')).toBeDisabled()
  await expect(page.locator('#open-export-code-dialog')).toBeDisabled()
  await expect(page.locator('#open-export-image-dialog')).toBeDisabled()
  await expect(page.locator('#quick-open-import-dialog')).toBeDisabled()
  await expect(page.locator('#quick-open-export-code-dialog')).toBeDisabled()
  await expect(page.locator('#status')).toContainText('正在生成分享码')

  releaseExport()
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)
  await expect(page.locator('#load-code')).toBeEnabled()
  await expect(page.locator('#file-menu-button')).toBeEnabled()
  await expect(page.locator('#open-export-code-dialog')).toBeEnabled()
  await expect(page.locator('#open-export-image-dialog')).toBeEnabled()
  await expect(page.locator('#quick-open-import-dialog')).toBeEnabled()
  await expect(page.locator('#quick-open-export-code-dialog')).toBeEnabled()
})

test('editor imports code, changes background, and edits text and line objects', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await openImportDialog(page)
  const initialCode = await page.locator('#code-input').inputValue()
  await page.locator('#code-input').fill(initialCode)
  await page.locator('#load-code').click()

  await page.locator('#asset-tab-background').click()
  await page.locator('#background-list [data-background="grey_square"]').click()
  await expect(page.locator('#background-list [data-background="grey_square"]')).toHaveAttribute(
    'aria-checked',
    'true',
  )

  await page.locator('#asset-tab-objects').click()
  await page.getByRole('tab', { name: '形状' }).click()
  await page.getByTitle('text').click()
  await expect(page.locator('#object-type')).toHaveValue('text')
  await page.locator('#object-text').fill('MT')
  await expect(page.locator('#object-color')).toHaveAttribute('type', 'text')
  await page.locator('#object-color-text').fill('#00ffcc')
  await expect(page.locator('#object-color-text')).toHaveValue('#00ffcc')
  await page.locator('#object-color-trigger').click()
  await expect(page.locator('#object-color-popover')).toBeVisible()
  await page.locator('#object-color-swatches [data-color="#43a8d8"]').click()
  await expect(page.locator('#object-color')).toHaveValue('#43a8d8')
  await expect(page.locator('#object-color-preview')).toHaveCSS('background-color', 'rgb(67, 168, 216)')
  await expect(page.locator('#layers')).toContainText('text')

  await page.locator('button[title="line"]').click()
  await expect(page.locator('#object-type')).toHaveValue('line')
  await page.locator('#object-end-x').fill('360')
  await page.locator('#object-end-y').fill('240')
  await expect(page.locator('#layers')).toContainText('line')

  const exported = await exportBoardCode(page)
  await page.locator('#export-code-dialog').evaluate((dialog) => dialog.close())
  await openImportDialog(page)
  await page.locator('#code-input').fill(exported)
  await page.locator('#load-code').click()
  await expect(page.locator('#layers')).toContainText('text')
  await expect(page.locator('#layers')).toContainText('line')
})

test('editor drags line endpoints directly on the canvas', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByRole('tab', { name: '形状' }).click()
  await page.locator('button[title="line"]').click()
  await expect(page.locator('#object-type')).toHaveValue('line')
  await expect(page.locator('#object-end-x')).toHaveValue('320')
  await expect(page.locator('#object-end-y')).toHaveValue('192')

  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const scale = box.width / 1024
  const point = (x: number, y: number) => ({
    x: box.x + x * 2 * scale,
    y: box.y + y * 2 * scale,
  })
  const from = point(320, 192)
  const to = point(360, 240)

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()

  await expect(page.locator('#object-end-x')).toHaveValue('360')
  await expect(page.locator('#object-end-y')).toHaveValue('240')
  await expect(page.locator('#status')).toContainText('已调整线段端点')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#object-end-x')).toHaveValue('320')
  await expect(page.locator('#object-end-y')).toHaveValue('192')

  const startFrom = point(256, 192)
  const startTo = point(240, 176)
  await page.mouse.move(startFrom.x, startFrom.y)
  await page.mouse.down()
  await page.mouse.move(startTo.x, startTo.y, { steps: 8 })
  await page.mouse.up()

  const startX = Number(await page.locator('#object-x').inputValue())
  const startY = Number(await page.locator('#object-y').inputValue())
  expect(startX).toBeGreaterThanOrEqual(238)
  expect(startX).toBeLessThanOrEqual(241)
  expect(startY).toBeGreaterThanOrEqual(174)
  expect(startY).toBeLessThanOrEqual(177)
  await expect(page.locator('#object-end-x')).toHaveValue('320')
  await expect(page.locator('#object-end-y')).toHaveValue('192')
})

test('editor scales the selected object from the canvas transformer', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByTitle('tank').first().click()
  await expect(page.locator('#object-type')).toHaveValue('tank')
  await expect(page.locator('#object-size')).toHaveValue('100')

  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const scale = box.width / 1024
  const point = (x: number, y: number) => ({
    x: box.x + x * 2 * scale,
    y: box.y + y * 2 * scale,
  })
  const from = point(240, 176)
  const to = point(216, 152)

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()

  await expect.poll(async () => Number(await page.locator('#object-size').inputValue()))
    .toBeGreaterThan(100)

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#object-size')).toHaveValue('100')
})

test('editor commits multi-selected canvas scaling in one stable batch', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.locator('#clear-board').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(0)

  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('220')
  await page.locator('#object-y').fill('160')
  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('320')
  await page.locator('#object-y').fill('220')

  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const scale = box.width / 1024
  const point = (x: number, y: number) => ({
    x: box.x + x * 2 * scale,
    y: box.y + y * 2 * scale,
  })

  await page.mouse.click(point(220, 160).x, point(220, 160).y)
  await page.keyboard.down('Control')
  await page.mouse.click(point(320, 220).x, point(320, 220).y)
  await page.keyboard.up('Control')
  await expect(page.locator('#layers .layer-row.active')).toHaveCount(2)

  const from = point(204, 144)
  const to = point(176, 116)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()

  const transformed = await page.waitForFunction(() => {
    const raw = localStorage.getItem('node-zsb-editor-board-v1')
    if (!raw) return null
    const saved = JSON.parse(raw)
    const objects = Object.values(saved.objects ?? {}) as Array<{ size?: number, x: number, y: number }>
    if (objects.length !== 2) return null
    if (!objects.every((object: { size?: number }) => (object.size ?? 0) > 100)) return null
    return objects.map((object) => ({
      size: object.size ?? 100,
      x: object.x,
      y: object.y,
    }))
  })
  const objects = await transformed.jsonValue() as Array<{ size: number, x: number, y: number }>
  expect(objects).toHaveLength(2)
  expect(objects.every((object) =>
    Number.isFinite(object.x)
    && Number.isFinite(object.y)
    && object.x >= 0
    && object.x <= 512
    && object.y >= 0
    && object.y <= 384
  )).toBe(true)
  const [firstObject, secondObject] = objects
  if (!firstObject || !secondObject) throw new Error('Expected two transformed objects')
  expect(Math.abs(secondObject.x - firstObject.x)).toBeGreaterThan(70)
})

test('editor multi-selects objects on the canvas and aligns them', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('220')
  await page.locator('#object-y').fill('160')
  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('320')
  await page.locator('#object-y').fill('220')

  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const scale = box.width / 1024
  const point = (x: number, y: number) => ({
    x: box.x + x * 2 * scale,
    y: box.y + y * 2 * scale,
  })

  const first = point(220, 160)
  const second = point(320, 220)
  await page.mouse.click(first.x, first.y)
  await page.keyboard.down('Control')
  await page.mouse.click(second.x, second.y)
  await page.keyboard.up('Control')

  await expect(page.locator('#layers .layer-row.active')).toHaveCount(2)
  await expect(page.locator('#align-left')).toBeEnabled()
  await page.locator('#align-left').click()
  await expect(page.locator('#object-x')).toHaveValue('220')

  await page.locator('#align-bottom').click()
  await expect(page.locator('#object-y')).toHaveValue('220')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#object-y')).toHaveValue('220')
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#object-x')).toHaveValue('320')
})

test('editor drags multi-selected objects together on the canvas', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.locator('#clear-board').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(0)

  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('220')
  await page.locator('#object-y').fill('160')
  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('320')
  await page.locator('#object-y').fill('220')

  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const point = (x: number, y: number) => ({
    x: box.x + (x / 512) * box.width,
    y: box.y + (y / 384) * box.height,
  })

  await page.mouse.click(point(220, 160).x, point(220, 160).y)
  await page.keyboard.down('Control')
  await page.mouse.click(point(320, 220).x, point(320, 220).y)
  await page.keyboard.up('Control')
  await expect(page.locator('#layers .layer-row.active')).toHaveCount(2)

  await page.mouse.move(point(320, 220).x, point(320, 220).y)
  await page.mouse.down()
  await page.mouse.move(point(340, 240).x, point(340, 240).y, { steps: 8 })
  await page.mouse.up()

  await expect(page.locator('#layers .layer-row').nth(0).locator('.layer-position')).toHaveText('240, 180')
  await expect(page.locator('#layers .layer-row').nth(1).locator('.layer-position')).toHaveText('340, 240')
})

test('editor range-selects layer rows with shift click', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(2).click({ modifiers: ['Shift'] })

  await expect(page.locator('#layers .layer-row.active')).toHaveCount(3)
  await expect(page.locator('#layers .layer-row').nth(0)).toHaveClass(/active/)
  await expect(page.locator('#layers .layer-row').nth(1)).toHaveClass(/active/)
  await expect(page.locator('#layers .layer-row').nth(2)).toHaveClass(/active/)
  await expect(page.locator('#group-layers')).toBeEnabled()
})

test('editor aligns a single selected object to the canvas', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByTitle('tank').first().click()
  await page.locator('#object-x').fill('120')
  await page.locator('#object-y').fill('80')
  await expect(page.locator('#align-center-x')).toBeEnabled()

  await page.locator('#align-center-x').click()
  await expect(page.locator('#object-x')).toHaveValue('256')
  await expect(page.locator('#status')).toContainText('已对齐到画布')

  await page.locator('#align-center-y').click()
  await expect(page.locator('#object-y')).toHaveValue('192')
})

test('editor uses CAD-style marquee direction for contained and intersect selection', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('node-zsb-editor-board-v1')
    localStorage.removeItem('node-zsb-editor-settings-v1')
  })
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.locator('#clear-board').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(0)

  await page.locator('button[title="tank"]').click()
  await page.locator('#object-x').fill('180')
  await page.locator('#object-y').fill('80')
  await expect(page.locator('#layers .layer-row')).toHaveCount(1)

  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const point = (x: number, y: number) => ({
    x: box.x + (x / 512) * box.width,
    y: box.y + (y / 384) * box.height,
  })
  await page.mouse.click(point(500, 370).x, point(500, 370).y)
  await expect(page.locator('#layers .layer-row.active')).toHaveCount(0)
  const containedStart = point(130, 40)
  const containedEnd = point(180, 80)
  await page.mouse.move(containedStart.x, containedStart.y)
  await page.mouse.down()
  await page.mouse.move(containedEnd.x, containedEnd.y, { steps: 6 })
  await page.waitForTimeout(50)
  await page.mouse.up()
  await expect(page.locator('#layers .layer-row.active')).toHaveCount(0)

  const intersectStart = point(220, 40)
  const intersectEnd = point(130, 120)
  await page.mouse.move(intersectStart.x, intersectStart.y)
  await page.mouse.down()
  await page.mouse.move(intersectEnd.x, intersectEnd.y, { steps: 6 })
  await page.waitForTimeout(50)
  await page.mouse.up()
  await expect(page.locator('#layers .layer-row.active')).toHaveCount(1)
  await expect(page.locator('#object-type')).toHaveValue('tank')
})

test('editor reorders layers by dragging rows', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByRole('tab', { name: '形状' }).click()
  await page.getByTitle('text').click()
  const textRow = page.locator('#layers .layer-row').filter({ hasText: 'text' })
  await expect(textRow).toHaveCount(1)
  await expect(page.locator('#layers .layer-row').first()).not.toContainText('text')

  const layerCount = await page.locator('#layers .layer-row').count()
  await textRow.scrollIntoViewIfNeeded()
  await page.locator('#layers').evaluate((layers, targetIndex) => {
    const rows = [...layers.querySelectorAll('.layer-row')]
    const source = rows.find((row) => row.textContent?.includes('text'))
    const target = rows[targetIndex]
    if (!source || !target) throw new Error('Layer rows are not available')
    const browserWindow = globalThis as any
    const DataTransferCtor = browserWindow.DataTransfer
    const DragEventCtor = browserWindow.DragEvent
    const dataTransfer = new DataTransferCtor()
    source.dispatchEvent(new DragEventCtor('dragstart', { bubbles: true, dataTransfer }))
    target.dispatchEvent(new DragEventCtor('dragover', { bubbles: true, dataTransfer }))
    target.dispatchEvent(new DragEventCtor('drop', { bubbles: true, dataTransfer }))
    source.dispatchEvent(new DragEventCtor('dragend', { bubbles: true, dataTransfer }))
  }, layerCount - 2)
  await expect(page.locator('#layers .layer-row').nth(layerCount - 2)).toContainText('text')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#layers .layer-row').nth(layerCount - 1)).toContainText('text')
})

test('editor opens custom context menus for canvas and layers', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await page.locator('#layers .layer-row').first().click()
  await page.locator('#stage-host').click({ button: 'right' })
  await expect(page.locator('#context-menu')).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '左对齐' })).toHaveText('')
  await expect(page.getByRole('menuitem', { name: '左对齐' }).locator('svg')).toBeVisible()
  await page.getByRole('menuitem', { name: '复制' }).click()
  await page.locator('#stage-host').click({ button: 'right' })
  await page.getByRole('menuitem', { name: '粘贴' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)

  await page.getByRole('tab', { name: '形状' }).click()
  await page.getByTitle('text').click()
  const textRow = page.locator('#layers .layer-row').filter({ hasText: 'text' })
  const layerCount = await page.locator('#layers .layer-row').count()
  await textRow.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '上移图层' }).click()
  await expect(page.locator('#layers .layer-row').nth(layerCount - 2)).toContainText('text')
})

test('editor selects layer groups without opening the object context menu', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').nth(0).click()
  await page.locator('#layers .layer-row').nth(1).click({ modifiers: ['Shift'] })
  await expect(page.locator('#group-layers')).toBeEnabled()
  await page.locator('#group-layers').click()

  const groupRow = page.locator('#layers .layer-group-row')
  await expect(groupRow).toHaveCount(1)
  await groupRow.click({ button: 'right' })

  await expect(groupRow).toHaveClass(/active/)
  await expect(page.locator('#context-menu')).toBeHidden()
  await expect(page.locator('#ungroup-layers')).toBeEnabled()
})

test('editor reports invalid share code without replacing the board', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')
  const before = await page.locator('#layers').textContent()

  await openImportDialog(page)
  await page.locator('#code-input').fill('[invalid]')
  await page.locator('#load-code').click()

  await expect(page.locator('#status')).toContainText(/share code/i)
  await expect(page.locator('#layers')).toHaveText(before ?? '')
})

test('editor supports undo and redo for object creation', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await page.getByTitle('tank').first().click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before)
  await expect(page.locator('#status')).toContainText('已撤销')

  await page.getByRole('button', { name: '重做' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)
  await expect(page.locator('#status')).toContainText('已重做')
})

test('editor updates object action button states from the selection', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await expect(page.locator('#delete-object')).toBeDisabled()
  await expect(page.locator('#duplicate-object')).toBeDisabled()
  await expect(page.locator('#paste-object')).toBeDisabled()
  await expect(page.locator('#center-object')).toHaveCount(0)
  await expect(page.locator('#move-top')).toBeDisabled()
  await expect(page.locator('#move-up')).toBeDisabled()
  await expect(page.locator('#move-down')).toBeDisabled()
  await expect(page.locator('#move-bottom')).toBeDisabled()
  await expect(page.locator('.layer-toolbar #delete-object')).toBeVisible()
  await expect(page.locator('.layer-toolbar #move-up')).toBeVisible()
  await expect(page.locator('.stage-toolbar #move-up')).toHaveCount(0)
  await expect(page.locator('.stage-toolbar #delete-object')).toHaveCount(0)

  await page.locator('#layers .layer-row').first().click()
  await expect(page.locator('#delete-object')).toBeEnabled()
  await expect(page.locator('#duplicate-object')).toBeEnabled()
  await expect(page.locator('#paste-object')).toBeDisabled()
  await expect(page.locator('#move-top')).toBeDisabled()
  await expect(page.locator('#move-up')).toBeDisabled()
  await expect(page.locator('#move-down')).toBeEnabled()
  await expect(page.locator('#move-bottom')).toBeEnabled()

  await page.keyboard.press('Control+C')
  await expect(page.locator('#paste-object')).toBeEnabled()

  await page.locator('#object-locked').check()

  await page.keyboard.press('Escape')
  await expect(page.locator('#delete-object')).toBeDisabled()
  await expect(page.locator('#duplicate-object')).toBeDisabled()
})

test('editor moves layers to extremes and deletes from the layer toolbar', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByRole('tab', { name: '形状' }).click()
  await page.getByTitle('text').click()
  const layerCount = await page.locator('#layers .layer-row').count()
  await expect(page.locator('#layers .layer-row').nth(layerCount - 1)).toContainText('text')

  await page.locator('#move-top').click()
  await expect(page.locator('#layers .layer-row').first()).toContainText('text')
  await expect(page.locator('#move-top')).toBeDisabled()
  await expect(page.locator('#move-bottom')).toBeEnabled()

  await page.locator('#move-bottom').click()
  await expect(page.locator('#layers .layer-row').nth(layerCount - 1)).toContainText('text')
  await expect(page.locator('#move-bottom')).toBeDisabled()

  await page.locator('#delete-object').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(layerCount - 1)
})

test('editor clears the board with confirmation and undo support', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await expect(page.locator('#layer-count')).toHaveText(`${before} / ${MAX_BOARD_OBJECTS}`)
  await expect(page.locator('#clear-board')).toBeEnabled()

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('清空')
    await dialog.dismiss()
  })
  await page.locator('#clear-board').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before)

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('清空')
    await dialog.accept()
  })
  await page.locator('#clear-board').click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(0)
  await expect(page.locator('#layers')).toContainText('暂无对象')
  await expect(page.locator('#layer-count')).toHaveText(`0 / ${MAX_BOARD_OBJECTS}`)
  await expect(page.locator('#empty-state')).toBeVisible()
  await expect(page.locator('#clear-board')).toBeDisabled()
  await expect(page.locator('#delete-object')).toBeDisabled()
  await expect(page.locator('#status')).toContainText('已清空画板')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before)
  await expect(page.locator('#layer-count')).toHaveText(`${before} / ${MAX_BOARD_OBJECTS}`)
  await expect(page.locator('#clear-board')).toBeEnabled()
})

test('editor saves, loads, and deletes local browser board slots', async ({
  page,
}) => {
  await page.goto('/editor')
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-local-boards-v1'),
  )
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-local-files-v1'),
  )
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-board-v1'),
  )
  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')
  await openLocalBoardDialog(page)
  await expect(page.locator('#local-board-list')).toContainText('暂无本地文件')
  await page.locator('#local-board-dialog').evaluate((dialog) => {
    if ('close' in dialog) dialog.close()
  })

  await page.locator('#file-name').fill('本地草稿')
  await page.locator('#board-name').fill('分享草稿')
  await page.locator('#board-name').dispatchEvent('change')
  await clickFileMenuAction(page, '#save-local-board')
  await expect(page.locator('#status')).toContainText('已保存本地文件')
  await openLocalBoardDialog(page)
  await expect(page.locator('#local-board-list')).toContainText('本地草稿')
  await expect(page.locator('#local-board-list')).toContainText('分享名：分享草稿')
  await expect(page.locator('#local-board-list .local-board-preview img')).toHaveCount(1)
  await expect(page.locator('#local-board-list .local-board-preview img').first()).toHaveCSS('object-fit', 'contain')
  await expect(page.locator('#local-board-list .local-board-select span')).toHaveCount(0)
  await expect(page.locator('#select-all-local-boards')).toBeEnabled()
  await expect(page.locator('#clear-selected-local-boards')).toBeDisabled()
  await expect(page.locator('#delete-selected-local-boards')).toBeDisabled()

  await page.locator('#local-board-dialog').evaluate((dialog) => {
    if ('close' in dialog) dialog.close()
  })
  await clickFileMenuAction(page, '#save-as-local-board')
  await expect(page.locator('#local-board-name-dialog')).toBeVisible()
  await expect(page.locator('#editor-dialog-root > #local-board-name-dialog')).toHaveCount(1)
  await page.locator('#local-board-name-input').fill('另存草稿')
  await page.locator('#confirm-local-board-name').click()
  await expect(page.locator('#status')).toContainText('已保存本地文件')
  await clickFileMenuAction(page, '#save-as-local-board')
  await expect(page.locator('#local-board-name-dialog')).toBeVisible()
  await page.locator('#local-board-name-input').fill('本地草稿')
  await page.locator('#confirm-local-board-name').click()
  await expect(page.locator('#local-board-name-dialog')).toBeVisible()
  await expect(page.locator('#local-board-name-error')).toContainText('已有同名文件')
  await page.locator('#close-local-board-name-dialog').click()
  await openLocalBoardDialog(page)
  await expect(page.locator('#local-board-list .local-board-row')).toHaveCount(2)
  await page.locator('#local-board-list .local-board-row').filter({ hasText: '另存草稿' }).getByRole('button', { name: '重命名' }).click()
  await expect(page.locator('#local-board-name-dialog')).toBeVisible()
  await page.locator('#local-board-name-input').fill('重命名草稿')
  await page.locator('#confirm-local-board-name').click()
  await expect(page.locator('#local-board-list')).toContainText('重命名草稿')
  await page.locator('#local-board-dialog').evaluate((dialog) => {
    if ('close' in dialog) dialog.close()
  })

  await page.locator('#board-name').fill('临时修改')
  await page.locator('#board-name').dispatchEvent('change')
  await openLocalBoardDialog(page)
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未保存修改')
    await dialog.dismiss()
  })
  await page.locator('#local-board-list .local-board-row')
    .filter({ hasText: '本地草稿' })
    .locator('.local-board-actions')
    .getByRole('button', { name: '打开' })
    .click()
  await expect(page.locator('#file-name')).toHaveValue('本地草稿')
  await expect(page.locator('#board-name')).toHaveValue('分享草稿')
  await expect(page.locator('#status')).toContainText('已打开文件 本地草稿')
  await expect(page.locator('#local-board-dialog')).toBeHidden()
  await expect(page.locator('#undo-action')).toBeDisabled()
  await expect(page.locator('#file-name')).toHaveValue('本地草稿')
  await expect(page.locator('#board-name')).toHaveValue('分享草稿')
  await openLocalBoardDialog(page)

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('删除选中的 2 个本地文件')
    await dialog.accept()
  })
  await expect(page.locator('#select-all-local-boards')).toBeEnabled()
  await page.locator('#select-all-local-boards').click()
  await expect(page.locator('#local-board-list .local-board-row input[type="checkbox"]:checked')).toHaveCount(2)
  await expect(page.locator('#select-all-local-boards')).toBeDisabled()
  await expect(page.locator('#clear-selected-local-boards')).toBeEnabled()
  await page.locator('#clear-selected-local-boards').click()
  await expect(page.locator('#local-board-list .local-board-row input[type="checkbox"]:checked')).toHaveCount(0)
  await page.locator('#select-all-local-boards').click()
  await expect(page.locator('#delete-selected-local-boards')).toBeEnabled()
  await page.locator('#delete-selected-local-boards').click()
  await expect(page.locator('#local-board-list')).toContainText('暂无本地文件')
})

test('editor creates a new local file from the toolbar', async ({ page }) => {
  await page.goto('/editor')
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-local-files-v1'),
  )
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-board-v1'),
  )
  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#file-name').fill('新建前草稿')
  await page.locator('#board-name').fill('原分享名')
  await page.locator('#board-name').dispatchEvent('change')
  await clickFileMenuAction(page, '#save-local-board')
  await expect(page.locator('#status')).toContainText('已保存本地文件')

  await page.locator('#board-name').fill('未保存分享')
  await page.locator('#board-name').dispatchEvent('change')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('新建文件前')
    await dialog.dismiss()
  })
  await clickFileMenuAction(page, '#new-local-board')
  await expect(page.locator('#status')).toContainText('已新建文件')
  await expect(page.locator('#file-name')).toHaveValue('')
  await expect(page.locator('#board-name')).toHaveValue('')
  await expect(page.locator('#layer-count')).toHaveText(`0 / ${MAX_BOARD_OBJECTS}`)

  await openLocalBoardDialog(page)
  await expect(page.locator('#local-board-list')).toContainText('新建前草稿')
  await expect(page.locator('#local-board-list')).toContainText('分享名：原分享名')
})

test('editor does not mark the current local file dirty after renaming it', async ({ page }) => {
  await page.goto('/editor')
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-local-files-v1'),
  )
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-board-v1'),
  )
  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#file-name').fill('重命名前')
  await clickFileMenuAction(page, '#save-local-board')
  await expect(page.locator('#status')).toContainText('已保存本地文件')

  await openLocalBoardDialog(page)
  await page.locator('#local-board-list .local-board-row')
    .filter({ hasText: '重命名前' })
    .locator('.local-board-actions')
    .getByRole('button', { name: '重命名' })
    .click()
  await page.locator('#local-board-name-input').fill('重命名后')
  await page.locator('#confirm-local-board-name').click()
  await expect(page.locator('#file-name')).toHaveValue('重命名后')
  await page.locator('#local-board-dialog').evaluate((dialog) => {
    if ('close' in dialog) dialog.close()
  })

  let unexpectedDialog = ''
  const rejectUnexpectedDialog = async (dialog: Dialog) => {
    unexpectedDialog = dialog.message()
    await dialog.dismiss()
  }
  page.on('dialog', rejectUnexpectedDialog)
  await clickFileMenuAction(page, '#new-local-board')
  page.off('dialog', rejectUnexpectedDialog)

  expect(unexpectedDialog).toBe('')
  await expect(page.locator('#status')).toContainText('已新建文件')
})

test('editor saves local files with keyboard shortcuts', async ({ page }) => {
  await page.goto('/editor')
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-local-files-v1'),
  )
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-board-v1'),
  )
  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#file-name').fill('快捷保存草稿')
  await page.locator('#board-name').fill('快捷分享')
  await page.locator('#board-name').dispatchEvent('change')
  await page.keyboard.press('Control+S')
  await expect(page.locator('#status')).toContainText('已保存本地文件')

  await openLocalBoardDialog(page)
  await expect(page.locator('#local-board-list')).toContainText('快捷保存草稿')
  await page.locator('#local-board-dialog').evaluate((dialog) => {
    if ('close' in dialog) dialog.close()
  })

  await page.keyboard.press('Control+Shift+S')
  await expect(page.locator('#local-board-name-dialog')).toBeVisible()
  await page.locator('#local-board-name-input').fill('快捷另存草稿')
  await page.locator('#confirm-local-board-name').click()
  await expect(page.locator('#status')).toContainText('已保存本地文件')
  await openLocalBoardDialog(page)
  await expect(page.locator('#local-board-list')).toContainText('快捷另存草稿')
})

test('editor persists the board across reloads', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await page.locator('#board-name').fill('自动保存')
  await page.locator('#board-name').dispatchEvent('change')
  await page.getByTitle('tank').first().click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)

  await page.reload()
  await expect(page.locator('#board-name')).toHaveValue('自动保存')
  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)
})

test('editor can open a board from the code query parameter', async ({
  page,
  request,
}) => {
  const response = await request.post('/utils/json2code', {
    data: {
      key: 14,
      board: {
        name: 'url',
        boardBackground: 'grey_square',
        objects: [{ type: 'text', x: 256, y: 192, text: 'URL' }],
      },
    },
  })
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()

  await page.goto(`/editor?code=${encodeURIComponent(payload.code)}`)

  await expect(page.locator('#background-list [data-background="grey_square"]')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.locator('#layers')).toContainText('text')
  await expect(page.locator('#status')).toContainText('已从链接导入战术板')
})

test('editor nudges the selected object with arrow keys', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByTitle('tank').first().click()
  await expect(page.locator('#object-type')).toHaveValue('tank')
  const before = Number(await page.locator('#object-x').inputValue())

  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#object-x')).toHaveValue(String(before + 1))

  await page.keyboard.press('Shift+ArrowDown')
  await expect(page.locator('#object-y')).toHaveValue('202')
})

test('editor nudges multi-selected objects with arrow keys', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const firstRow = page.locator('#layers .layer-row').nth(0)
  const secondRow = page.locator('#layers .layer-row').nth(1)
  await firstRow.click()
  await secondRow.click({ modifiers: ['Shift'] })
  await expect(page.locator('#layers .layer-row.active')).toHaveCount(2)

  const readPosition = async (row: Locator) => {
    const text = await row.locator('.layer-position').innerText()
    const match = text.match(/(-?\d+),\s*(-?\d+)/)
    if (!match) throw new Error(`Invalid layer position: ${text}`)
    return { x: Number(match[1]), y: Number(match[2]) }
  }
  const firstBefore = await readPosition(firstRow)
  const secondBefore = await readPosition(secondRow)

  await page.keyboard.press('ArrowRight')

  await expect.poll(() => readPosition(firstRow)).toEqual({
    x: firstBefore.x + 1,
    y: firstBefore.y,
  })
  await expect.poll(() => readPosition(secondRow)).toEqual({
    x: secondBefore.x + 1,
    y: secondBefore.y,
  })
})

test('editor copies and pastes the selected object with keyboard shortcuts', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await page.locator('#layers .layer-row').first().click()
  await expect(page.locator('#object-type')).toHaveValue('tank')

  await page.keyboard.press('Control+C')
  await expect(page.locator('#status')).toContainText('已复制 tank')
  await page.keyboard.press('Control+V')

  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)
  await expect(page.locator('#status')).toContainText('已粘贴 tank')
  await expect(page.locator('#object-type')).toHaveValue('tank')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before)
})

test('editor duplicates the selected object with a keyboard shortcut', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await page.locator('#layers .layer-row').first().click()
  await page.keyboard.press('Control+D')

  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)
  await expect(page.locator('#object-type')).toHaveValue('tank')
  await expect(page.locator('#object-x')).toHaveValue('274')
  await expect(page.locator('#object-y')).toHaveValue('150')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before)
})

test('editor toggles hidden and locked states from the layer list', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const firstLayer = page.locator('#layers .layer-row').first()
  await firstLayer.click()
  const beforeX = await page.locator('#object-x').inputValue()
  const hiddenToggleMetrics = await page.locator('#object-hidden').locator('xpath=..').evaluate((toggle) => {
    const icon = toggle.querySelector('svg:not([style*="display: none"])')
    const toggleRect = toggle.getBoundingClientRect()
    const iconRect = icon?.getBoundingClientRect()
    return {
      iconHeight: iconRect?.height ?? 0,
      iconWidth: iconRect?.width ?? 0,
      offsetX: iconRect ? Math.abs((toggleRect.left + toggleRect.width / 2) - (iconRect.left + iconRect.width / 2)) : 99,
      offsetY: iconRect ? Math.abs((toggleRect.top + toggleRect.height / 2) - (iconRect.top + iconRect.height / 2)) : 99,
      toggleHeight: toggleRect.height,
      toggleWidth: toggleRect.width,
    }
  })
  expect(hiddenToggleMetrics.toggleWidth).toBeGreaterThanOrEqual(38)
  expect(hiddenToggleMetrics.toggleHeight).toBeGreaterThanOrEqual(38)
  expect(hiddenToggleMetrics.iconWidth).toBeGreaterThanOrEqual(21)
  expect(hiddenToggleMetrics.iconHeight).toBeGreaterThanOrEqual(21)
  expect(hiddenToggleMetrics.offsetX).toBeLessThanOrEqual(1)
  expect(hiddenToggleMetrics.offsetY).toBeLessThanOrEqual(1)

  await firstLayer.locator('[data-action="hidden"]').click()
  await expect(page.locator('#object-hidden')).toBeChecked()
  await expect(page.locator('#object-hidden').locator('xpath=..')).toHaveAttribute('aria-pressed', 'true')
  await expect(firstLayer).toHaveClass(/muted/)

  await firstLayer.locator('[data-action="locked"]').click()
  await expect(page.locator('#object-locked')).toBeChecked()
  await expect(page.locator('#object-locked').locator('xpath=..')).toHaveClass(/active/)
  await expect(page.locator('#object-x')).toBeDisabled()
  await expect(page.locator('#object-size')).toBeDisabled()
  await expect(page.locator('#object-color')).toBeEnabled()

  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#object-x')).toHaveValue(beforeX)

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#object-locked')).not.toBeChecked()
  await expect(page.locator('#object-x')).toBeEnabled()
})

test('editor shows inspector fields that match the selected object type', async ({
  page,
  request,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').first().click()
  await expect(page.locator('[data-field="text"]')).toBeHidden()
  await expect(page.locator('[data-field="line"]')).toBeHidden()
  await expect(page.locator('[data-field="arc"]')).toBeHidden()

  await page.getByRole('tab', { name: '形状' }).click()
  await page.getByTitle('text').click()
  await expect(page.locator('[data-field="text"]')).toBeVisible()
  await expect(page.locator('[data-field="line"]')).toBeHidden()

  await page.locator('button[title="line"]').click()
  await expect(page.locator('[data-field="line"]')).toBeVisible()
  await expect(page.locator('[data-field="text"]')).toBeHidden()

  await page.locator('button[title="line_aoe"]').click()
  await expect(page.locator('#object-transparency-range')).toBeVisible()
  await expect(page.locator('#object-transparency-range')).toHaveValue('0')
  await page.locator('#object-transparency-range').fill('35')
  await expect(page.locator('#object-transparency')).toHaveValue('35')
  await page.locator('#object-transparency').fill('55')
  await expect(page.locator('#object-transparency-range')).toHaveValue('55')
  await expect(page.locator('#object-transparency-range').locator('xpath=..')).toHaveCSS(
    'grid-template-columns',
    /.+ 72px/,
  )

  await page.locator('button[title="fan_aoe"]').click()
  await expect(page.locator('[data-field="arc-angle"]')).toBeVisible()
  await page.locator('#object-arc-range').fill('180')
  await expect(page.locator('#object-arc')).toHaveValue('180')

  await page.locator('button[title="donut"]').click()
  await expect(page.locator('[data-field="donut-radius"]')).toBeVisible()
  await page.locator('#object-donut-range').fill('120')
  await expect(page.locator('#object-donut')).toHaveValue('120')

  await page.locator('#layers .layer-row').filter({ hasText: 'tank' }).first().click()
  const code = await exportBoardCode(page)
  const decoded = await request.post('/utils/code2json', {
    data: { code },
  })
  expect(decoded.ok()).toBeTruthy()
  const payload = await decoded.json()
  const tank = payload.data.objects.find(
    (object: { type: string }) => object.type === 'tank',
  )
  expect(tank.text).toBeUndefined()
  expect(tank.endX).toBeUndefined()
  expect(tank.arcAngle).toBeUndefined()
})

test('editor snaps positions to the grid', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#layers .layer-row').first().click()
  await page.locator('#snap-toggle').check()
  await expect(page.locator('#status')).toContainText('已开启网格吸附')

  await page.locator('#object-x').fill('263')
  await page.locator('#object-y').fill('199')
  await expect(page.locator('#object-x')).toHaveValue('256')
  await expect(page.locator('#object-y')).toHaveValue('192')

  await page.locator('#object-x').fill('300')
  await page.locator('#object-y').fill('220')
  await expect(page.locator('#object-x')).toHaveValue('304')
  await expect(page.locator('#object-y')).toHaveValue('224')

  await page.locator('#grid-density').fill('8')
  await page.locator('#grid-density').dispatchEvent('input')
  await expect(page.locator('#grid-density-value')).toHaveText('8px')
  await expect(page.locator('#status')).toContainText('已设置网格间距 8px')

  await page.locator('#object-x').fill('263')
  await page.locator('#object-y').fill('199')
  await expect(page.locator('#object-x')).toHaveValue('264')
  await expect(page.locator('#object-y')).toHaveValue('200')

  const canvas = page.locator('#stage-host canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  await page.mouse.move(box.x + (264 / 512) * box.width, box.y + (200 / 384) * box.height)
  await page.mouse.down()
  await page.mouse.move(box.x + (277 / 512) * box.width, box.y + (213 / 384) * box.height)
  await page.mouse.up()
  await expect(page.locator('#object-x')).toHaveValue('280')
  await expect(page.locator('#object-y')).toHaveValue('216')
})

test('editor toggles the visual grid overlay', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const stage = page.locator('#stage-host')
  const before = await stage.screenshot()

  await page.locator('#grid-toggle').check()
  await expect(page.locator('#status')).toContainText('已显示辅助网格')
  const fittedGridStats = await getGridCanvasStats(page)
  expect(fittedGridStats?.averageAlpha).toBeGreaterThan(20)
  expect(fittedGridStats?.strongPixels).toBeGreaterThan(100)
  const withGrid = await stage.screenshot()
  expect(withGrid.equals(before)).toBe(false)

  await page.locator('#grid-density').fill('8')
  await page.locator('#grid-density').dispatchEvent('input')
  await expect(page.locator('#grid-density-value')).toHaveText('8px')
  const denseGrid = await stage.screenshot()
  expect(denseGrid.equals(withGrid)).toBe(false)

  await page.locator('#grid-opacity').fill('0.3')
  await page.locator('#grid-opacity').dispatchEvent('input')
  await expect(page.locator('#grid-opacity-value')).toHaveText('30%')
  const mutedGrid = await stage.screenshot()
  expect(mutedGrid.equals(denseGrid)).toBe(false)

  await page.locator('#grid-toggle').uncheck()
  await expect(page.locator('#status')).toContainText('已隐藏辅助网格')
})

test('editor syncs restored grid switch state on startup', async ({ page }) => {
  await page.route('**/editor/app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        import { startEditorApp } from './editorApp.js'

        document.querySelector('#grid-toggle').checked = true
        document.querySelector('#grid-density').value = '8'
        document.querySelector('#grid-opacity').value = '0.55'

        startEditorApp().catch((error) => {
          console.error(error)
          alert(error.message)
        })
      `,
    })
  })
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')
  await expect(page.locator('#grid-toggle')).toBeChecked()
  await expect(page.locator('#grid-density-value')).toHaveText('8px')
  await expect(page.locator('#grid-opacity-value')).toHaveText('55%')

  const fittedGridStats = await getGridCanvasStats(page)
  expect(fittedGridStats?.averageAlpha).toBeGreaterThan(20)
  expect(fittedGridStats?.strongPixels).toBeGreaterThan(100)
})

test('editor persists view settings across reloads', async ({ page }) => {
  await page.goto('/editor')
  await page.evaluate(() => {
    localStorage.removeItem('node-zsb-editor-settings-v1')
  })
  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')

  await page.locator('#grid-toggle').check()
  await page.locator('#snap-toggle').check()
  await page.locator('#grid-density').fill('8')
  await page.locator('#grid-density').dispatchEvent('input')
  await page.locator('#grid-opacity').fill('0.3')
  await page.locator('#grid-opacity').dispatchEvent('input')
  await page.locator('#zoom-select').fill('1.25')
  await page.locator('#zoom-select').dispatchEvent('input')

  const settings = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('node-zsb-editor-settings-v1') ?? '{}'))
  expect(settings).toMatchObject({
    gridSize: 8,
    showGrid: true,
    snapToGrid: true,
    zoom: 1.25,
    zoomMode: 'manual',
  })
  expect(settings.gridOpacity).toBeCloseTo(0.3)

  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')
  await expect(page.locator('#grid-toggle')).toBeChecked()
  await expect(page.locator('#snap-toggle')).toBeChecked()
  await expect(page.locator('#grid-density-value')).toHaveText('8px')
  await expect(page.locator('#grid-opacity-value')).toHaveText('30%')
  await expect(page.locator('#zoom-select')).toHaveValue('1.25')
  await expect(page.locator('#zoom-value')).toHaveText('125%')

  const fittedGridStats = await getGridCanvasStats(page)
  expect(fittedGridStats?.visiblePixels).toBeGreaterThan(100)
  expect(fittedGridStats?.averageAlpha).toBeGreaterThan(8)
  expect(fittedGridStats?.averageAlpha).toBeLessThan(20)
})

test('editor deselects and deletes objects with keyboard shortcuts', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await page.getByTitle('tank').first().click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)

  await page.keyboard.press('Escape')
  await expect(page.locator('#empty-state')).toBeVisible()
  await expect(page.locator('#layers .layer-row.active')).toHaveCount(0)
  await expect(page.locator('#status')).toContainText('已取消选择')

  await page.locator('#layers .layer-row').first().click()
  await page.keyboard.press('Backspace')
  await expect(page.locator('#layers .layer-row')).toHaveCount(before)
  await expect(page.locator('#status')).toContainText('已删除 tank')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before + 1)
})

test('editor fits the stage and changes zoom levels', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const canvas = page.locator('#stage-host canvas').first()
  await expect(page.locator('#zoom-select')).toHaveAttribute('type', 'range')
  await expect(page.locator('#zoom-value')).toContainText('适配')
  const fittedBox = await canvas.boundingBox()
  expect(fittedBox?.width).toBeLessThan(900)

  await page.locator('#zoom-select').fill('1')
  await page.locator('#zoom-select').dispatchEvent('input')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 100%')
  const fullBox = await canvas.boundingBox()
  expect(fullBox?.width).toBeGreaterThan(1000)

  await page.locator('#zoom-out').click()
  await expect(page.locator('#zoom-select')).toHaveValue('0.75')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 75%')

  await page.locator('#zoom-in').click()
  await expect(page.locator('#zoom-select')).toHaveValue('1')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 100%')

  await page.keyboard.press('Control+=')
  await expect(page.locator('#zoom-select')).toHaveValue('1.25')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 125%')

  await page.keyboard.press('Control+-')
  await expect(page.locator('#zoom-select')).toHaveValue('1')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 100%')

  await page.locator('#zoom-select').fill('0.25')
  await page.locator('#zoom-select').dispatchEvent('input')
  await expect(page.locator('#zoom-select')).toHaveValue('0.25')
  await expect(page.locator('#zoom-out')).toBeDisabled()

  await page.locator('#zoom-select').fill('2')
  await page.locator('#zoom-select').dispatchEvent('input')
  await expect(page.locator('#zoom-select')).toHaveValue('2')
  await expect(page.locator('#zoom-in')).toBeDisabled()

  await page.keyboard.press('Control+0')
  await expect(page.locator('#zoom-value')).toContainText('适配')
  await expect(page.locator('#status')).toContainText('已适配画布视图')

  await page.locator('#fit-stage').click()
  await expect(page.locator('#zoom-value')).toContainText('适配')
  await expect(page.locator('#status')).toContainText('已适配画布视图')
})
