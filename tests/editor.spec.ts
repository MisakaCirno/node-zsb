import { expect, test } from '@playwright/test'

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
  await expect(page.getByRole('button', { name: '导出' })).toBeVisible()

  const canvas = page.locator('#stage-host canvas').first()
  await expect(canvas).toBeVisible()
  const before = await canvas.screenshot()
  expect(before.length).toBeGreaterThan(1_000)

  await page.getByTitle('tank').first().click()
  await expect(page.locator('#object-type')).toHaveValue('tank')

  await page.locator('#object-x').fill('260')
  await page.locator('#object-y').fill('196')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByRole('button', { name: '导出' }).click()
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)

  await page.getByRole('button', { name: '渲染' }).click()
  await expect(page.locator('#preview-image')).toBeVisible()
  await expect(page.locator('#preview-image')).toHaveAttribute(
    'src',
    /\/preview\/[a-f0-9]{64}\.webp/,
  )

  expect(consoleErrors).toEqual([])
})

test('editor renders readable Chinese labels', async ({ page }) => {
  await page.goto('/editor')

  await expect(page).toHaveTitle('战术板编辑器')
  await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  await expect(page.getByRole('button', { name: '导出' })).toBeVisible()
  await expect(page.getByRole('button', { name: '渲染' })).toBeVisible()
  await expect(page.getByPlaceholder('名称')).toBeVisible()
  await expect(page.locator('#layers')).toContainText('tank')
  await expect(page.locator('#layer-count')).not.toHaveText('0')
  await expect(page.locator('.section-title')).toContainText([
    '对象',
    '属性',
    '图层',
    '输出',
  ])
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

  await page.getByRole('button', { name: '导出' }).click()
  await expect(page.locator('#load-code')).toBeDisabled()
  await expect(page.locator('#export-code')).toBeDisabled()
  await expect(page.locator('#render-preview')).toBeDisabled()
  await expect(page.locator('#status')).toContainText('正在导出战术板代码')

  releaseExport()
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)
  await expect(page.locator('#load-code')).toBeEnabled()
  await expect(page.locator('#export-code')).toBeEnabled()
  await expect(page.locator('#render-preview')).toBeEnabled()
})

test('editor imports code, changes background, and edits text and line objects', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const initialCode = await page.locator('#code-input').inputValue()
  await page.locator('#code-input').fill(initialCode)
  await page.getByRole('button', { name: '导入' }).click()

  await page.locator('#background-list [data-background="grey_square"]').click()
  await expect(page.locator('#background-list [data-background="grey_square"]')).toHaveAttribute(
    'aria-checked',
    'true',
  )

  await page.getByRole('button', { name: '形状' }).click()
  await page.getByTitle('text').click()
  await expect(page.locator('#object-type')).toHaveValue('text')
  await page.locator('#object-text').fill('MT')
  await page.locator('#object-color').fill('#00ffcc')
  await expect(page.locator('#layers')).toContainText('text')

  await page.locator('button[title="line"]').click()
  await expect(page.locator('#object-type')).toHaveValue('line')
  await page.locator('#object-end-x').fill('360')
  await page.locator('#object-end-y').fill('240')
  await expect(page.locator('#layers')).toContainText('line')

  await page.getByRole('button', { name: '导出' }).click()
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)

  const exported = await page.locator('#code-output').inputValue()
  await page.locator('#code-input').fill(exported)
  await page.getByRole('button', { name: '导入' }).click()
  await expect(page.locator('#layers')).toContainText('text')
  await expect(page.locator('#layers')).toContainText('line')
})

test('editor drags line endpoints directly on the canvas', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  await page.getByRole('button', { name: '形状' }).click()
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

test('editor reports invalid share code without replacing the board', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')
  const before = await page.locator('#layers').textContent()

  await page.locator('#code-input').fill('[invalid]')
  await page.getByRole('button', { name: '导入' }).click()

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
  await expect(page.locator('#center-object')).toBeDisabled()
  await expect(page.locator('#move-up')).toBeDisabled()
  await expect(page.locator('#move-down')).toBeDisabled()

  await page.locator('#layers .layer-row').first().click()
  await expect(page.locator('#delete-object')).toBeEnabled()
  await expect(page.locator('#duplicate-object')).toBeEnabled()
  await expect(page.locator('#center-object')).toBeEnabled()
  await expect(page.locator('#move-up')).toBeEnabled()
  await expect(page.locator('#move-down')).toBeDisabled()

  await page.locator('#object-locked').check()
  await expect(page.locator('#center-object')).toBeDisabled()

  await page.keyboard.press('Escape')
  await expect(page.locator('#delete-object')).toBeDisabled()
  await expect(page.locator('#duplicate-object')).toBeDisabled()
  await expect(page.locator('#center-object')).toBeDisabled()
})

