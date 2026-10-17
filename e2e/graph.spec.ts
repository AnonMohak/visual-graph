import { expect, test, type Page } from '@playwright/test'

const canvas = (page: Page) => page.locator('canvas:not(.hidden)')

async function addEquation(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'equation' })
  await input.fill(text)
  await input.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test('adds an equation to the legend', async ({ page }) => {
  await addEquation(page, 'sin(x)/x')
  await expect(page.getByRole('button', { name: /sin\(x\)\/x/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'equation' })).toHaveValue('')
})

test('shows a parse error and adds nothing', async ({ page }) => {
  await addEquation(page, 'sin(x')
  await expect(page.getByText('missing closing )')).toBeVisible()
  await expect(page.getByRole('button', { name: 'hide all' })).toHaveCount(0)
})

test('creates sliders for free parameters', async ({ page }) => {
  await addEquation(page, 'a*sin(b*x)')
  await expect(page.getByRole('slider', { name: 'a value' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'b value' })).toBeVisible()
})

test('undo removes the last equation', async ({ page }) => {
  await addEquation(page, 'x^2')
  await page.getByRole('textbox', { name: 'equation' }).blur()
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('button', { name: 'hide all' })).toHaveCount(0)
})

test('share link restores the equations', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await addEquation(page, 'x^3 - 3x')
  await page.getByRole('button', { name: 'share' }).click()
  await expect(page.getByText('copied')).toBeVisible()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toContain('#z')

  const fresh = await context.newPage()
  await fresh.goto('/')
  await fresh.evaluate(() => window.localStorage.clear())
  await fresh.goto(url)
  await expect(fresh.getByRole('button', { name: /x\^3 - 3x/ })).toBeVisible()
})

test('wheel zoom changes the rendered view', async ({ page }) => {
  await addEquation(page, 'sin(x)')
  const box = await canvas(page).boundingBox()
  if (!box) throw new Error('no canvas')
  const before = await canvas(page).screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -600)
  await page.mouse.move(box.x + 5, box.y + 5)
  await expect.poll(async () => Buffer.compare(before, await canvas(page).screenshot())).not.toBe(0)
})

test('embed mode hides the editing UI', async ({ page }) => {
  await addEquation(page, 'cos(x)')
  await page.goto('/?embed=1')
  await expect(page.getByRole('textbox', { name: 'equation' })).toHaveCount(0)
  await expect(page.getByText('open in Graph')).toBeVisible()
})

test('canvas is keyboard navigable and described for screen readers', async ({ page }) => {
  await addEquation(page, 'x^2')
  await canvas(page).focus()
  const before = await canvas(page).screenshot()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('+')
  await expect.poll(async () => Buffer.compare(before, await canvas(page).screenshot())).not.toBe(0)
  await expect(page.locator('#graph-description')).toContainText('x^2: y from')
})

test('ships a web app manifest and service worker', async ({ page, request }) => {
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  expect((await request.get('/manifest.webmanifest')).ok()).toBe(true)
  expect((await request.get('/sw.js')).ok()).toBe(true)
})
