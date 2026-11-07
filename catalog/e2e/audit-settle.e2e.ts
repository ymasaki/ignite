import { expect, test } from './test'
import { setCatalogTime, CATALOG_TIME } from './clock'
import { prepareOfflinePage } from '../../audit/network'
import { waitForVisualState } from '../../audit/settle'

test('CSSの遅延開始と終了時に連鎖する動きを待ち、最終位置を測れる', async ({ page }) => {
  await page.setContent(`<style>
    @keyframes move { from { transform: translateX(0) } to { transform: translateX(100px) } }
    #box { width:20px;height:20px;animation:move .15s linear .15s forwards }
  </style><div id="box"></div>`)
  await page.evaluate(() => {
    const box = document.querySelector('#box')!
    box.addEventListener('animationend', () => {
      box.animate([{ width: '20px' }, { width: '70px' }], { duration: 150, fill: 'forwards' })
    }, { once: true })
  })
  await waitForVisualState(page)
  const box = await page.locator('#box').boundingBox()
  expect(box!.x).toBeCloseTo(108, 0)
  expect(box!.width).toBeCloseTo(70, 0)
})

test('キャンセル後に始まる有限アニメーションも待ち、無限アニメーションは待たない', async ({ page }) => {
  await page.setContent('<div id="box">対象</div><div id="spinner">読み込み</div>')
  await page.evaluate(() => {
    document.querySelector('#spinner')!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, iterations: Infinity })
    const box = document.querySelector('#box')!
    const first = box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 10000 })
    first.oncancel = () => { box.animate([{ opacity: 0 }, { opacity: 0.5 }], { duration: 150, fill: 'forwards' }) }
    setTimeout(() => first.cancel(), 100)
  })
  await waitForVisualState(page)
  expect(await page.locator('#box').evaluate((el) => getComputedStyle(el).opacity)).toBe('0.5')
  expect(await page.evaluate(() => document.getAnimations().some((a) => a.effect?.getComputedTiming().iterations === Infinity && a.playState === 'running'))).toBe(true)
})

test('幅変更で始まるtransitionを待ち、動きがない画面もそのまま測れる', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await page.setContent('<style>#box{width:100px;height:20px;transition:width .2s} @media(max-width:600px){#box{width:200px}}</style><div id="box"></div>')
  await waitForVisualState(page)
  expect((await page.locator('#box').boundingBox())!.width).toBe(100)
  await page.setViewportSize({ width: 500, height: 600 })
  await waitForVisualState(page)
  expect((await page.locator('#box').boundingBox())!.width).toBe(200)
})

test('有限アニメーションが終わらなければ10秒の全体期限で失敗する', async ({ page }) => {
  await page.setContent('<div id="box">対象</div>')
  await page.evaluate(() => { document.querySelector('#box')!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 60000 }) })
  await expect(waitForVisualState(page)).rejects.toThrow('監査の描画待ちが10秒を超えました')
})

test('フォントの準備待ちにも10秒の全体期限を適用する', async ({ page }) => {
  await page.setContent('<div>対象</div>')
  await page.evaluate(() => { Object.defineProperty(document.fonts, 'ready', { value: new Promise(() => {}) }) })
  await expect(waitForVisualState(page)).rejects.toThrow('監査の描画待ちが10秒を超えました')
})

test('フレーム待ちが止まっても10秒の全体期限で失敗する', async ({ page }) => {
  await page.setContent('<div>対象</div>')
  await page.evaluate(() => { window.requestAnimationFrame = () => 1 })
  await expect(waitForVisualState(page)).rejects.toThrow('監査の描画待ちが10秒を超えました')
})


test('部品の確認と独自タッチcontextも外部取得を固定する', async ({ page, browser }) => {
  const response = await page.goto('https://example.invalid/offline-fixture')
  expect((await response!.body()).subarray(1, 4).toString()).toBe('PNG')
  const context = await browser.newContext({ hasTouch: true, isMobile: true })
  try {
    const touch = await context.newPage()
    await prepareOfflinePage(touch)
    const reply = await touch.goto('https://example.invalid/touch-fixture')
    expect((await reply!.body()).subarray(1, 4).toString()).toBe('PNG')
  } finally { await context.close() }
})


test('既存の通知と同じ8秒の有限アニメーションも最後まで待つ', async ({ page }) => {
  await page.setContent('<div id="box">更新通知</div>')
  await page.evaluate(() => { document.querySelector('#box')!.animate([{ opacity: 0 }, { opacity: 0.5 }], { duration: 8000, fill: 'forwards' }) })
  await waitForVisualState(page)
  expect(await page.locator('#box').evaluate((el) => getComputedStyle(el).opacity)).toBe('0.5')
})

test('監査の日時は通常pageと独自contextで固定し、タイマーは動かす', async ({ page, browser }) => {
  expect(await page.evaluate(() => Date.now())).toBe(new Date(CATALOG_TIME).getTime())
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)))
  expect(await page.evaluate(() => Date.now())).toBe(new Date(CATALOG_TIME).getTime())
  const context = await browser.newContext()
  try {
    const touch = await context.newPage()
    await setCatalogTime(touch)
    expect(await touch.evaluate(() => Date.now())).toBe(new Date(CATALOG_TIME).getTime())
  } finally { await context.close() }
})
