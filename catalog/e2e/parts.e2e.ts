import { writeFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './test'

// axe に見えない動きのある操作（DESIGN.md 12 章）。キーボードだけで使えること、フォーカスの行き先、日本語の入力の確定

const open = async (page: import('@playwright/test').Page, nav: string) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/?nav=${nav}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30000 })
  await expect(page.locator('#boot')).toHaveCount(0)
}

test('Dialog: 開くと中へ移り、Tab は外へ出ず、Esc で閉じて元へ戻る', async ({ page }) => {
  await open(page, 'feedback')
  const opener = page.getByRole('button', { name: '窓を開く' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '名前を変える' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('textbox', { name: '新しい名前' })).toBeFocused()
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => !!document.activeElement?.closest('dialog') || document.activeElement === document.body)
    expect(inside).toBe(true)
  }
  await page.getByRole('textbox', { name: '新しい名前' }).focus()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('CodeBlock: 全角は半角 2 桁にそろい、コピーは元のコードで、はみ出す欄はキーボードで送れる', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, 'code')
  const grid = page.locator('figure.cb', { hasText: '桁の確認' })
  const rights = await grid.locator('.cb-ln').evaluateAll((ls) => ls.map((l) => {
    const r = document.createRange()
    r.selectNodeContents(l.querySelector('span:last-child')!)
    return r.getBoundingClientRect().right
  }))
  for (const r of rights) expect(Math.abs(r - rights[0])).toBeLessThan(0.5)

  const numbered = page.locator('figure.cb', { hasText: 'retry.ts' })
  await numbered.getByRole('button', { name: 'retry.tsをコピー' }).click()
  await expect(numbered.getByRole('button', { name: 'コピーしました' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied.startsWith('// 失敗したら')).toBe(true)
  expect(copied).toContain('\n  throw new Error')

  const log = page.getByRole('region', { name: 'sync.log' })
  await log.focus()
  await expect(log).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
})

test('Dialog: 中のプルダウンを Esc で閉じても、窓は閉じない', async ({ page }) => {
  await open(page, 'feedback')
  await page.getByRole('button', { name: '窓を開く' }).click()
  await page.getByRole('button', { name: /^権限/ }).click()
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('ConfirmDialog: 危険な確定は、はじめのフォーカスが取り消しにあり、確定すると結果を知らせる', async ({ page }) => {
  await open(page, 'feedback')
  await page.getByRole('button', { name: '削除する' }).click()
  const box = page.getByRole('alertdialog')
  await expect(box.getByRole('button', { name: 'やめる' })).toBeFocused()
  await box.getByRole('button', { name: '削除する' }).click()
  await expect(box).toHaveCount(0)
  await expect(page.locator('.toast', { hasText: '1件削除しました' })).toBeVisible()
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.locator('.toast', { hasText: '元に戻しました' })).toBeVisible()
})

test('Toast: 失敗の知らせは自動で消えず、× で閉じる。完了の知らせは載せているあいだ消えない', async ({ page }) => {
  await page.clock.install()
  await open(page, 'feedback')
  await page.getByRole('button', { name: '失敗を知らせる' }).click()
  await page.getByRole('button', { name: '完了を知らせる' }).click()
  const ok = page.locator('.toast.ok')
  await ok.hover()
  await page.clock.runFor(10000)
  await expect(ok).toBeVisible()
  await page.mouse.move(10, 10)
  await page.clock.runFor(6000)
  await expect(ok).toHaveCount(0)
  const bad = page.locator('.toast.danger')
  await expect(bad).toBeVisible()
  await bad.getByRole('button', { name: '知らせを閉じる' }).click()
  await expect(bad).toHaveCount(0)
})

test('Menu: ↑↓ で移り、押せない項目を飛ばし、Enter で実行して元のボタンへ戻る', async ({ page }) => {
  await open(page, 'actions')
  const btn = page.getByRole('button', { name: '操作', exact: true })
  await btn.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: '編集する' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: '削除する' })).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(btn).toBeFocused()
  await expect(page.locator('.toast', { hasText: '複製しました' })).toBeVisible()
})

test('Combobox: 打って絞り、↓ と Enter で選ぶ。変換の確定の Enter では選ばない。空にすると選択を外す', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('combobox', { name: '拠点' })
  await box.fill('京')
  await expect(page.getByRole('option')).toHaveText(['東京', '京都'])
  // 変換中の Enter（isComposing）では閉じない
  await box.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })))
  await expect(page.getByRole('listbox')).toBeVisible()
  // Safari は確定の Enter を isComposing なしの keyCode 229 で送る。これでも選ばない
  await box.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 229 })))
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(box).toHaveValue('京')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(box).toHaveValue('京都')
  await box.fill('')
  await page.keyboard.press('Tab')
  await expect(box).toHaveValue('')
})

test('DatePicker: 矢印と PageDown で動かし、Enter で選んでボタンへ戻る', async ({ page }) => {
  await open(page, 'forms')
  const btn = page.getByRole('button', { name: /^期限/ })
  await btn.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '2026年10月15日 木曜日', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('PageDown')
  await expect(page.getByRole('button', { name: '2026年11月16日 月曜日', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(btn).toHaveAccessibleName(/^期限: (2026\/)?11\/16$/)
  await expect(btn).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('grid')).toHaveCount(0)
  await expect(btn).toBeFocused()
})

test('NumberField: 全角の数字を読み、離すと上限へ収め、↑↓ で増減する', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('spinbutton', { name: '人数' })
  await box.fill('１２')
  await box.blur()
  await expect(box).toHaveValue('10')
  await box.focus()
  await page.keyboard.press('ArrowDown')
  await expect(box).toHaveValue('9')
  const rate = page.getByRole('spinbutton', { name: '割合' })
  await rate.focus()
  await page.keyboard.press('ArrowUp')
  await expect(rate).toHaveValue('0.6')
})

test('NumberField: − ＋・外からの変更で変えた直後だけ数字を回し、打ち込むと欄の文字に戻る', async ({ page }) => {
  await open(page, 'forms')
  const input = page.getByRole('spinbutton', { name: '人数' })
  const box = input.locator('..')
  const before = Number(await input.inputValue())
  await page.getByRole('button', { name: '人数を増やす' }).click()
  await expect(box).toHaveClass(/rolling/)
  await expect(input).toHaveAttribute('aria-valuenow', String(before + 1))
  // 回る数字は飾り（読み上げは欄の値）。欄の文字は透明にして重ねた数字を見せる
  await expect(box.locator('.nf-roll')).toHaveAttribute('aria-hidden', 'true')
  expect(await input.evaluate((el) => getComputedStyle(el).color)).toBe('rgba(0, 0, 0, 0)')
  // しばらくで欄の文字に戻る
  await expect(box).not.toHaveClass(/rolling/, { timeout: 2000 })
  await page.getByRole('button', { name: '人数を減らす' }).click()
  await expect(box).toHaveClass(/rolling/)
  // 欄の文字を選んで打ち替える（macOS では End で行末へ移らないので、選んでから打つ）
  await input.selectText()
  await input.pressSequentially('7')
  await expect(box).not.toHaveClass(/rolling/)
  await expect(input).toHaveValue('7')
  // 打ち込んで確定した値は回さない
  await input.blur()
  await expect(input).toHaveAttribute('aria-valuenow', '7')
  await expect(box).not.toHaveClass(/rolling/)
  // 外から値を変えても回す（部品の外のボタンなど）
  await page.getByRole('button', { name: '人数を 5 にする' }).click()
  await expect(box).toHaveClass(/rolling/)
  await expect(input).toHaveAttribute('aria-valuenow', '5')
})

test('FormField: エラーを出すと欄の補足として読まれ、見出しを押すと欄へ移る', async ({ page }) => {
  await open(page, 'forms')
  await page.getByRole('button', { name: '保存する' }).click()
  const box = page.getByRole('textbox', { name: '名前' })
  await expect(box).toHaveAttribute('aria-invalid', 'true')
  await expect(box).toHaveAccessibleDescription(/名前を入れてください/)
  await page.getByText('拠点', { exact: true }).click()
  await expect(page.getByRole('combobox', { name: '拠点' })).toBeFocused()
})

test('Checkbox・Switch・RadioGroup: キーボードで切り替わる', async ({ page }) => {
  await open(page, 'forms')
  const check = page.getByRole('checkbox', { name: 'お知らせを受け取る' })
  await check.focus()
  await page.keyboard.press('Space')
  await expect(check).toBeChecked()
  const sw = page.getByRole('switch', { name: 'すぐに通知する' })
  await sw.focus()
  await page.keyboard.press('Space')
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  const std = page.getByRole('radio', { name: /標準/ })
  await std.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: /大容量/ })).toBeChecked()
})

test('Popover: 下で切れる位置では上に開き、見える範囲に収まる', async ({ page }) => {
  await open(page, 'forms')
  const btn = page.getByRole('button', { name: /^期限/ })
  // ボタンを枠の下端へ寄せる
  await btn.evaluate((el) => el.scrollIntoView({ block: 'end' }))
  await btn.click()
  const r = await page.locator('.datepicker .popover-body').evaluate((el) => { const b = el.getBoundingClientRect(); const c = el.closest('.cat')!.getBoundingClientRect(); return { up: el.classList.contains('up'), top: b.top - c.top, bottom: c.bottom - b.bottom } })
  expect(r.up).toBe(true)
  expect(r.top).toBeGreaterThanOrEqual(0)
  expect(r.bottom).toBeGreaterThanOrEqual(0)
})

test('DataTable: 見出しを押すと並び順が読み上げに出て、すべて選ぶが効く', async ({ page }) => {
  await open(page, 'data')
  const table = page.getByRole('table', { name: '並べ替えと選択' })
  const head = table.getByRole('columnheader', { name: '名前' })
  await expect(head).toHaveAttribute('aria-sort', 'none')
  await head.getByRole('button').click()
  await expect(head).toHaveAttribute('aria-sort', 'ascending')
  const all = table.getByRole('checkbox', { name: 'すべて選ぶ' })
  await all.click()
  await expect(all).toBeChecked()
  await all.click()
  await expect(table.getByRole('checkbox', { checked: true })).toHaveCount(0)
})

test('DataTable: 階層の表は、スクロールしても見出しと上位の行を上に積み、系統が変わると入れ替える', async ({ page }) => {
  await open(page, 'data')
  const table = page.getByRole('table', { name: '作業の階層' })
  const sc = table.locator('xpath=..')
  await table.scrollIntoViewIfNeeded()
  // 行 name が、積んだ行の下（流れる行の先頭）に来るまで枠をスクロールし、積んだ行の名前・位置と見出しの位置を返す
  const scrollTo = (name: string) => sc.evaluate((el, name) => {
    const rows = [...el.querySelectorAll('tbody tr')] as HTMLElement[]
    const target = rows.find((r) => r.querySelector('th')!.textContent!.startsWith(name))!
    const head = el.querySelector('thead')!.getBoundingClientRect().height
    const box = el.getBoundingClientRect().top
    const at = () => target.getBoundingClientRect().top - box + el.scrollTop
    const n = (target.getAttribute('style')?.match(/--depth:\s*(\d+)/)?.[1] ?? '0') as string
    el.scrollTop = at() - head - Number(n) * target.getBoundingClientRect().height
  }, name)
  // 固定するのはセルなので、行の位置は行見出しのセルで測る（tr は元の位置に残る）
  const state = () => sc.evaluate((el) => {
    const box = el.getBoundingClientRect().top
    const stuck = [...el.querySelectorAll('tbody tr.stuck')].map((r) => ({ name: r.querySelector('th')!.textContent!.replace(/（.*$/, ''), top: Math.round(r.querySelector('th')!.getBoundingClientRect().top - box), h: Math.round(r.querySelector('th')!.getBoundingClientRect().height) }))
    return { scrolled: el.scrollTop, head: Math.round(el.querySelector('thead th')!.getBoundingClientRect().top - box), headH: Math.round(el.querySelector('thead th')!.getBoundingClientRect().height), stuck }
  })
  // スクロール前は何も積まない
  expect((await state()).stuck).toEqual([])
  await scrollTo('聞き取りの日程')
  await expect.poll(async () => (await state()).stuck.map((r) => r.name)).toEqual(['ウェブサイトの刷新', '調査', '利用者の聞き取り'])
  const s1 = await state()
  expect(s1.scrolled).toBeGreaterThan(0)
  // 見出しは枠の上端に残り、積んだ行は見出しの下に隙間なく並ぶ
  expect(s1.head).toBe(0)
  let y = s1.headH
  for (const r of s1.stuck) {
    expect(Math.abs(r.top - y)).toBeLessThanOrEqual(1)
    y = r.top + r.h
  }
  // 別の系統まで進むと、上位の行が入れ替わる
  await scrollTo('主な画面の下書き')
  await expect.poll(async () => (await state()).stuck.map((r) => r.name)).toEqual(['ウェブサイトの刷新', '設計', '画面の設計'])
  // 積んだ行の最後にだけ影を付ける
  await expect(table.locator('tr.stuck-last')).toHaveCount(1)
  await expect(table.locator('tr.stuck-last th')).toHaveText(/^画面の設計/)
})