test('editor clears the board with confirmation and undo support', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const before = await page.locator('#layers .layer-row').count()
  await expect(page.locator('#layer-count')).toHaveText(String(before))
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
  await expect(page.locator('#layer-count')).toHaveText('0')
  await expect(page.locator('#empty-state')).toBeVisible()
  await expect(page.locator('#clear-board')).toBeDisabled()
  await expect(page.locator('#delete-object')).toBeDisabled()
  await expect(page.locator('#status')).toContainText('已清空画板')

  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('#layers .layer-row')).toHaveCount(before)
  await expect(page.locator('#layer-count')).toHaveText(String(before))
  await expect(page.locator('#clear-board')).toBeEnabled()
})

test('editor saves, loads, and deletes local browser board slots', async ({
  page,
}) => {
  await page.goto('/editor')
  await page.evaluate(() =>
    localStorage.removeItem('node-zsb-editor-local-boards-v1'),
  )
  await page.reload()
  await expect(page.locator('#layers')).toContainText('tank')
  await expect(page.locator('#local-board-select')).toContainText('暂无本地存档')
  await expect(page.locator('#load-local-board')).toBeDisabled()
  await expect(page.locator('#delete-local-board')).toBeDisabled()

  await page.locator('#board-name').fill('本地草稿')
  await page.locator('#board-name').dispatchEvent('change')
  await page.locator('#save-local-board').click()
  await expect(page.locator('#status')).toContainText('已保存到浏览器本地存储')
  await expect(page.locator('#local-board-select')).toContainText('本地草稿')
  await expect(page.locator('#load-local-board')).toBeEnabled()
  await expect(page.locator('#delete-local-board')).toBeEnabled()

  await page.locator('#board-name').fill('临时修改')
  await page.locator('#board-name').dispatchEvent('change')
  await page.locator('#load-local-board').click()
  await expect(page.locator('#board-name')).toHaveValue('本地草稿')
  await expect(page.locator('#status')).toContainText('已读取本地存档 本地草稿')

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('删除本地存档')
    await dialog.accept()
  })
  await page.locator('#delete-local-board').click()
  await expect(page.locator('#local-board-select')).toContainText('暂无本地存档')
  await expect(page.locator('#load-local-board')).toBeDisabled()
  await expect(page.locator('#delete-local-board')).toBeDisabled()
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

  await firstLayer.locator('[data-action="hidden"]').click()
  await expect(page.locator('#object-hidden')).toBeChecked()
  await expect(firstLayer).toHaveClass(/muted/)

  await firstLayer.locator('[data-action="locked"]').click()
  await expect(page.locator('#object-locked')).toBeChecked()
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

  await page.getByRole('button', { name: '形状' }).click()
  await page.getByTitle('text').click()
  await expect(page.locator('[data-field="text"]')).toBeVisible()
  await expect(page.locator('[data-field="line"]')).toBeHidden()

  await page.locator('button[title="line"]').click()
  await expect(page.locator('[data-field="line"]')).toBeVisible()
  await expect(page.locator('[data-field="text"]')).toBeHidden()

  await page.locator('#layers .layer-row').filter({ hasText: 'tank' }).first().click()
  await page.getByRole('button', { name: '导出' }).click()
  await expect(page.locator('#code-output')).toHaveValue(/\[stgy:/)
  const code = await page.locator('#code-output').inputValue()
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

test('editor snaps positions to the grid and centers the selected object', async ({
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

  await page.getByRole('button', { name: '居中' }).click()
  await expect(page.locator('#object-x')).toHaveValue('256')
  await expect(page.locator('#object-y')).toHaveValue('192')
  await expect(page.locator('#status')).toContainText('已居中选中对象')
})

test('editor toggles the visual grid overlay', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.locator('#layers')).toContainText('tank')

  const stage = page.locator('#stage-host')
  const before = await stage.screenshot()

  await page.locator('#grid-toggle').check()
  await expect(page.locator('#status')).toContainText('已显示辅助网格')
  const withGrid = await stage.screenshot()
  expect(withGrid.equals(before)).toBe(false)

  await page.locator('#grid-toggle').uncheck()
  await expect(page.locator('#status')).toContainText('已隐藏辅助网格')
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
  await expect(page.locator('#zoom-select')).toHaveValue('fit')
  const fittedBox = await canvas.boundingBox()
  expect(fittedBox?.width).toBeLessThan(900)

  await page.locator('#zoom-select').selectOption('1')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 100%')
  const fullBox = await canvas.boundingBox()
  expect(fullBox?.width).toBeGreaterThan(1000)

  await page.locator('#zoom-out').click()
  await expect(page.locator('#zoom-select')).toHaveValue('0.75')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 75%')

  await page.keyboard.press('Control+=')
  await expect(page.locator('#zoom-select')).toHaveValue('1')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 100%')

  await page.keyboard.press('Control+-')
  await expect(page.locator('#zoom-select')).toHaveValue('0.75')
  await expect(page.locator('#status')).toContainText('已设置画布缩放 75%')

  await page.keyboard.press('Control+0')
  await expect(page.locator('#zoom-select')).toHaveValue('fit')
  await expect(page.locator('#status')).toContainText('已适配画布视图')

  await page.locator('#fit-stage').click()
  await expect(page.locator('#zoom-select')).toHaveValue('fit')
  await expect(page.locator('#status')).toContainText('已适配画布视图')
})
