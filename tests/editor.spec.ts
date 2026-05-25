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

test('editor imports code, changes background, and edits text and line objects', async ({
  page,
}) => {
  await page.goto('/editor')

  const initialCode = await page.locator('#code-input').inputValue()
  await page.locator('#code-input').fill(initialCode)
  await page.getByRole('button', { name: '导入' }).click()

  await page.locator('#background-select').selectOption('grey_square')
  await expect(page.locator('#background-select')).toHaveValue('grey_square')

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