test('DataTable: ホバーは行見出しを含む行全体の地を変え、選んだ行は灰色にしない', async ({ page }) => {
  await open(page, 'data')
  const table = page.getByRole('table', { name: '並べ替えと選択' })
  const bgs = (row: import('@playwright/test').Locator) => row.locator(':scope > th, :scope > td').evaluateAll((els) => els.map((el) => `${getComputedStyle(el).backgroundColor} ${getComputedStyle(el).backgroundImage}`))
  // 選んでいない行: 行見出しも含めて同じ地になる
  const row = table.locator('tbody tr:not(.sel)').first()
  await page.mouse.move(0, 0)
  const idle = await bgs(row)
  await row.locator(':scope > th').hover()
  const hovered = await bgs(row)
  expect(new Set(hovered).size).toBe(1)
  expect(hovered[0]).not.toBe(idle[0])
  // 選んだ行: 灰色を重ねず、選択中のホバーの地に変える
  const sel = table.locator('tbody tr.sel').first()
  await expect(sel).toHaveCount(1)
  await page.mouse.move(0, 0)
  const selIdle = await bgs(sel)
  await sel.locator(':scope > th').hover()
  const selHover = await bgs(sel)
  expect(new Set(selHover).size).toBe(1)
  expect(selHover[0]).not.toContain('gradient')
  expect(selHover[0]).not.toBe(selIdle[0])
})

test('Menu: 開く矢印は文字の中央にそろい、開いている間は吹き出しを出さない', async ({ page }) => {
  await open(page, 'actions')
  const menu = page.getByRole('button', { name: '操作', exact: true })
  const mid = (r: { top: number; height: number }) => r.top + r.height / 2
  const [btn, chev] = await menu.evaluate((el) => [el.getBoundingClientRect().toJSON(), el.querySelector('svg')!.getBoundingClientRect().toJSON()])
  expect(Math.abs(mid(chev) - mid(btn))).toBeLessThanOrEqual(1)
  const more = page.getByRole('button', { name: 'その他の操作' })
  const tip = () => more.evaluate((el) => getComputedStyle(el, '::after').display)
  await more.hover()
  await expect.poll(tip).toBe('block')
  await more.click()
  await expect(page.getByRole('menu', { name: 'その他の操作' })).toBeVisible()
  await expect.poll(tip).toBe('none')
})

test('吹き出し: 窓の端ではみ出す分だけ寄せる（左メニューのつまみを広げても畳んでも、下に出て窓に収まる）', async ({ page }) => {
  await open(page, 'actions')
  const tipBox = (name: string) => page.getByRole('button', { name, exact: true }).evaluate((el) => {
    const s = getComputedStyle(el, '::after')
    const r = el.getBoundingClientRect()
    // ::after は測れないので、置き場所（left は親からの距離）・出る動き（transform）・寄せ（translate）と幅から窓の中の位置を出す
    const moved = s.transform.startsWith('matrix') ? new DOMMatrix(s.transform).m41 : 0
    const left = r.left + el.clientLeft + parseFloat(s.left) + moved + (parseFloat(s.translate) || 0)
    return { display: s.display, left, right: left + parseFloat(s.width) + parseFloat(s.paddingLeft) + parseFloat(s.paddingRight), top: r.top + parseFloat(s.top), handleBottom: r.bottom, vw: document.documentElement.clientWidth }
  })
  for (const name of ['メニューを折りたたむ', 'メニューを広げる']) {
    const handle = page.getByRole('button', { name, exact: true })
    await handle.hover()
    await expect.poll(async () => (await tipBox(name)).display).toBe('block')
    await page.waitForTimeout(500)
    const b = await tipBox(name)
    expect(b.left).toBeGreaterThanOrEqual(8 - 0.5)
    expect(b.right).toBeLessThanOrEqual(b.vw - 8 + 0.5)
    expect(b.top).toBeGreaterThan(b.handleBottom) // 向きは変えず、下に出す
    if (name === 'メニューを折りたたむ') {
      await handle.click()
      await expect(page.getByRole('button', { name: 'メニューを広げる', exact: true })).toBeVisible()
      await page.mouse.move(640, 600)
      await page.waitForTimeout(500)
    }
  }
})

test('CopyText: 狭い入れ物でも値とコピーのアイコンが重ならない', async ({ page }) => {
  await open(page, 'actions')
  const ct = page.getByRole('button', { name: 'ignite 名前をコピー' })
  await ct.hover()
  const r = await ct.evaluate((el) => { const v = el.querySelector('.ct-v')!; return { textEnd: v.getBoundingClientRect().left + v.scrollWidth, icon: el.querySelector('.ct-i')!.getBoundingClientRect().left } })
  expect(r.textEnd).toBeLessThanOrEqual(r.icon + 0.5)
})

test('Pagination: 番号を押すと移り、端では前後のボタンが押せない', async ({ page }) => {
  await open(page, 'navigate')
  const nav = page.getByRole('navigation', { name: 'ページ送り' })
  await nav.getByRole('button', { name: '1ページ目' }).click()
  await expect(nav.getByRole('button', { name: '1ページ目' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('button', { name: '前のページ' })).toBeDisabled()
})

test('連続で押しても、確定と取り消しの操作は 1 回だけ実行する', async ({ page }) => {
  await open(page, 'feedback')
  await page.getByRole('button', { name: '確定を確かめる' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '公開する' }).dblclick()
  await expect(page.locator('.toast', { hasText: '公開しました' })).toHaveCount(1)
  await page.getByRole('button', { name: '削除する' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '削除する' }).click()
  await page.getByRole('button', { name: '元に戻す' }).dblclick()
  await expect(page.locator('.toast', { hasText: '元に戻しました' })).toHaveCount(1)
})

test('Dialog: 閉じる途中に開き直しても、開いたまま操作できる', async ({ page }) => {
  await open(page, 'feedback')
  await page.getByRole('button', { name: '窓を開く' }).click()
  await page.getByRole('button', { name: '閉じてすぐ開き直す' }).click()
  await page.waitForTimeout(500)
  await expect(page.locator('dialog.dialog:not(.closing)')).toBeVisible()
  // そのまま打ち続けられる（fill はフォーカスを移してしまうので、先に確かめて type で打つ）
  await expect(page.getByRole('textbox', { name: '新しい名前' })).toBeFocused()
  await page.keyboard.type('a')
  await expect(page.getByRole('textbox', { name: '新しい名前' })).toHaveValue('a')
})

test('動きを減らす設定: Dialog がすぐ閉じ、閉じると同時に出した知らせも読み上げに届く', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 'feedback')
  const opener = page.getByRole('button', { name: '確定を確かめる' })
  await opener.click()
  await page.getByRole('alertdialog').getByRole('button', { name: '公開する' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(page.locator('body > [aria-live]')).toHaveText('公開しました')
})

test('閉じる動きのあとでも、閉じると同時に出した知らせは読み上げに届く', async ({ page }) => {
  await open(page, 'feedback')
  await page.getByRole('button', { name: '確定を確かめる' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '公開する' }).click()
  await expect(page.locator('body > [aria-live]')).toHaveText('公開しました')
})

test('Toast: 載せるのをやめてもフォーカスがあるあいだは消えない', async ({ page }) => {
  await page.clock.install()
  await open(page, 'feedback')
  await page.getByRole('button', { name: '完了を知らせる' }).click()
  const ok = page.locator('.toast.ok')
  await ok.hover()
  await ok.getByRole('button', { name: '知らせを閉じる' }).focus()
  await page.mouse.move(10, 10)
  await page.clock.runFor(10000)
  await expect(ok).toBeVisible()
  await page.getByRole('button', { name: '完了を知らせる' }).focus()
  await page.clock.runFor(6000)
  await expect(ok).toHaveCount(0)
})

test('Toaster: 重ねた左メニューと詳細のあいだは操作できず、詳細を閉じても左メニューの分は残る', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/?nav=list')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30000 })
  const inert = () => page.locator('.toasts').evaluate((el) => (el as HTMLElement).inert)
  await expect.poll(inert).toBe(false)
  // 詳細を開く → 閉じる: 戻る
  await page.locator('.erow').first().click()
  await expect(page.locator('.drawer')).toBeVisible()
  await expect.poll(inert).toBe(true)
  await page.locator('.drawer .ph button[aria-label="詳細を閉じる"]').click()
  await expect(page.locator('.drawer')).toHaveCount(0)
  await expect.poll(inert).toBe(false)
  // 左メニューを開く → ブラウザの戻るで詳細が重なる → 詳細を閉じる: 左メニューの分は残る
  await page.locator('.ttl-menu').click()
  await expect.poll(inert).toBe(true)
  await page.goBack()
  await expect(page.locator('.drawer')).toBeVisible()
  await page.locator('.drawer .ph button[aria-label="詳細を閉じる"]').dispatchEvent('click')
  await expect(page.locator('.drawer')).toHaveCount(0)
  await expect.poll(inert).toBe(true)
})

test('知らせの置き場所を決めたあとで Dialog が閉じても、読み上げに届く', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 'feedback')
  await page.getByRole('button', { name: '窓を開く' }).click()
  await page.getByRole('button', { name: '知らせてから閉じる' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('body > [aria-live]')).toHaveText('名前を控えました')
})

test('Dialog: 閉じた状態から開いた長い本文も、キーボードで送れる', async ({ page }) => {
  await open(page, 'feedback')
  await page.getByRole('button', { name: '長い本文の窓' }).click()
  const body = page.locator('.dlg-body')
  await expect(body).toHaveAttribute('tabindex', '0')
  await expect(body).toHaveAttribute('role', 'region')
  await expect(body).toHaveAccessibleName('利用の条件')
})

test('Select: 開いているあいだに親が描き直しても、今の項目から動かない', async ({ page }) => {
  await page.clock.install()
  await open(page, 'forms')
  await page.getByRole('button', { name: /^並び順/ }).click()
  await page.keyboard.press('ArrowDown')
  const opt = page.getByRole('option', { name: /名前の順/ })
  await expect(opt).toBeFocused()
  await page.clock.runFor(2000)
  await expect(opt).toBeFocused()
})

for (const [label, role, name, error] of [['スイッチ', 'switch', '同意', '同意してください'], ['プルダウン', 'button', /^担当/, '担当を選んでください'], ['日付', 'button', /^開始日/, '開始日を選んでください']] as const) {
  test(`focusFirstInvalid: ${label}のエラーが読み上げに伝わり、そこへ移る`, async ({ page }) => {
    await open(page, 'forms')
    const el = page.getByRole(role, { name })
    await expect(el).toHaveAttribute('aria-invalid', 'true')
    await expect(el).toHaveAccessibleDescription(new RegExp(error))
    await page.getByRole('button', { name: `${label}のエラーへ移る` }).click()
    await expect(el).toBeFocused()
  })
}

test('DatePicker: 範囲の端で止まり、フォーカスを見失わない', async ({ page }) => {
  await open(page, 'forms')
  await page.getByRole('button', { name: /^期限/ }).click()
  await page.keyboard.press('Shift+PageUp')
  await expect(page.getByRole('button', { name: '2026年1月1日 木曜日', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('button', { name: '2026年1月1日 木曜日', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('grid')).toHaveAttribute('aria-label', '2026年1月')
  await expect(page.getByRole('button', { name: '2026年1月1日 木曜日', exact: true })).toBeFocused()
})

test('NumberField: 変換中の矢印では増減しない。打っている途中に外の値が変わると、外の値を優先する', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('spinbutton', { name: '人数' })
  await box.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, isComposing: true })))
  await expect(box).toHaveValue('3')
  await box.fill('8')
  await expect(box).toHaveAttribute('aria-valuenow', '8')
  // 欄を離れずに、外から値を変える
  await page.getByRole('button', { name: '人数を 5 にする' }).dispatchEvent('click')
  await expect(box).toHaveValue('5')
  await expect(box).toHaveAttribute('aria-valuenow', '5')
  await box.blur()
  await expect(box).toHaveValue('5')
})

