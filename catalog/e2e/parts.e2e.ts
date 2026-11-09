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
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(box).toHaveValue('京都')
  await box.fill('')
  await page.keyboard.press('Tab')
  await expect(box).toHaveValue('')
})

test('DatePicker: 矢印と PageDown で動かし、Enter で選んでボタンへ戻る。範囲の外は選べない', async ({ page }) => {
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

test('グラフ共通: レーダーの点でも項目名と同じ内訳を出す', async ({ page }) => {
  await open(page, 'charts')
  const hit = page.locator('.radar-hit').first()
  await hit.hover()
  await expect(page.getByRole('tooltip')).toContainText('速さ')
  await expect(page.getByRole('tooltip')).toContainText('今期 4')
  await page.mouse.move(0, 0)
  await page.locator('.radar-l').first().focus()
  await expect(page.getByRole('tooltip')).toContainText('今期 4')
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