test('focusFirstInvalid: ラジオのエラーへ移る', async ({ page }) => {
  await open(page, 'forms')
  await page.getByRole('textbox', { name: '名前' }).fill('佐藤')
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByRole('radio', { name: 'メール' })).toBeFocused()
  await expect(page.getByRole('radiogroup', { name: '通知先' })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('radiogroup', { name: '通知先' })).toHaveAccessibleDescription(/通知先を選んでください/)
})

test('Combobox: 開いたまま候補が増えて下で切れるなら、上へ開き直す', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('combobox', { name: '拠点' })
  await box.evaluate((el) => el.scrollIntoView({ block: 'end' }))
  await box.fill('那覇')
  await expect(page.getByRole('option')).toHaveCount(1)
  await box.fill('')
  await expect(page.getByRole('option')).toHaveCount(11)
  await expect(page.locator('.combo .popover-body')).toHaveClass(/up/)
})

test('Menu: 開いているあいだに親が描き直しても、今の項目から動かない', async ({ page }) => {
  await page.clock.install()
  await open(page, 'actions')
  await page.getByRole('button', { name: '操作', exact: true }).click()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: '複製する' })).toBeFocused()
  await page.clock.runFor(2000)
  await expect(page.getByRole('menuitem', { name: '複製する' })).toBeFocused()
})

test('Accordion: キーボードで開閉し、既定は 1 つだけ開く', async ({ page }) => {
  await open(page, 'navigate')
  const a = page.getByRole('button', { name: /^概要 3件/ })
  const b = page.getByRole('button', { name: /^履歴/ })
  await expect(a).toHaveAttribute('aria-expanded', 'true')
  await b.focus()
  await page.keyboard.press('Enter')
  await expect(b).toHaveAttribute('aria-expanded', 'true')
  await expect(a).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Space')
  await expect(b).toHaveAttribute('aria-expanded', 'false')
})

test('RadioGroup: どれも選んでいないときは塗らない', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('radiogroup', { name: '通知先' }).locator('.check-box').first()
  const panel = await page.locator('.board').evaluate((el) => getComputedStyle(el).backgroundColor)
  await expect(box).toHaveCSS('background-color', panel)
})

test('PasswordField: 打った文字を確かめられ、送ると伏せた形へ戻る', async ({ page }) => {
  await open(page, 'login')
  const field = page.getByRole('textbox', { name: 'パスワード' })
  const toggle = page.getByRole('button', { name: 'パスワードを表示' })
  await field.fill('secret')
  await expect(field).toHaveAttribute('type', 'password')
  await expect(field).toHaveAttribute('autocomplete', 'current-password')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(field).toHaveAttribute('type', 'text')
  await field.focus()
  await page.keyboard.press('Enter')
  await expect(field).toHaveAttribute('type', 'password')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('LoginForm: 空で送ると最初の欄へ移り、直すとエラーが消える', async ({ page }) => {
  await open(page, 'login')
  await page.getByRole('button', { name: 'ログインする' }).click()
  const id = page.getByRole('textbox', { name: 'メールアドレス' })
  await expect(id).toBeFocused()
  await expect(page.getByText('メールアドレスを入れてください')).toBeVisible()
  await expect(page.getByText('パスワードを入れてください')).toBeVisible()
  await id.fill('abc')
  await expect(id).not.toHaveAttribute('aria-invalid', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByText('メールアドレスの形で入れてください')).toBeVisible()
})

test('LoginForm: 処理中は重ねて送らず、失敗するとパスワードの欄へ移って知らせる', async ({ page }) => {
  await open(page, 'login')
  await page.getByRole('textbox', { name: 'メールアドレス' }).fill('a@example.com')
  const password = page.getByRole('textbox', { name: 'パスワード' })
  await password.fill('secret')
  await page.keyboard.press('Enter')
  const submit = page.getByRole('button', { name: 'ログインする' })
  await expect(submit).toHaveAttribute('aria-busy', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: '違います' })).toBeVisible()
  await expect(password).toBeFocused()
  await expect(submit).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('textbox', { name: 'メールアドレス' })).toHaveValue('a@example.com')
})

test('LoginForm: キーボードの順は入力欄から再設定を通って送信へ進む', async ({ page }) => {
  await open(page, 'login')
  await page.getByRole('textbox', { name: 'メールアドレス' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: 'パスワード' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'パスワードを表示' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('checkbox', { name: 'ログインしたままにする' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'パスワードを再設定する' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'ログインする' })).toBeFocused()
})

test('AuthScreen: 低い窓では画面の中をスクロールして主ボタンまで届く', async ({ page }) => {
  await open(page, 'login')
  await page.setViewportSize({ width: 720, height: 300 })
  const screen = page.locator('.auth-screen')
  await expect(page.locator('.auth-name')).toBeInViewport()
  await page.getByRole('button', { name: 'ログインする' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'ログインする' })).toBeInViewport()
  expect(await screen.evaluate((el) => el.scrollTop > 0 && document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('LoginForm: 外部認証のボタンは主ボタンの下に並び、Enter では送らない', async ({ page }) => {
  await open(page, 'login')
  await page.getByRole('button', { name: '外部認証あり' }).click()
  for (const name of ['Google', 'Apple', 'Okta']) await expect(page.getByRole('button', { name: `${name} でログインする` })).toBeVisible()
  await page.getByRole('button', { name: 'Google でログインする' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('メールアドレスを入れてください')).toHaveCount(0)
})

test('SideNav: 押すと選択中の地がその場で次の項目に付き、項目の間を動かない', async ({ page }) => {
  await open(page, 'color')
  const nav = page.getByRole('navigation', { name: 'メインメニュー' })
  const color = nav.getByRole('button', { name: '色' })
  const dash = nav.getByRole('button', { name: 'ダッシュボード' })
  await expect(color).toHaveAttribute('aria-current', 'page')
  await expect(nav.locator('.thumb')).toHaveCount(0)
  const soft = await color.evaluate((el) => getComputedStyle(el).backgroundColor)
  await dash.click()
  await page.mouse.move(0, 0)
  await expect(dash).toHaveAttribute('aria-current', 'page')
  expect(await dash.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).transitionProperty])).toEqual([soft, expect.not.stringMatching(/background|all/)])
  expect(await color.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(soft)
})

test('SideNav: 畳んだ左メニューのアイコンにホバーすると、名前の吹き出しが右に切れずに出る', async ({ page }) => {
  await open(page, 'color')
  await page.getByRole('button', { name: 'メニューを折りたたむ' }).click()
  await expect(page.locator('.app.side-min-done')).toHaveCount(1)
  const nav = page.getByRole('navigation', { name: 'メインメニュー' })
  for (const item of [nav.getByRole('button', { name: '色' }), page.getByRole('button', { name: '設定', exact: true })]) {
    await item.hover()
    await expect.poll(() => item.evaluate((el) => getComputedStyle(el, '::after').content)).toBe(`"${await item.getAttribute('aria-label')}"`)
    // 吹き出しはボタンの右の外に描くので、ボタンから左メニューまでのどれもはみ出しを切り取らない
    const clipped = await item.evaluate((el) => {
      const side = el.closest('.side')!
      const out: string[] = []
      for (let n: Element | null = el; n && n !== side.parentElement; n = n.parentElement) {
        const s = getComputedStyle(n)
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') out.push(n.className || n.tagName)
      }
      return out
    })
    expect(clipped).toEqual([])
  }
})

test('部品の検索: 選ぶとそのページの標本へ移り、目次で別の標本へ移れる', async ({ page }) => {
  await open(page, 'overview')
  await page.getByRole('combobox', { name: '部品を探す' }).fill('Pagination')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('切り替えと移動')
  await expect(page.locator('[data-spec="pagination"]')).toBeInViewport()
  await page.getByRole('navigation', { name: 'このページの目次' }).getByRole('button', { name: '開閉の並び' }).click()
  await expect(page.locator('[data-spec="accordion"]')).toBeInViewport()
})

test('テーマ: ヘッダーから切り替えると、その場で色が変わる', async ({ page }) => {
  await open(page, 'actions')
  await page.getByRole('button', { name: 'テーマを変える' }).click()
  await page.getByRole('group', { name: 'テーマカラー' }).getByRole('button', { name: '青' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'blue')
})

// 実際に動いた View Transition の長さを window.__fade に残す（走らなければ undefined のまま）
const recordFade = (page: import('@playwright/test').Page) => page.addInitScript(() => {
  const start = Document.prototype.startViewTransition
  Document.prototype.startViewTransition = function (this: Document, cb: () => void) {
    const t = start.call(this, cb)
    ;(window as unknown as { __fade: Promise<number[]> }).__fade = t.ready.then(() => document.getAnimations()
      .filter((a) => (a.effect as KeyframeEffect).pseudoElement?.startsWith('::view-transition'))
      .map((a) => Number(a.effect?.getTiming().duration)))
    return t
  } as typeof start
})
const fadeDurations = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __fade?: Promise<number[]> }).__fade ?? null)
const pickDark = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'テーマを変える' }).click()
  await page.getByRole('group', { name: '表示モード' }).getByRole('button', { name: 'ダーク' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
}

test('テーマ: ライトとダークの切り替えは 0.3s でフェードする', async ({ page }) => {
  await recordFade(page)
  await open(page, 'actions')
  await pickDark(page)
  expect(await fadeDurations(page)).toContain(300)
})

test('テーマ: 動きを減らす設定ではフェードせず、すぐ切り替わる', async ({ page }) => {
  await recordFade(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 'actions')
  await pickDark(page)
  expect(await fadeDurations(page)).toBeNull()
})

test('KPI: 押すと絞り込みのタグが出て、× で外せる', async ({ page }) => {
  await open(page, 'dashboard')
  await page.getByRole('button', { name: /^進行中/ }).first().click()
  const chip = page.getByRole('button', { name: '絞り込みを外す' })
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(chip).toHaveCount(0)
})

test('SearchSuggest: かな・カタカナ・ローマ字で絞り、見出しと件数を出す', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('combobox', { name: '人やプロジェクトを探す' })
  for (const q of ['佐藤', 'さとう', 'サトウ', 'ｻﾄｳ', 'sato', 'SATOU']) {
    await box.fill(q)
    await expect(page.getByRole('option', { name: /佐藤 葵/ }), q).toBeVisible()
  }
  await expect(page.getByRole('group', { name: 'メンバー 1件' })).toBeVisible()
  await box.fill('たかはし')
  await expect(page.getByRole('option', { name: /高橋 結/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /佐藤 葵/ })).toHaveCount(0)
  await box.fill('zzz')
  await expect(page.getByText('該当するものがありません')).toBeVisible()
})

test('SearchSuggest: ↑↓ と Enter で選び、変換の確定の Enter では選ばない。Esc は候補だけを閉じる', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('combobox', { name: '人やプロジェクトを探す' })
  await box.fill('さ')
  const first = page.getByRole('option').first()
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(box).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!)
  await box.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })))
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(box).toBeFocused()
  await expect(box).toHaveValue('さ')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.locator('.toast').first()).toContainText('を開きました')
  await expect(box).toBeFocused()
})

test('SearchSuggest: 一覧の下の操作はキーボードでも押せて、範囲が広がる', async ({ page }) => {
  await open(page, 'forms')
  const box = page.getByRole('combobox', { name: '人やプロジェクトを探す' })
  await box.fill('たなか')
  await expect(page.getByRole('option', { name: /田中 蓮/ })).toHaveCount(0)
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('option', { name: /完了も含めて探す/ })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('option', { name: /田中 蓮/ })).toBeVisible()
  await expect(box).toBeFocused()
})

test('SearchSuggest: F で画面の主な検索欄へ移り、入力中の F は文字になる', async ({ page }) => {
  await open(page, 'list')
  const box = page.getByRole('combobox', { name: '部品を探す' })
  await page.keyboard.press('f')
  await expect(box).toBeFocused()
  await expect(box).toHaveValue('')
  await page.keyboard.press('f')
  await expect(box).toHaveValue('f')
})

test('PanelHeader: 任意のボタンを置け、タブは見出しの 16px 下で、スクロールすると固定ヘッダーからも押せる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/?nav=list&open=p1')
  await expect(page.locator('.prof-n')).toBeVisible({ timeout: 30000 })
  const panel = page.locator('.pwrap')
  await expect(panel.locator('.ph').getByRole('button', { name: '編集する' })).toBeVisible()
  const [top, kicker] = await Promise.all([panel.locator('.ph').boundingBox(), panel.locator('.prof-k').boundingBox()])
  expect(top!.y + top!.height).toBeLessThanOrEqual(kicker!.y)
  const gap = await panel.evaluate((el) => el.querySelector(':scope > .tabs')!.getBoundingClientRect().top - el.querySelector('.prof')!.getBoundingClientRect().bottom)
  expect(gap).toBe(16)
  const stick = panel.locator('.pstick')
  await expect(stick).not.toHaveClass(/\bon\b/)
  await panel.evaluate((el) => { el.closest('.panel, .drawer')!.scrollTop = 400 })
  await expect(stick).toHaveClass(/\bon\b/)
  const name = stick.locator('.pstick-t b')
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
  await expect(stick.getByRole('button', { name: '編集する' })).toHaveAttribute('data-tip', '編集する')
  await stick.getByRole('button', { name: '編集する' }).click()
  await expect(page.getByText('編集を開きました')).toBeVisible()
})

test('CollapseInline: 閉じると幅が 0 になり、中の操作へ Tab で入らない', async ({ page }) => {
  await open(page, 'motion')
  const box = page.locator('.collapse-x')
  const toggle = page.locator('[data-spec="inline"]').getByRole('switch')
  await expect(box.getByRole('button', { name: '拡大' })).toBeVisible()
  await toggle.click()
  await expect.poll(() => box.evaluate((el) => el.getBoundingClientRect().width)).toBe(0)
  await expect(box).toHaveAttribute('inert', '')
  await toggle.focus()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('.collapse-x'))).toBe(false)
})

test('useFitCount: 枠が低くなると数え直し、入らない分を「+N」にまとめる', async ({ page }) => {
  await open(page, 'data')
  const rail = page.locator('.cat-rail')
  await expect(rail.getByRole('button')).toHaveCount(5)
  await page.locator('[data-spec="sideparts"] .seg').getByText('低い').click()
  await expect(rail.getByRole('button')).toHaveCount(3)
  await expect(rail.getByRole('button', { name: /^ほか 4 件$/ })).toBeVisible()
})

test('DatePicker: 幅の広いフォームでも外枠を日付の表に合わせる', async ({ page }, info) => {
  await open(page, 'forms')
  await page.setViewportSize({ width: 1600, height: 1000 })
  const opener = page.getByRole('button', { name: /^期限/ }).first()
  await opener.click()
  const body = page.locator('.datepicker .popover-body')
  await expect(body).toBeVisible()
  const sizes = await body.evaluate(el => {
    const css = getComputedStyle(el)
    return {
      host: el.parentElement!.getBoundingClientRect().width,
      panel: el.getBoundingClientRect().width,
      content: el.querySelector('table')!.getBoundingClientRect().width,
      edges: parseFloat(css.paddingLeft) + parseFloat(css.paddingRight) + parseFloat(css.borderLeftWidth) + parseFloat(css.borderRightWidth),
    }
  })
  await body.screenshot({ path: info.outputPath('datepicker-wide.png') })
  expect(sizes.host).toBeGreaterThan(400)
  expect(Math.abs(sizes.panel - sizes.content - sizes.edges)).toBeLessThan(1)
  await body.getByRole('button', { name: '選択を外す' }).click()
  await expect(opener).toBeFocused()
  await expect(opener).toContainText('日付を選ぶ')
  await opener.click()
  await body.getByRole('button', { name: '今日' }).click()
  await expect(opener).toBeFocused()
  await expect(opener).toContainText('10/30')
})

for (const [width, height] of [[320, 568], [568, 320], [844, 390]]) {
  test(`DatePicker: ${width}×${height} でも月の見出しと下端の操作が窓の中に見える`, async ({ page }) => {
    await open(page, 'forms')
    await page.setViewportSize({ width, height })
    await page.getByRole('button', { name: /^期限/ }).first().click()
    const body = page.locator('.datepicker .popover-body')
    await expect(body).toBeVisible()
    await page.waitForTimeout(300)
    const box = (await body.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(height)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    await expect(body.getByRole('button', { name: /2026年10月15日/ })).toBeVisible()
    await expect(body.getByRole('button', { name: '前の月' })).toBeInViewport()
    await body.getByRole('button', { name: '今日' }).scrollIntoViewIfNeeded()
    await expect(body.getByRole('button', { name: '今日' })).toBeInViewport()
  })
}

for (const width of [320, 360, 600, 860]) {
  test(`AppShell: 検索欄なしの${width}pxでは範囲を詰めて絞り込みを1段目に保つ`, async ({ page }, info) => {
    await open(page, 'header')
    await page.setViewportSize({ width, height: 800 })
    await page.evaluate(() => document.fonts.ready)
    const title = page.locator('.ttl')
    const tools = page.locator('.sbar')
    await expect.poll(async () => Math.abs((await title.boundingBox())!.y - (await tools.boundingBox())!.y)).toBeLessThan(2)
    const company = page.locator('.ttl .select-btn')
    const filter = tools.getByRole('button', { name: '絞り込み' })
    await expect(company).toBeVisible()
    await expect(company).toHaveAccessibleName('対象: 対象 285名')
    await expect(filter).toBeVisible()
    const [choice, button] = await Promise.all([company.boundingBox(), filter.boundingBox()])
    expect(choice!.x + choice!.width).toBeLessThanOrEqual(button!.x)
    expect(button!.x + button!.width).toBeLessThanOrEqual(width)
    expect(await page.locator('.ttl .sel-label').innerText()).toBe('対象')
    await expect.poll(() => page.locator('.ttl .sel-label').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    if (width === 320) await page.screenshot({ path: info.outputPath('header-320.png') })
    // 行数だけでなく選択・操作が使えることも保つ。
    await company.click()
    await page.getByRole('option', { name: /長い名前の対象/ }).click()
    await expect.poll(async () => Math.abs((await title.boundingBox())!.y - (await tools.boundingBox())!.y)).toBeLessThan(2)
    await filter.click()
    await expect(page.getByText('絞り込みを開きました')).toBeVisible()
  })
}

test('AppShell: 検索ありは狭い幅で2段・広い幅で1段を保ち、検索欄の左端が内容にそろう', async ({ page }) => {
  await open(page, 'list')
  await page.setViewportSize({ width: 320, height: 800 })
  const title = page.locator('.ttl')
  const search = page.locator('.sbar.has-search')
  await expect.poll(async () => (await search.boundingBox())!.y - (await title.boundingBox())!.y).toBeGreaterThan(30)
  const content = page.locator('.content').first()
  expect(Math.abs((await search.boundingBox())!.x - (await content.boundingBox())!.x - await content.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft)))).toBeLessThan(2)
  await page.setViewportSize({ width: 860, height: 800 })
  await expect.poll(async () => {
    const a = (await search.boundingBox())!, b = (await title.boundingBox())!
    return Math.abs(a.y + a.height / 2 - b.y - b.height / 2)
  }).toBeLessThan(2)
})

test('レスポンシブ表示: つまみの ← → と区切りのボタンで幅が変わり、中の画面がその幅で組み直る', async ({ page }) => {
  await open(page, 'responsive')
  const grip = page.getByRole('separator', { name: '表示の幅' })
  const inner = () => page.frames().find((f) => f.url().includes('open=p1'))!
  await expect.poll(() => inner()?.evaluate(() => innerWidth)).toBe(1180)
  await grip.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(grip).toHaveAttribute('aria-valuenow', '1170')
  await page.keyboard.press('Shift+ArrowLeft')
  await expect(grip).toHaveAttribute('aria-valuenow', '1070')
  await page.keyboard.press('Home')
  await expect(grip).toHaveAttribute('aria-valuenow', '320')
  await expect.poll(() => inner().evaluate(() => innerWidth)).toBe(320)
  await page.getByRole('button', { name: /^1440/ }).click()
  await expect(grip).toHaveAttribute('aria-valuenow', '1440')
  await expect.poll(() => inner().evaluate(() => innerWidth)).toBe(1440)
  await expect(page.getByText('広げて並べる')).toBeVisible()
  await page.getByRole('button', { name: /^600/ }).click()
  await expect(page.getByText('引き出し（メニューのボタンで開く）')).toBeVisible()
})

// グラフの確認口は実際に Tab で到達し、読み上げ名と同じ値を吹き出しに出す。
for (const [name, selector] of [
  ['横棒', '.bl'], ['折れ線', '.line-hits > span'], ['積み上げ', '.sc-col'],
  ['小さな推移線', '.spark'], ['ファネル', '.fn-step'], ['タイル', '.tm-tile'],
  ['縦棒', '[data-spec="column"] .plot-hits > span'], ['円の凡例', '.pie-legend li'],
  ['ゲージ', '.gauge'], ['滝', '[data-spec="waterfall"] .plot-hits > span'],
  ['散布図', '.xy-pt'], ['レーダー', '.radar-l'], ['ヒートマップ', '.hm-c'],
  ['箱ひげ', '[data-spec="box"] .plot-hits > span'],
  ['複合グラフ', '[data-spec="combo"] .plot-hits > span'],
  ['ヒストグラムのゼロ', '[data-spec="histogram"] .plot-hits > span'],
  ['複数系列の縦棒', '[data-spec="column"] .cat-case:nth-child(2) .plot-hits > span'],
  ['負の数の縦棒', '[data-spec="column"] .cat-case:nth-child(3) .plot-hits > span'],
  ['バブル', '[data-spec="scatter"] .cat-case:nth-child(2) .xy-pt'],
  ['カレンダーのヒートマップ', '[data-spec="heatmap"] .cat-case:nth-child(2) .hm-c'],
]) {
  test(`グラフ共通: ${name} のホバー・Tab・離脱・Esc`, async ({ page }) => {
    await open(page, 'charts')
    const item = page.locator(selector).first()
    await item.scrollIntoViewIfNeeded()
    // 読み上げと同じ文字（aria-hidden の中、回る数字の 0〜9 の帯は除く）
    const text = await item.evaluate(el => el.getAttribute('aria-labelledby')?.split(/\s+/).map(id => { const c = document.getElementById(id)?.cloneNode(true) as Element | undefined; c?.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove()); return c?.textContent }).join('　') || el.getAttribute('data-chart-tip'))
    expect(text).toBeTruthy()
    await item.hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toHaveText(text!)
    await expect(tip).toBeVisible()
    // 隠された祖先にフォーカスを置かない。
    expect(await item.evaluate(el => !!el.closest('[aria-hidden="true"]'))).toBe(false)
    await page.mouse.move(0, 0)
    await expect(tip).toHaveCount(0)
    // 一度対象へ移り、Shift+Tab→Tab で実際の順方向到達を確認する。
    await item.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(item).toBeFocused()
    await expect(item).toHaveAccessibleName(name === '横棒' ? text! : (await item.getAttribute('aria-label'))!)
    await expect(tip).toHaveText(text!)
    await page.keyboard.press('Escape')
    await expect(tip).toHaveCount(0)
    await page.keyboard.press('Tab')
    await expect(item).not.toBeFocused()
  })
}

// 吹き出しが出ている状態を監査する。閉じた初期画面だけでは body portal の回帰を検出できない。
for (const width of [600, 375]) {
  test(`グラフ共通: ${width}px で表示中の吹き出しを元のランドマークに保つ`, async ({ page }) => {
    await open(page, 'charts')
    await page.setViewportSize({ width, height: 800 })
    for (const selector of ['.bl', '.spark']) {
      const item = page.locator(selector).first()
      await item.scrollIntoViewIfNeeded()
      const tip = page.getByRole('tooltip')
      for (const action of ['hover', 'focus'] as const) {
        await item[action]()
        await expect(tip).toBeVisible()
        expect(await tip.evaluate(el => el.closest('main') !== null)).toBe(true)
        await expect(item).toHaveAccessibleName((await tip.textContent())!)
        const result = await new AxeBuilder({ page }).withRules(['region']).analyze()
        expect(result.violations).toEqual([])
        expect(await tip.evaluate(el => el.matches(':popover-open'))).toBe(true)
        // top layer 上の本文へ移動しても読め、外へ離れると閉じる。
        if (action === 'hover') {
          await tip.hover()
          await page.waitForTimeout(200)
          await expect(tip).toBeVisible()
          await page.mouse.move(0, 0)
        } else {
          await page.keyboard.press('Escape')
        }
        await expect(tip).toHaveCount(0)
      }
    }
    // 旧配置を作ると region が検出されることも確認する（例外や aria-hidden で隠さない）。
    await page.keyboard.press('Tab')
    await page.locator('.spark').first().focus()
    const tip = page.getByRole('tooltip')
    await expect(tip).toBeVisible()
    await tip.evaluate(el => { document.body.append(el); (el as HTMLElement).showPopover() })
    const broken = await new AxeBuilder({ page }).withRules(['region']).analyze()
    expect(broken.violations.map(v => v.id)).toContain('region')
  })
}

test('グラフ共通: 通常画面の切り抜き枠からも吹き出しが切れずに出る', async ({ page }) => {
  await open(page, 'charts')
  const item = page.locator('.gauge').first()
  await item.scrollIntoViewIfNeeded()
  await item.evaluate(el => {
    const root = el.closest('.chart-tooltip-root')!
    const clip = document.createElement('div')
    clip.style.cssText = 'overflow:hidden;width:20px;height:20px;contain:paint'
    root.before(clip)
    clip.append(root)
  })
  await item.focus()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  expect(await tip.evaluate(el => {
    const r = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
  })).toBe(true)
})

test('グラフ共通: 円の区分・ドーナツ・値なしゲージ・選択を保つ', async ({ page }, testInfo) => {
  await open(page, 'charts')
  await page.evaluate(() => document.fonts.ready)
  const pies = page.locator('.pie')
  for (let i = 0; i < 2; i++) {
    const pie = pies.nth(i), slice = pie.locator('.pie-s').first()
    await pie.scrollIntoViewIfNeeded()
    const fig = (await pie.locator('svg').boundingBox())!
    await page.mouse.move(fig.x + fig.width * 0.85, fig.y + fig.height * 0.45)
    await expect(page.getByRole('tooltip')).toContainText(i ? '完了' : '問い合わせ')
    await expect(slice).toHaveClass(/on/)
    if (i === 0) {
      await expect(page.getByRole('tooltip')).toHaveCSS('opacity', '1')
      await page.screenshot({ path: testInfo.outputPath('pie.png') })
    }
    await page.mouse.move(0, 0)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await pie.locator('li').first().focus()
    await expect(slice).toHaveClass(/on/)
  }
  const none = page.locator('.gauge').last()
  await none.focus()
  await expect(page.getByRole('tooltip')).toContainText('値なし')
  await expect(none).toHaveAttribute('role', 'img')
  const tile = page.locator('.tm-tile').first()
  await tile.focus()
  await page.keyboard.press('Enter')
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
})

test('グラフ共通: 窓の端とスクロール枠、Dialog の前面に出て Esc は吹き出しから閉じる', async ({ page }, testInfo) => {
  await open(page, 'charts')
  await page.getByRole('button', { name: '窓の中でグラフを確認' }).click()
  const dialog = page.getByRole('dialog', { name: 'グラフの値の確認' })
  const gauge = dialog.locator('.gauge')
  await gauge.hover()
  await expect(page.getByRole('tooltip')).toContainText('目標 80%')
  await expect(page.getByRole('tooltip')).toHaveCSS('opacity', '1')
  await page.screenshot({ path: testInfo.outputPath('gauge.png') })
  await page.mouse.move(0, 0)
  await gauge.focus()
  await expect(page.getByRole('tooltip')).toContainText('範囲 0〜100%')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  const cell = dialog.locator('.hm-c').last()
  await cell.focus()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  expect(await tip.evaluate(el => !!el.closest('dialog'))).toBe(true)
  expect((await new AxeBuilder({ page }).withRules(['region']).analyze()).violations).toEqual([])
  expect(await tip.evaluate(el => el.matches(':popover-open'))).toBe(true)
  const rect = await tip.boundingBox()
  expect(rect!.x).toBeGreaterThanOrEqual(8)
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(1272)
  expect(rect!.y).toBeGreaterThanOrEqual(8)
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(792)
  // top layer は実際の座標でも最前面にある。
  expect(await tip.evaluate(el => {
    const r = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
  })).toBe(true)
  await dialog.locator('.hm-scroll').evaluate(el => { el.style.width = '180px' })
  await dialog.locator('.hm-scroll').evaluate(el => { el.scrollLeft = 30 })
  await expect(tip).toHaveCount(0)
  await dialog.locator('.pie-legend li').first().focus()
  await expect(tip).toContainText('完了')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('グラフ共通: 狭い窓の長い吹き出し・ダークモード・リサイズ・同時表示', async ({ page }) => {
  await open(page, 'charts')
  await page.setViewportSize({ width: 420, height: 700 })
  await page.evaluate(() => { document.documentElement.dataset.mode = 'dark' })
  const item = page.locator('.fn-step').last()
  await item.scrollIntoViewIfNeeded()
  // resize 通知とカタログの段組みの描き直しを済ませてからフォーカスする。
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await item.focus()
  const tip = page.getByRole('tooltip')
  await expect(tip).toContainText('最初から')
  await expect(tip).toBeVisible()
  const r = await tip.boundingBox()
  expect(r!.x).toBeGreaterThanOrEqual(8)
  expect(r!.x + r!.width).toBeLessThanOrEqual(412)
  await page.setViewportSize({ width: 430, height: 700 })
  await expect(tip).toHaveCount(0)
  const gauge = page.locator('.gauge').first()
  await gauge.hover()
  await expect(tip).toHaveCount(1)
  await expect(tip).toContainText('目標')
  await page.evaluate(() => { document.documentElement.dataset.tips = 'off' })
  await expect(tip).not.toBeVisible()
})

test('グラフ共通: レーダーは面の中でもポインタの向きの項目の内訳を出す', async ({ page }) => {
  await open(page, 'charts')
  const fig = page.locator('[data-spec="radar"] .plot').first()
  await fig.scrollIntoViewIfNeeded()
  const labels = fig.locator('.radar-l')
  const n = await labels.count()
  const tip = page.getByRole('tooltip')
  // 図の中心から各項目の向きへ、輪の内側（半径の 4 割）にポインタを置く。頂点や線の上でなくても出る。
  const spot = (i: number, f: number) => fig.evaluate((el, [i, n, f]) => {
    const svg = el.querySelector('svg')!.getBoundingClientRect()
    const ring = [...el.querySelectorAll('.plot-ring')].at(-1)!.getBoundingClientRect()
    const r = Math.max(ring.width, ring.height) / 2, a = (i / n) * Math.PI * 2
    const cx = svg.left + svg.width / 2, cy = svg.top + svg.height / 2
    return { x: cx + r * f * Math.sin(a), y: cy - r * f * Math.cos(a) }
  }, [i, n, f] as const)
  for (let i = 0; i < n; i++) {
    const p = await spot(i, 0.4)
    await page.mouse.move(p.x, p.y, { steps: 3 })
    await expect(tip).toHaveText((await labels.nth(i).getAttribute('data-chart-tip'))!)
    await expect(labels.nth(i)).toHaveAttribute('data-chart-on', '')
    await expect(tip).toBeVisible()
  }
  // 面と線をまたいで別の項目へ動いても閉じずに移る
  const a = await spot(0, 0.7), b = await spot(1, 0.7)
  await page.mouse.move(a.x, a.y)
  await expect(tip).toContainText('速さ')
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await expect(tip).toHaveText((await labels.nth(1).getAttribute('data-chart-tip'))!)
  await expect(labels.nth(0)).not.toHaveAttribute('data-chart-on', '')
  // 輪の外（図の隅）へ出ると閉じる
  const box = (await fig.locator('svg').boundingBox())!
  await page.mouse.move(box.x + 4, box.y + 4, { steps: 4 })
  await expect(tip).toHaveCount(0)
  await expect(fig.locator('[data-chart-on]')).toHaveCount(0)
  await labels.first().focus()
  await expect(tip).toContainText('今期 4')
})

test('グラフ共通: 散布図は点の近くでも一番近い点の値を出し、離れると閉じる', async ({ page }) => {
  await open(page, 'charts')
  const fig = page.locator('[data-spec="scatter"] .plot').first()
  await fig.scrollIntoViewIfNeeded()
  const tip = page.getByRole('tooltip')
  // 点の縁から 12px 外の位置と、そこで一番近い点（縁からの距離）を求める
  const near = await fig.evaluate(el => {
    const pts = [...el.querySelectorAll<HTMLElement>('.xy-pt')].map(p => { const b = p.getBoundingClientRect(); return { p, x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 } })
    const dist = (x: number, y: number) => pts.map(q => ({ q, d: Math.hypot(x - q.x, y - q.y) - q.r })).sort((a, b) => a.d - b.d)[0]
    for (const q of pts) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, x = q.x + (q.r + 12) * Math.cos(a), y = q.y + (q.r + 12) * Math.sin(a)
      const best = dist(x, y)
      if (best.q === q && document.elementFromPoint(x, y)?.closest('.xy-pt') == null) return { x, y, text: q.p.getAttribute('data-chart-tip') }
    }
    return null
  })
  expect(near).not.toBeNull()
  await page.mouse.move(near!.x, near!.y, { steps: 3 })
  await expect(tip).toHaveText(near!.text!)
  await expect(tip).toBeVisible()
  await expect(fig.locator('.xy-pt[data-chart-on]')).toHaveCount(1)
  // どの点からも 32px より遠い場所では出さない
  const far = await fig.evaluate(el => {
    const svg = el.querySelector('svg')!.getBoundingClientRect()
    const pts = [...el.querySelectorAll<HTMLElement>('.xy-pt')].map(p => p.getBoundingClientRect())
    for (let y = svg.top + 30; y < svg.bottom - 40; y += 8) for (let x = svg.left + 50; x < svg.right - 20; x += 8)
      if (pts.every(b => Math.hypot(x - b.left - b.width / 2, y - b.top - b.height / 2) - b.width / 2 > 40)) return { x, y }
    return null
  })
  expect(far).not.toBeNull()
  await page.mouse.move(far!.x, far!.y, { steps: 4 })
  await expect(tip).toHaveCount(0)
  await expect(fig.locator('[data-chart-on]')).toHaveCount(0)
})

test('グラフ共通: 表示中の値の更新に追随し、対象の削除で閉じる', async ({ page }) => {
  await open(page, 'charts')
  const item = page.locator('.gauge').first()
  await item.focus()
  const tip = page.getByRole('tooltip')
  await expect(tip).toContainText('72%')
  await item.evaluate(el => el.setAttribute('data-chart-tip', '更新後 81%'))
  await expect(tip).toHaveText('更新後 81%')
  await item.evaluate(el => el.remove())
  await expect(tip).toHaveCount(0)
})

test('グラフ共通: 点から余白を経由して外へ移動しても吹き出しが残らない', async ({ page }) => {
  await open(page, 'charts')
  const plot = page.locator('[data-spec="scatter"] .plot').first()
  await plot.locator('.xy-pt').first().hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  const r = (await plot.boundingBox())!
  await page.mouse.move(r.x + 10, r.y + 10)
  await page.mouse.move(0, 0)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('グラフ共通: Esc 後のポインタ離脱で復活せず、次の Esc で窓が閉じる', async ({ page }) => {
  await open(page, 'charts')
  await page.getByRole('button', { name: '窓の中でグラフを確認' }).click()
  const dialog = page.getByRole('dialog', { name: 'グラフの値の確認' })
  const item = dialog.locator('.gauge')
  await item.focus()
  await item.hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.mouse.move(0, 0)
  // 離脱の猶予時間を越えて復活しないことを確認する。
  await page.waitForTimeout(200)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('グラフ共通: 吹き出しが無効なら見えない対象で Esc を消費しない', async ({ page }) => {
  await open(page, 'charts')
  await page.getByRole('button', { name: '窓の中でグラフを確認' }).click()
  const dialog = page.getByRole('dialog', { name: 'グラフの値の確認' })
  await dialog.locator('.gauge').focus()
  await page.evaluate(() => { document.documentElement.dataset.tips = 'off' })
  await expect(page.getByRole('tooltip')).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('グラフ共通: 円の別区分から離れるとフォーカス中の凡例と区分を再び強調する', async ({ page }) => {
  await open(page, 'charts')
  const pie = page.locator('.pie').first()
  const first = pie.locator('li').first(), second = pie.locator('li').nth(1)
  await first.focus()
  await second.hover()
  await expect(second).toHaveClass('on')
  await page.mouse.move(0, 0)
  await expect(first).toBeFocused()
  await expect(first).toHaveClass('on')
  await expect(pie.locator('.pie-s').first()).toHaveClass(/on/)
  await expect(page.getByRole('tooltip')).toContainText('問い合わせ')
})

for (const nav of ['charts', 'dashboard']) {
  test(`グラフ共通: ${nav} の値の確認口に適切な読み上げの役割がある`, async ({ page }) => {
    await open(page, nav)
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
    expect(result.violations).toEqual([])
    for (const el of await page.locator('[data-chart-tip][tabindex="0"]').all()) {
      const role = await el.getAttribute('role')
      expect(['img', 'meter', 'listitem', 'button']).toContain(role)
    }
    if (nav === 'charts') {
      await expect(page.locator('.tm-tile').first()).toHaveRole('button')
      // 図の役割を落とした場合は、今回の違反を確実に検出する。
      await page.locator('.line-hits > span').first().evaluate(el => el.removeAttribute('role'))
      const broken = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
      expect(broken.violations.map(v => v.id)).toContain('aria-prohibited-attr')
    }
  })
}

for (const nav of ['navigate', 'motion']) {
  test(`MonthStepper: ${nav} で前後の月へ進み、一覧の両端で止まる`, async ({ page }, testInfo) => {
    await open(page, nav)
    const month = page.getByRole('group', { name: '対象月', exact: true })
    const prev = month.getByRole('button', { name: '前の月', exact: true })
    const next = month.getByRole('button', { name: '次の月', exact: true })
    const select = month.getByRole('button', { name: /^対象月/ })
    await expect(select).toHaveAccessibleName('対象月: 2026年10月')
    await expect(next).toBeDisabled()
    await prev.click()
    await expect(select).toHaveAccessibleName('対象月: 2026年9月')
    await next.click()
    await expect(select).toHaveAccessibleName('対象月: 2026年10月')
    await testInfo.attach('次の月で9月から10月へ移動', { body: await month.locator('..').screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await select.click()
    const options = page.getByRole('option')
    await expect(options).toHaveText(['2026年10月', '2026年9月', '2026年8月', '2026年7月', '2026年6月', '2026年5月'])
    await page.getByRole('option', { name: '2026年5月', exact: true }).click()
    await expect(prev).toBeDisabled()
    await expect(next).toBeEnabled()
    await next.focus()
    await page.keyboard.press('Enter')
    await expect(select).toHaveAccessibleName('対象月: 2026年6月')
    await expect(next).toBeFocused()
  })
}

test('Stepper: 週の数字が前後の移動と一覧選択で回り、桁が変わっても帯を保つ', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await open(page, 'navigate')
  const week = page.getByRole('group', { name: '対象の週', exact: true })
  const digit = week.locator('.roll-strip').last()
  const original = await digit.elementHandle()
  await week.getByRole('button', { name: '前の週', exact: true }).click()
  await expect(week.locator('.roll-sr')).toHaveText('1')
  await expect(week.getByRole('button', { name: '前の週', exact: true })).toBeDisabled()
  await digit.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  await week.getByRole('button', { name: '次の週', exact: true }).click()
  await expect(week.locator('.roll-sr')).toHaveText('2')
  await expect.poll(() => digit.evaluate(el => el.getAnimations().some(a => a.playState === 'running'))).toBe(true)
  await week.getByRole('button', { name: /対象の週.*第 2 週/ }).click()
  await page.getByRole('option', { name: '第 9 週', exact: true }).click()
  await expect(week.locator('.roll-sr')).toHaveText('9')
  await digit.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  await week.getByRole('button', { name: '次の週', exact: true }).click()
  await expect(week.locator('.roll-sr')).toHaveText('10')
  expect(await original!.evaluate(el => el.isConnected)).toBe(true)
  await expect(week.locator('.roll-col')).toHaveCount(2)
  await expect.poll(() => digit.evaluate(el => el.getAnimations().some(a => a.playState === 'running'))).toBe(true)
  await digit.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  await week.getByRole('button', { name: '前の週', exact: true }).click()
  await expect(week.locator('.roll-sr')).toHaveText('9')
  await expect(week.locator('.roll-col')).toHaveCount(1)
  if (process.env.IGNITE_STEPPER_SCREENSHOT) await week.screenshot({ path: process.env.IGNITE_STEPPER_SCREENSHOT })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await week.getByRole('button', { name: '前の週', exact: true }).click()
  await expect(week.locator('.roll-sr')).toHaveText('8')
  expect(await digit.evaluate(el => el.getAnimations().length)).toBe(0)
})

test('RollingNumber: 書体が差し替わった直後も桁が字の幅を切らない', async ({ page }) => {
  // Web 書体が遅れて届くと、数字は端末の書体から別の書体へ差し替わる。桁の窓が書体に依る長さ（1ch）を動きで追うと、
  // 追いつくまで（Chrome では止まったままになることもある）新しい書体の字を切る。監査は端末の書体だけで測るので、ここで差し替えを再現する
  await open(page, 'overview')
  const stats = page.locator('.cat-hero-s')
  await expect(stats.locator('.roll-col').first()).toBeVisible()
  const fits = () => stats.evaluate((el) => [...el.querySelectorAll<HTMLElement>('.roll-col:not(.gone)')].map((col) => {
    const strip = col.querySelector<HTMLElement>('.roll-strip')!
    const d = Math.round(-parseFloat(/-?[\d.]+/.exec(strip.style.transform)![0]) / 10)
    const range = document.createRange()
    range.selectNodeContents(strip.children[d])
    return { col: col.getBoundingClientRect().width, glyph: range.getBoundingClientRect().width }
  }))
  // 候補の書体から、数字の幅がいちばん細いものと太いものを選び（端末にない書体は既定の書体で測られる）、細い書体から太い書体へ差し替える
  const [narrowFont, wideFont, gap] = await stats.evaluate((el) => {
    const v = el.querySelector('.stat-v')!
    const size = getComputedStyle(v).fontSize
    const ctx = document.createElement('canvas').getContext('2d')!
    const width = (f: string) => { ctx.font = `700 ${size} ${f}`; return ctx.measureText('8').width }
    const fonts = ['"Arial Narrow"', '"Liberation Sans Narrow"', '"Times New Roman"', 'serif', 'monospace', 'sans-serif', '"Hiragino Sans"', '"DejaVu Sans"', 'Verdana'].sort((a, b) => width(a) - width(b))
    return [fonts[0], fonts[fonts.length - 1], width(fonts[fonts.length - 1]) - width(fonts[0])] as const
  })
  expect(gap, '数字の幅が違う書体が 2 つないと差し替えを再現できない').toBeGreaterThan(2)
  await stats.evaluate((el, f) => { (el as HTMLElement).style.setProperty('--font-num', f) }, narrowFont)
  await stats.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  await stats.evaluate((el, f) => { (el as HTMLElement).style.setProperty('--font-num', f) }, wideFont)
  for (const { col, glyph } of await fits()) expect(col).toBeGreaterThanOrEqual(glyph - 0.5)
})

test('Canvas: ドラッグで動き、ドラッグのあとのクリックは中身に届かず、ボタンで拡大縮小する', async ({ page }) => {
  await open(page, 'charts')
  const canvas = page.getByRole('region', { name: 'カタログの目録' })
  await canvas.scrollIntoViewIfNeeded()
  const stage = canvas.locator('.canvas-stage')
  const pos = () => stage.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).e)
  const card = canvas.getByRole('button', { name: 'Ignite カタログ', exact: true })
  const box = (await card.boundingBox())!
  const before = await pos()
  // 節の上から押してドラッグする（4px を超えたらドラッグ）
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 5 })
  await page.mouse.move(box.x + 140, box.y + 60, { steps: 5 })
  await page.mouse.up()
  expect(await pos()).toBeCloseTo(before + 120, 0)
  // ドラッグのあとのクリックでは選ばない
  await expect(card).not.toHaveAttribute('aria-current', 'true')
  // 押すだけなら選ぶ
  await card.click()
  await expect(card).toHaveAttribute('aria-current', 'true')

  await canvas.getByRole('button', { name: '拡大' }).click()
  await expect(canvas.getByRole('button', { name: /^倍率 110%/ })).toBeVisible()
  await canvas.getByRole('button', { name: '縮小' }).click()
  await canvas.getByRole('button', { name: '縮小' }).click()
  await expect(canvas.getByRole('button', { name: /^倍率 90%/ })).toBeVisible()
  await canvas.getByRole('button', { name: /^倍率/ }).click()
  await expect(canvas.getByRole('button', { name: /^倍率 100%/ })).toBeVisible()
  // ⌘ / Ctrl ＋ホイールで縮小する
  const c = (await canvas.boundingBox())!
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 100)
  await page.keyboard.up('Control')
  await expect.poll(() => stage.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeLessThan(1)
})

test('TreeChart: 開閉のボタンで縦に積んだ子を出し入れし、Tab で外の節へ移ると見える位置へ動く', async ({ page }) => {
  await open(page, 'charts')
  const canvas = page.getByRole('region', { name: 'カタログの目録' })
  await canvas.scrollIntoViewIfNeeded()
  const toggle = canvas.getByRole('button', { name: 'コード、標本 7 件の下を開く', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  const opened = canvas.getByRole('button', { name: 'コード、標本 7 件の下を閉じる', exact: true })
  await expect(opened).toHaveAttribute('aria-expanded', 'true')
  await expect(canvas.getByRole('button', { name: 'JSON', exact: true })).toBeVisible()
  await opened.click()
  await expect(canvas.getByRole('button', { name: 'JSON', exact: true })).toHaveCount(0)

  // 右端の外にある節へ Tab で移ると、表示領域の中まで動く
  const last = canvas.getByRole('button', { name: 'レスポンシブ表示、標本 2 件', exact: true })
  const view = (await canvas.boundingBox())!
  expect((await last.boundingBox())!.x).toBeGreaterThan(view.x + view.width)
  await last.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(last).toBeFocused()
  await expect.poll(async () => { const b = (await last.boundingBox())!; return b.x + b.width <= view.x + view.width && b.x >= view.x }).toBe(true)
})

// カタログの実例では作れない条件は、テスト専用の見本（fixtures.tsx）をページへ読み込んで確かめる
const mount = async (page: import('@playwright/test').Page, name: string) => {
  await open(page, 'overview')
  await page.addScriptTag({ type: 'module', content: `import { mount } from '/e2e/fixtures.tsx'; mount(${JSON.stringify(name)})` })
  await page.waitForFunction(() => !!document.getElementById('fx'))
}
const setFx = (page: import('@playwright/test').Page, v: string) => page.evaluate((x) => window.fx!(x), v)

test('Pagination: 件数があとから増えても、今のページの地が出る', async ({ page }) => {
  await mount(page, 'pagination')
  await setFx(page, '20')
  const row = page.locator('#fx .pg-row')
  await expect(row).toHaveClass(/ready/)
  expect(await row.locator('.thumb').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(0)
})

test('NumberField: フォームの中で Enter を押すと、打った値で送信する', async ({ page }) => {
  await mount(page, 'number')
  const box = page.getByRole('spinbutton', { name: '数' })
  await box.fill('7')
  await box.press('Enter')
  await expect(page.locator('[data-sent]')).toHaveText('7')
})

test('Select: 幅が動いている途中で同じ幅の値に変えても、動きの印を残さない', async ({ page }) => {
  await mount(page, 'select')
  const btn = page.locator('#fx .select-btn')
  await setFx(page, 'b')
  await expect(btn).toHaveClass(/resizing/)
  await setFx(page, 'c')
  await expect(btn).not.toHaveClass(/resizing/)
})

test('Expandable: 開く途中に中の要素の動きが終わっても、高さの動きを止めない', async ({ page }) => {
  await mount(page, 'expand')
  await page.getByRole('button', { name: '続きを読む' }).click()
  const early = await page.locator('#fx .expand-body').evaluate((el) => {
    el.querySelector('[data-inner]')!.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'color' }))
    return el.style.maxHeight
  })
  expect(early).not.toBe('none')
  await expect.poll(() => page.locator('#fx .expand-body').evaluate((el) => el.style.maxHeight)).toBe('none')
})

test('SearchSuggest: 選んでいた候補が減っても、Enter で残りの候補を選べる', async ({ page }) => {
  await mount(page, 'suggest')
  const box = page.getByRole('combobox', { name: '検索' })
  await box.fill('候補')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: '候補3' })).toHaveAttribute('aria-selected', 'true')
  await setFx(page, '1')
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.getByRole('option', { name: '候補1' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-picked]')).toHaveText('候補1')
})

test('AppShell: 引き出しの左メニューを開いたまま窓を広げたら、狭めても閉じている', async ({ page }) => {
  await open(page, 'overview')
  await page.setViewportSize({ width: 500, height: 800 })
  const menu = page.locator('.ttl-menu')
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await page.setViewportSize({ width: 1280, height: 800 })
  // 広い幅を部品が認識する（引き出しの形でなくなる）まで待ってから狭める
  await expect(page.locator('aside.side')).not.toHaveAttribute('role', 'dialog')
  await page.setViewportSize({ width: 500, height: 800 })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('aside.side')).not.toHaveClass(/open/)
})

test('CopyText: コピーの機能が無い環境では、できなかったと知らせる', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined }))
  await open(page, 'actions')
  await page.getByRole('button', { name: 'ignite 名前をコピー' }).click()
  await expect(page.locator('[aria-live]', { hasText: 'コピーできませんでした' })).toBeAttached()
})

test('CopyText: 続けて押しても、あとに押した分の「コピーしました」が早く消えない', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, 'actions')
  const ct = page.getByRole('button', { name: 'ignite 名前をコピー' })
  await ct.click()
  await expect(ct).toHaveClass(/copied/)
  await page.waitForTimeout(1000)
  await ct.click()
  // 1 回目から 1.5 秒が過ぎても、2 回目の分が残っている
  await page.waitForTimeout(800)
  await expect(ct).toHaveClass(/copied/)
})

test('SideStatus: 動きを減らす設定でも「更新しました」が出て、通常と同じころに消える', async ({ page }) => {
  await open(page, 'overview')
  // カタログに見本は置かない（8 秒の動きの終わりを監査が待たないように）。ここで行を置き、決めた時刻の見え方を測る
  const opacityAt = (ms: number) => page.evaluate((t) => {
    document.getElementById('t-status')?.remove()
    const row = document.createElement('div')
    row.id = 't-status'
    row.className = 'side-status updated'
    row.innerHTML = '<span class="side-status-l"><span class="side-status-note">更新しました</span></span>'
    document.body.append(row)
    const note = row.querySelector<HTMLElement>('.side-status-note')!
    const anim = note.getAnimations()[0]
    anim.pause()
    anim.currentTime = t
    return getComputedStyle(note).opacity
  }, ms)
  const expectShown = async () => {
    expect(await opacityAt(100)).toBe('1')
    expect(await opacityAt(3000)).toBe('1')
    expect(await opacityAt(7600)).toBe('0')
  }
  // 端末の「視差効果を減らす」
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expectShown()
  // 設定の画面の「動きを減らす」。表示の補助は端末の設定が変わるたびに、<html> に覚えた設定（data-assist）から data-motion を
  // 書き直す（知らせは遅れて届くことがある）。設定の画面と同じく覚えた設定も「減らす」にして、書き直されても外れないようにする
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => {
    const root = document.documentElement
    root.dataset.assist = JSON.stringify({ ...JSON.parse(root.dataset.assist || '{}'), motion: 'reduce' })
    root.dataset.motion = 'reduce'
  })
  await expectShown()
})

test('Toast: × で閉じると、フォーカスは隣の知らせの × へ移り、最後は知らせに入る前の場所へ戻る', async ({ page }) => {
  await open(page, 'feedback')
  const opener = page.getByRole('button', { name: '失敗を知らせる' })
  await opener.click()
  await opener.click()
  const shown = page.locator('.toast.danger:not(.closing)')
  await expect(shown).toHaveCount(2)
  await opener.focus()
  await shown.nth(0).getByRole('button', { name: '知らせを閉じる' }).focus()
  await page.keyboard.press('Enter')
  await expect(shown).toHaveCount(1)
  await expect(shown.nth(0).getByRole('button', { name: '知らせを閉じる' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(shown).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('AppShell: 引き出しの左メニューは、中の部品が Esc を先に処理したら閉じない', async ({ page }) => {
  await open(page, 'overview')
  await page.setViewportSize({ width: 500, height: 800 })
  const menu = page.locator('.ttl-menu')
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  // 引き出しの中で開いた Popover・一覧と同じく、document で Esc を受けて処理済みにする
  await page.evaluate(() => {
    const w = window as unknown as { escTaken: (e: KeyboardEvent) => void }
    w.escTaken = (e) => { if (e.key === 'Escape') e.preventDefault() }
    document.addEventListener('keydown', w.escTaken)
  })
  await page.keyboard.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  // 処理する部品がなければ、Esc で閉じる
  await page.evaluate(() => document.removeEventListener('keydown', (window as unknown as { escTaken: (e: KeyboardEvent) => void }).escTaken))
  await page.keyboard.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
})

test('Dialog: 処理中で閉じない窓は、Esc を続けて押しても開いたままで、処理が終わると閉じる', async ({ page }) => {
  await page.clock.install()
  await open(page, 'feedback')
  await page.getByRole('button', { name: '削除する' }).first().click()
  const box = page.getByRole('alertdialog')
  await box.getByRole('button', { name: '削除する' }).click()
  // ブラウザは 2 回目の Esc から取り消せない cancel を送り、窓を自分で閉じる
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => document.querySelector('dialog')?.open)).toBe(true)
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  await page.clock.runFor(1000)
  await expect(box).toHaveCount(0)
  await expect(page.locator('.toast', { hasText: '1件削除しました' })).toBeVisible()
})

test('Dialog: 中で文字を選んで外で離しても閉じず、外側を押すと閉じる', async ({ page }) => {
  await open(page, 'feedback')
  await page.getByRole('button', { name: '窓を開く' }).click()
  const dialog = page.getByRole('dialog', { name: '名前を変える' })
  const b = (await dialog.getByRole('heading', { name: '名前を変える' }).boundingBox())!
  await page.mouse.move(b.x + 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width - 2, b.y + b.height / 2, { steps: 5 })
  await page.mouse.move(20, 20, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await expect(dialog).toBeVisible()
  await page.mouse.click(20, 20)
  await expect(dialog).toHaveCount(0)
})

test('強制カラー（Windows のハイコントラスト）でも、選んだ状態と入力欄のフォーカスが見える', async ({ page }) => {
  // 強制カラーでは作り手の地の色と影が端末の配色に置き換わる。選んだ状態は系統色の Highlight で塗り、フォーカスは線で出す
  await page.emulateMedia({ forcedColors: 'active' })
  await open(page, 'forms')
  const sys = (name: string) => page.evaluate((n) => {
    const probe = document.createElement('i')
    probe.style.color = n
    document.body.append(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  }, name)
  const highlight = await sys('Highlight')
  const highlightText = await sys('HighlightText')
  expect(highlight).not.toBe(await sys('Canvas'))
  const css = (l: import('@playwright/test').Locator, prop: string) => l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
  // スイッチ: 入は地を塗り、切もつまみと輪郭を描く（地と影だけでは丸ごと消える）
  const on = page.getByRole('switch', { name: 'すぐに通知する' })
  const off = page.getByRole('switch', { name: '週次の報告を送る' })
  await expect(on).toHaveAttribute('aria-checked', 'true')
  await expect(off).toHaveAttribute('aria-checked', 'false')
  expect(await css(on.locator('.sw-track'), 'background-color')).toBe(highlight)
  expect(await css(off.locator('.sw-thumb'), 'background-color')).toBe(await sys('ButtonText'))
  expect(await css(off.locator('.sw-track'), 'outline-style')).toBe('solid')
  // ラジオ: 選んだ丸を塗る
  const standard = page.getByRole('radio', { name: /^標準/ })
  await standard.check()
  expect(await css(page.locator('.check', { has: standard }).locator('.check-box'), 'background-color')).toBe(highlight)
  // 入力欄: フォーカス中は枠の外に線を出す
  const search = page.getByPlaceholder('名前・担当者').first()
  await search.focus()
  expect(await css(search, 'outline-style')).toBe('solid')
  expect(await css(search, 'outline-color')).toBe(highlight)
  // 切り替え・タブ・ページ送り: 選択中の地を塗り、文字は地の上で読める色にする
  await open(page, 'navigate')
  const seg = page.locator('.seg').first()
  expect(await css(seg.locator('.thumb'), 'background-color')).toBe(highlight)
  expect(await css(seg.locator('button[aria-pressed="true"]'), 'color')).toBe(highlightText)
  const tabs = page.getByRole('tablist', { name: '表示の切り替え' })
  expect(await css(tabs.locator('.thumb'), 'background-color')).toBe(highlight)
  expect(await css(tabs.getByRole('tab', { selected: true }), 'color')).toBe(highlightText)
  const pages = page.locator('.pg-row').first()
  expect(await css(pages.locator('.thumb'), 'background-color')).toBe(highlight)
  expect(await css(pages.locator('[aria-current="page"]'), 'color')).toBe(highlightText)
})

test('Button の shortcut: キーで押し、押している間はキャップが沈む。1 文字のキーは入力中には効かない', async ({ page }) => {
  await open(page, 'actions')
  const make = page.getByRole('button', { name: '新規作成' })
  await expect(make).toHaveAttribute('aria-keyshortcuts', /Shift\+N/)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.down('Shift')
  await page.keyboard.down('N')
  await expect(make.locator('.keycap.down')).toHaveCount(2)
  await expect(make).toHaveClass(/keyed/)
  await page.keyboard.up('N')
  await page.keyboard.up('Shift')
  await expect(make.locator('.keycap.down')).toHaveCount(0)
  await expect(page.getByText('新しい項目を作りました')).toBeVisible()
  // 1 文字の「E」は、入力欄で打っているあいだは押さない
  await page.getByRole('textbox', { name: '件名' }).focus()
  await page.keyboard.press('e')
  await expect(page.getByText('編集を開きました')).toHaveCount(0)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('e')
  await expect(page.getByText('編集を開きました')).toBeVisible()
})

test('送信のボタン: 送っているあいだは幅を保ったまま待ちの印になり、終わると文字に戻る', async ({ page }) => {
  await open(page, 'actions')
  const send = page.getByRole('button', { name: '送信する' })
  const width = () => send.evaluate((el) => (el as HTMLElement).offsetWidth)
  const before = await width()
  await send.click()
  await expect(send).toHaveAttribute('aria-busy', 'true')
  await expect(send).toHaveClass(/sending/)
  await expect(send.locator('.btn-wait .spinner')).toBeVisible()
  expect(await width()).toBe(before)
  await expect(page.getByText('送信しました').first()).toBeVisible({ timeout: 5000 })
  await expect(send).not.toHaveClass(/sending/)
})

test('TipGroup: 最初は待って出し、隣へ移ると同じ吹き出しが待たずに移る。Esc で消える', async ({ page }) => {
  await open(page, 'actions')
  const group = page.getByRole('group', { name: '文字の書式' })
  const bubble = group.locator('.tg-bubble')
  await group.getByRole('button', { name: '太字' }).hover()
  await expect(bubble).toHaveClass(/on/)
  await expect(bubble).toHaveText('太字')
  const x1 = await bubble.evaluate((el) => parseFloat((el as HTMLElement).style.left))
  await group.getByRole('button', { name: '下線' }).hover()
  // 待ち（0.25s）を挟まずに、出たまま文言と位置が変わる
  await expect(bubble).toHaveText('下線', { timeout: 200 })
  await expect(bubble).toHaveClass(/on/)
  expect(await bubble.evaluate((el) => parseFloat((el as HTMLElement).style.left))).toBeGreaterThan(x1)
  // 中のボタン自身の吹き出しは出さない
  expect(await group.getByRole('button', { name: '下線' }).evaluate((el) => getComputedStyle(el, '::after').display)).toBe('none')
  await page.keyboard.press('Escape')
  await expect(bubble).toHaveCount(0)
})

test('OtpField: 数字だけを受け、全角や区切りを直す。違うとエラー、正しいと確かめる', async ({ page }) => {
  await open(page, 'forms')
  const code = page.getByRole('textbox', { name: '確認コード' })
  await code.fill('１２３ ４５')
  await expect(code).toHaveValue('12345')
  await expect(page.locator('.otp-cell.filled')).toHaveCount(5)
  await code.press('9')
  await expect(code).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('コードが違います')).toBeVisible()
  await code.press('Backspace')
  await expect(code).not.toHaveAttribute('aria-invalid', 'true')
  await code.press('6')
  await expect(page.getByText('確認しました')).toBeVisible()
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
})

test('PasswordStrength: 打つたびに強さが変わり、言葉が読み上げの値になる', async ({ page }) => {
  await open(page, 'forms')
  const meter = page.getByRole('meter', { name: 'パスワードの強さ' })
  await expect(meter).toHaveAttribute('aria-valuetext', '未入力')
  const pw = page.locator('.cat-spec[data-spec="password"]').getByLabel('新しいパスワード', { exact: true })
  await pw.fill('mintleaf')
  await expect(meter).toHaveAttribute('aria-valuetext', '弱い')
  await expect(page.getByText('12 字以上にする')).toBeVisible()
  await pw.fill('Kitchen-walk')
  await expect(meter).toHaveAttribute('aria-valuetext', 'とても強い')
  await expect(page.locator('.pwstr-bars > span.on')).toHaveCount(4)
})

test('FileDrop: Enter とラベルのクリックで選ぶ画面を開き、種類が合うものだけを受け取る', async ({ page }) => {
  await open(page, 'forms')
  const zone = page.getByRole('button', { name: '添付' })
  await zone.focus()
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')])
  await chooser.setFiles([
    { name: '見積.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') },
    { name: 'メモ.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
  ])
  // 受け取ったファイルは同じ枠の中で送信に進み、名前が出る（見本は小さいのですぐ終わる）
  await expect(zone.locator('.fd-name')).toHaveText('見積.pdf')
  await expect(zone.locator('.fd-state .fd-t')).toHaveText('送信しました')
  await expect(page.getByText('メモ.txt')).toHaveCount(0)
  await expect(page.getByText('1 件は追加できません（種類か大きさ）')).toBeVisible()
  const pick = (await zone.locator('.fd-pick').boundingBox())!
  const [clicked] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.mouse.click(pick.x + pick.width / 2, pick.y + pick.height / 2),
  ])
  await clicked.setFiles([])
})

test('FileDrop: 持って来ると枠が変わり、落とすと受け取る', async ({ page }) => {
  await open(page, 'forms')
  const zone = page.getByRole('button', { name: '添付' })
  const data = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['x'], '図.png', { type: 'image/png' }))
    return dt
  })
  await zone.dispatchEvent('dragenter', { dataTransfer: data })
  await expect(page.locator('.filedrop.over')).toHaveCount(1)
  await zone.dispatchEvent('drop', { dataTransfer: data })
  await expect(page.locator('.filedrop.over')).toHaveCount(0)
  await expect(zone.locator('.fd-name')).toHaveText('図.png')
})

test('FileDrop: ラベルとアイコン上のファイルドラッグを保ち、退出・再進入できる', async ({ page }, testInfo) => {
  await open(page, 'forms')
  const zone = page.getByRole('button', { name: '添付' })
  await zone.scrollIntoViewIfNeeded()
  const file = testInfo.outputPath('ドラッグ.pdf')
  await writeFile(file, '%PDF')
  const cdp = await page.context().newCDPSession(page)
  const data = { items: [], files: [file], dragOperationsMask: 1 }
  const point = async (selector: string) => {
    const box = (await zone.locator(selector).boundingBox())!
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const label = await point('.fd-t')
  await zone.evaluate((el) => {
    const root = el.parentElement!
    root.dataset.dragClasses = ''
    new MutationObserver((records) => {
      for (const record of records) root.dataset.dragClasses += `${record.oldValue}|`
    }).observe(root, { attributes: true, attributeFilter: ['class'], attributeOldValue: true })
  })
  await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', ...label, data })
  await expect(page.locator('.filedrop.over')).toHaveCount(1)
  for (const selector of ['.fd-t', '.fd-icon', '.fd-hint', '.fd-pick', '.fd-t']) {
    const at = await point(selector)
    await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', ...at, data })
    // DOM の入れ替え・矢印の移動中も、枠自身が当たり判定を持つ。
    expect(await zone.evaluate((el, p) => document.elementFromPoint(p.x, p.y) === el, at)).toBe(true)
    await page.waitForTimeout(400)
    await expect(page.locator('.filedrop.over')).toHaveCount(1)
    await expect(zone.locator('.rword > .sr-only')).toHaveText('ここで離す')
  }
  expect(await zone.locator('xpath=..').getAttribute('data-drag-classes')).toBe('filedrop|')
  await zone.screenshot({ path: testInfo.outputPath('filedrop-over.png') })
  const box = (await zone.boundingBox())!
  await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x: box.x - 10, y: box.y - 10, data })
  await expect(page.locator('.filedrop.over')).toHaveCount(0)
  await expect(zone.locator('.rword > .sr-only')).toHaveText('ファイルをドロップ')
  await expect(zone.locator('.rw-out')).toHaveCount(0)
  await zone.screenshot({ path: testInfo.outputPath('filedrop-idle.png') })
  await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', ...label, data })
  await expect(page.locator('.filedrop.over')).toHaveCount(1)
  await cdp.send('Input.dispatchDragEvent', { type: 'drop', ...label, data })
  await expect(page.locator('.filedrop.over')).toHaveCount(0)
  await expect(zone.locator('.fd-name')).toHaveText('ドラッグ.pdf')
  await cdp.detach()
})

test('Scrubber: キーで刻み・10 倍・端へ動き、押した位置へ飛ぶ', async ({ page }) => {
  await open(page, 'forms')
  const s = page.getByRole('slider', { name: '明るさ' })
  await s.focus()
  await page.keyboard.press('End')
  await expect(s).toHaveAttribute('aria-valuenow', '100')
  await page.keyboard.press('ArrowLeft')
  await expect(s).toHaveAttribute('aria-valuenow', '99')
  await page.keyboard.press('Home')
  await page.keyboard.press('PageUp')
  await expect(s).toHaveAttribute('aria-valuenow', '10')
  await expect(s).toHaveAttribute('aria-valuetext', '10%')
  const box = (await s.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(s).toHaveAttribute('aria-valuenow', '50')
  const zoom = page.getByRole('slider', { name: '拡大率' })
  await zoom.focus()
  await page.keyboard.press('ArrowRight')
  await expect(zoom).toHaveAttribute('aria-valuetext', '1.1 倍')
})

test('Switch: 入になるとチェックを描き、切では消す', async ({ page }) => {
  await open(page, 'forms')
  const sw = page.getByRole('switch', { name: '週次の報告を送る' })
  const offset = () => sw.locator('.sw-thumb path').evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset))
  expect(await offset()).toBeGreaterThan(1)
  await sw.click()
  await expect.poll(offset).toBe(0)
  await sw.click()
  await expect.poll(offset).toBeGreaterThan(1)
})

test('検索欄の印: ショートカットで移ると、キーを離すまで沈む', async ({ page }) => {
  await open(page, 'forms')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.down('f')
  await expect(page.locator('.kbd-key.down')).toHaveCount(1)
  await page.keyboard.up('f')
  await expect(page.locator('.kbd-key.down')).toHaveCount(0)
})

test('FileDrop: ドラッグ中はファイルのカードがつき、離すと同じ枠で送信中の輪から「送信しました」へ変わる', async ({ page }) => {
  await open(page, 'forms')
  const zone = page.getByRole('button', { name: '添付', exact: true })
  await zone.scrollIntoViewIfNeeded()
  const height = (await zone.boundingBox())!.height
  await page.evaluate(() => {
    const w = window as unknown as { notes: string[] }
    w.notes = []
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[aria-live]')) if (el.textContent && !w.notes.includes(el.textContent)) w.notes.push(el.textContent)
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
  const data = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array(2_500_000)], 'brief.pdf', { type: 'application/pdf' }))
    return dt
  })
  const box = (await zone.boundingBox())!
  const at = { clientX: box.x + box.width * 0.6, clientY: box.y + box.height * 0.5 }
  await zone.dispatchEvent('dragenter', { dataTransfer: data, ...at })
  // ブラウザは離すまで名前を見せないので、カードは種類を出す
  const chip = zone.locator('.fd-chip')
  await expect(chip).toHaveText('PDF')
  // dragover を待たず、入った直後からカーソルの右下に出る
  const cb = (await chip.boundingBox())!
  expect(Math.abs(cb.x - at.clientX)).toBeLessThan(40)
  expect(Math.abs(cb.y - at.clientY)).toBeLessThan(40)
  await zone.dispatchEvent('dragover', { dataTransfer: data, ...at })
  await zone.dispatchEvent('drop', { dataTransfer: data, ...at })
  // 離すと丸の位置へ向かって消える
  const icon = (await zone.locator('.fd-layer .fd-icon').first().boundingBox())!
  const target = await chip.evaluate((el) => [parseFloat((el as HTMLElement).style.getPropertyValue('--x')), parseFloat((el as HTMLElement).style.getPropertyValue('--y')), (el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight])
  // 丸は離した瞬間に持ち上がりから落ちる動きに入るので、丸の内側（半径以内）を目指していればよい
  expect(Math.hypot(box.x + target[0] + target[2] / 2 - (icon.x + icon.width / 2), box.y + target[1] + target[3] / 2 - (icon.y + icon.height / 2))).toBeLessThan(icon.width / 2)
  await expect(chip).toHaveCount(0)
  const state = zone.locator('.fd-state')
  // 参照と同じく、見出しに名前、下の行に送った量
  await expect(state.locator('.fd-t')).toHaveText('brief.pdf を送信中')
  await expect(state.locator('.fd-sub')).toHaveText(/^[0-9.]+[KM]?B \/ 2\.4MB$/)
  await expect(state.locator('.fd-ring')).toBeVisible()
  // 読み上げでは欄の説明として今の割合と量を確かめられる
  await expect(zone).toHaveAccessibleDescription(/^送信中 \d+%、brief\.pdf、[0-9.]+[KM]?B \/ 2\.4MB$/)
  await expect(state.locator('.fd-name')).toHaveText('brief.pdf')
  await expect(zone).toHaveAttribute('aria-disabled', 'true')
  expect((await zone.boundingBox())!.height).toBe(height)
  await expect(state.locator('.fd-t')).toHaveText('送信しました', { timeout: 15000 })
  await expect(state.locator('.fd-done')).toBeVisible()
  await expect(state.locator('.fd-meta')).toHaveText('brief.pdf・2.4MB')
  expect((await zone.boundingBox())!.height).toBe(height)
  await expect(zone).not.toHaveAttribute('aria-disabled', 'true')
  // 送り終えたあとに次のファイルを持って来ると「ここで離す」に戻り、離れると完了の表示に戻る
  await zone.dispatchEvent('dragenter', { dataTransfer: data, ...at })
  await expect(zone.locator('.fd-state')).toHaveCount(0)
  await expect(zone.locator('.fd-layer .rword > .sr-only')).toHaveText('ここで離す')
  await zone.dispatchEvent('dragleave', { dataTransfer: data, ...at })
  await expect(state.locator('.fd-t')).toHaveText('送信しました')
  await expect.poll(() => page.evaluate(() => (window as unknown as { notes: string[] }).notes)).toEqual(expect.arrayContaining(['brief.pdf を送信しています', 'brief.pdf を送信しました']))
})

test('FileDrop: 送れなかったときは赤い印と理由を出し、押すと選び直せる', async ({ page }) => {
  await open(page, 'forms')
  const zone = page.getByRole('button', { name: '送れなかったファイル' })
  await zone.scrollIntoViewIfNeeded()
  await expect(zone.locator('.fd-fail')).toBeVisible()
  await expect(zone.locator('.fd-state .fd-t')).toHaveText('送信できませんでした')
  await expect(zone.locator('.fd-err')).toHaveText('通信が切れました')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), zone.click()])
  await chooser.setFiles([])
})
