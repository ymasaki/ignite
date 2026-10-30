// DESIGN.md の決まりのうち、描いた画面で測れるもの。page.evaluate の中で動くので、外の変数を読まない（引数で受ける）。
import type { Page } from '@playwright/test'

export interface MeasureArgs {
  FONT_SIZES: number[]
  FONT_WEIGHTS: string[]
  RADII: number[]
  SHELL: { overlayBelow: number; sideMinBelow: number; drawerSideAt: number; minBoard: number; rail: number }
  rows: string
  overflow: string
  bars: string
  frames: string
}
export type Measured = { rule: string; where: string; expected: string; actual: string }

export function measure(page: Page, args: MeasureArgs): Promise<Measured[]> {
  return page.evaluate(({ FONT_SIZES, FONT_WEIGHTS, RADII, SHELL, rows: rowSel, overflow, bars, frames }) => {
    const out: Measured[] = []
    const root = getComputedStyle(document.querySelector('.mainwrap') || document.documentElement)
    const px = (v: string) => parseFloat(root.getPropertyValue(v))
    const shell = { x: px('--shell-x'), top: px('--shell-top'), gap: px('--shell-gap'), bottom: px('--shell-bottom') }
    const near = (a: number, b: number) => Math.abs(a - b) <= 1
    // 文字と角丸は目盛りの値そのもの。±1 では目盛りの間（15px・7px）をすり抜ける
    const exact = (a: number, b: number) => Math.abs(a - b) <= 0.05
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    }
    /** 要素の見分け方（クラス名の並び。長いときは先頭 3 つ） */
    const who = (el: Element) => {
      const cls = [...el.classList].filter((c) => !/^c\d$/.test(c)).slice(0, 3).join('.')
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`
    }
    const parentWho = (el: Element) => (el.parentElement ? who(el.parentElement) + ' > ' : '') + who(el)

    // 5 章: 画面の段組み。ヘッダー → 最初の段が --shell-top、段と段が --shell-gap、左右が --shell-x、最後の段の下が --shell-bottom
    const main = document.querySelector('.mainwrap')
    const header = document.querySelector('header.top')
    // 段は本体（main.shell-main、display:contents）の子。位置は箱を持つ .mainwrap で測る
    const body = main?.querySelector(':scope > .shell-main') || main
    if (main && body && header) {
      const rows = [...body.querySelectorAll(rowSel)].filter(visible)
      let prev = header.getBoundingClientRect().bottom
      rows.forEach((row, i) => {
        const r = row.getBoundingClientRect()
        const expected = i > 0 ? shell.gap : shell.top
        const gap = Math.round(r.top - prev)
        if (!near(gap, expected)) out.push({ rule: '段組みの余白（5 章）', where: `${i === 0 ? 'ヘッダー' : who(rows[i - 1])} → ${who(row)}`, expected: `${expected}px（${i === 0 ? '--shell-top' : '--shell-gap'}）`, actual: `${gap}px` })
        prev = r.bottom
      })
      const board = document.querySelector('.board')
      if (board && visible(board)) {
        const b = board.getBoundingClientRect()
        const m = main.getBoundingClientRect()
        const panel = document.querySelector('.pslot')
        const right = panel && visible(panel) ? panel.getBoundingClientRect().right : b.right
        if (!near(b.left - m.left, shell.x)) out.push({ rule: '段組みの余白（5 章）', where: '内容の枠の左', expected: `${shell.x}px（--shell-x）`, actual: `${Math.round(b.left - m.left)}px` })
        // 設定の面は行の幅で止めて左に寄せる（7 章「画面の型」の設定）ので、右は測らない
        if (!board.classList.contains('settings-board') && !near(m.right - right, shell.x)) out.push({ rule: '段組みの余白（5 章）', where: '内容の枠（詳細パネルを含む）の右', expected: `${shell.x}px（--shell-x）`, actual: `${Math.round(m.right - right)}px` })
        if (!near(m.bottom - b.bottom, shell.bottom)) out.push({ rule: '段組みの余白（5 章）', where: '内容の枠の下', expected: `${shell.bottom}px（--shell-bottom）`, actual: `${Math.round(m.bottom - b.bottom)}px` })
      }
      // 5 章: ヘッダーの左端は内容の段と同じ --shell-x。左メニューのつまみがあるときは、つまみから 8px 離す
      const first = [...header.children].find(visible)
      const m = main.getBoundingClientRect()
      const handle = document.querySelector('.side-handle')
      const clear = handle && visible(handle) ? Math.max(shell.x, Math.round(handle.getBoundingClientRect().right - m.left) + 8) : shell.x
      if (first && !near(first.getBoundingClientRect().left - m.left, clear)) out.push({ rule: '段組みの余白（5 章）', where: `ヘッダーの左端（${who(first)}）`, expected: `${clear}px（${clear === shell.x ? '--shell-x' : 'つまみから 8px'}）`, actual: `${Math.round(first.getBoundingClientRect().left - m.left)}px` })
    }

    // 5 章: 横にはみ出さない（ページ全体と、帯・切り替えの中）
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push({ rule: '横のはみ出し（5 章）', where: 'ページ全体', expected: `幅 ${innerWidth}px 以内`, actual: `${document.documentElement.scrollWidth}px` })
    for (const el of document.querySelectorAll(overflow)) {
      if (!visible(el) || el.closest('.kpis-measure')) continue
      const e = el as HTMLElement
      // KPI の帯は、畳んだ項目（幅 0）の中の読み上げ用の数字が scrollWidth に入るので、見えている項目の右端で測る
      const kpis = el.classList.contains('kpis')
      const content = kpis ? Math.round(Math.max(0, ...[...el.children].filter((c) => c.getBoundingClientRect().width > 0).map((c) => c.getBoundingClientRect().right)) - el.getBoundingClientRect().left) : e.scrollWidth
      const box = kpis ? Math.round(el.getBoundingClientRect().width) : e.clientWidth
      if (content > box + 1) out.push({ rule: '横のはみ出し（5 章）', where: parentWho(el), expected: '中身が枠に収まる（入らなければ落とす・段を足す）', actual: `中身 ${content}px > 枠 ${box}px` })
    }

    // 5 章: 1 行で出す値（横棒の値）が折り返さない
    for (const el of document.querySelectorAll('.bl-v')) {
      if (!visible(el)) continue
      const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.5
      const h = el.getBoundingClientRect().height
      if (h > lh * 1.5) out.push({ rule: '横のはみ出し（5 章）', where: parentWho(el), expected: '値が 1 行に収まる', actual: `${Math.round(h)}px（${Math.round(h / lh)} 行）` })
    }

    // 5 章「画面の骨組みの区切り」: 詳細パネルは、主役に最小幅が残る幅では重ねずに横に並べ、足りなければ左メニューを畳む
    const openPanel = document.querySelector('.pslot .panel, .drawer')
    if (openPanel && innerWidth >= SHELL.overlayBelow) {
      if (openPanel.classList.contains('drawer')) out.push({ rule: '詳細パネルを重ねない（5 章）', where: '.drawer', expected: `幅 ${SHELL.overlayBelow}px 以上では横に並べる（.pslot）`, actual: `幅 ${innerWidth}px で重ねている` })
      const board = document.querySelector('.content > .board')
      const bw = board ? Math.round(board.getBoundingClientRect().width) : 0
      if (board && bw < SHELL.minBoard) out.push({ rule: '主役の最小幅（5 章）', where: '.content > .board', expected: `${SHELL.minBoard}px 以上`, actual: `${bw}px` })
      const sw = Math.round(document.querySelector('.side')?.getBoundingClientRect().width || 0)
      if (innerWidth > SHELL.drawerSideAt && innerWidth < SHELL.sideMinBelow && sw > SHELL.rail) out.push({ rule: '左メニューを畳む（5 章）', where: '.side', expected: `幅 ${SHELL.sideMinBelow}px 未満で詳細パネルを開いたら ${SHELL.rail}px`, actual: `${sw}px` })
    }

    // 4 章: 閉じた引き出し（画面の外にある左メニュー）に影を付けない
    const side = document.querySelector('.side')
    if (side && side.getBoundingClientRect().right <= 0 && getComputedStyle(side).boxShadow !== 'none') out.push({ rule: '影（4 章）', where: '閉じた引き出し（.side）', expected: '影なし', actual: getComputedStyle(side).boxShadow })

    // 5 章: 同じ段の操作どうしが重ならない
    for (const bar of document.querySelectorAll(bars)) {
      const ctrls = [...bar.querySelectorAll('button, input, .notice')].filter((el) => visible(el) && !el.closest('.popover-body'))
      for (let i = 0; i < ctrls.length; i++) {
        for (let j = i + 1; j < ctrls.length; j++) {
          if (ctrls[i].contains(ctrls[j]) || ctrls[j].contains(ctrls[i])) continue
          const a = ctrls[i].getBoundingClientRect()
          const b = ctrls[j].getBoundingClientRect()
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (w > 1 && h > 1) out.push({ rule: '操作の重なり（5 章）', where: `${parentWho(ctrls[i])} × ${who(ctrls[j])}`, expected: '重ならない', actual: `${Math.round(w)}×${Math.round(h)}px 重なる` })
        }
      }
    }
    // 5 章: 落とす順番。主役（data-fit="main"）を省略記号で詰めているのに、落としてよいもの（data-fit="extra"）が見えている
    for (const m of document.querySelectorAll('[data-fit="main"]')) {
      const owner = m.closest('button, [role="button"]') || m.parentElement
      if (!owner || !visible(owner) || getComputedStyle(m).display === 'none' || m.scrollWidth <= m.clientWidth + 1) continue
      const extras = m.parentElement ? [...m.parentElement.querySelectorAll('[data-fit="extra"]')].filter(visible) : []
      if (extras.length) out.push({ rule: '落とす順番（5 章）', where: parentWho(m), expected: '主役を詰める前に extra を隠す', actual: `${extras.map(who).join('・')} が見えたまま詰めている` })
    }

    // 3・4 章: 文字の大きさ・太さ、角丸。文字の大きさは --text-scale を掛けた目盛り。顔アイコンの頭文字は丸に合わせるので掛けない
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) || 1
    const scaled = FONT_SIZES.map((s) => Math.round(s * scale * 100) / 100)
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('svg, canvas, #boot')) continue
      const cs = getComputedStyle(el)
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) {
        const fs = parseFloat(cs.fontSize)
        const sizes = el.closest('.av') ? FONT_SIZES : scaled
        if (!sizes.some((s) => exact(fs, s))) out.push({ rule: '文字の大きさ（3 章）', where: parentWho(el), expected: sizes.join('/') + 'px', actual: `${Math.round(fs * 10) / 10}px` })
        if (!FONT_WEIGHTS.includes(cs.fontWeight)) out.push({ rule: '文字の太さ（3 章）', where: parentWho(el), expected: FONT_WEIGHTS.join('/'), actual: cs.fontWeight })
      }
      const rad = cs.borderTopLeftRadius
      if (rad && rad !== '0px') {
        if (rad.endsWith('%')) {
          if (rad !== '50%') out.push({ rule: '角丸（4 章）', where: parentWho(el), expected: RADII.join('/') + 'px・50%', actual: rad })
        } else if (!RADII.some((r) => exact(parseFloat(rad), r)) && parseFloat(rad) < 99) out.push({ rule: '角丸（4 章）', where: parentWho(el), expected: RADII.join('/') + 'px・50%', actual: rad })
      }
    }

    // 4 章: 角丸の枠の角を、中の子要素が四角い地で塗りつぶしていないか。角から 1.5px 内側の点にある要素から枠までたどる
    const CORNERS = [
      { name: '左上', prop: 'borderTopLeftRadius', at: (r: DOMRect) => [r.left + 1.5, r.top + 1.5] },
      { name: '右上', prop: 'borderTopRightRadius', at: (r: DOMRect) => [r.right - 1.5, r.top + 1.5] },
      { name: '左下', prop: 'borderBottomLeftRadius', at: (r: DOMRect) => [r.left + 1.5, r.bottom - 1.5] },
      { name: '右下', prop: 'borderBottomRightRadius', at: (r: DOMRect) => [r.right - 1.5, r.bottom - 1.5] },
    ] as const
    const painted = (c: CSSStyleDeclaration) => (c.backgroundColor !== 'rgba(0, 0, 0, 0)' && c.backgroundColor !== 'transparent') || c.backgroundImage !== 'none'
    for (const frame of document.querySelectorAll(frames)) {
      if (!visible(frame)) continue
      const rect = frame.getBoundingClientRect()
      const fcs = getComputedStyle(frame)
      for (const c of CORNERS) {
        const r = parseFloat(fcs[c.prop])
        if (!(r >= 6)) continue
        const [x, y] = c.at(rect)
        const hit = document.elementFromPoint(x, y)
        if (!hit || hit === frame || !frame.contains(hit)) continue
        let clipped = fcs.overflow !== 'visible'
        let bad: Element | null = null
        for (let el: Element | null = hit; el && el !== frame && !clipped; el = el.parentElement) {
          const ecs = getComputedStyle(el)
          const er = parseFloat(ecs[c.prop]) || 0
          if (ecs.overflow !== 'visible' && er >= r - 2) clipped = true
          else if (painted(ecs) && er < r - 2) bad = bad || el
        }
        if (!clipped && bad) out.push({ rule: '角丸（4 章）', where: `${who(frame)} の${c.name}の角 ← ${parentWho(bad)}`, expected: `枠の角丸 ${r}px を中の地が塗らない`, actual: `${who(bad)}（角丸 ${parseFloat(getComputedStyle(bad)[c.prop]) || 0}px）の地が角を塗る` })
      }
    }

    // 7 章 Kpi: アイコンの箱は正方形で、枠の中身は枠の幅に収まる
    for (const el of document.querySelectorAll('.kpis-wrap > .kpis > .kpi:not(.hide)')) {
      if (!visible(el)) continue
      const ic = el.querySelector('.kpi-ic')
      if (ic) {
        const r = ic.getBoundingClientRect()
        if (Math.abs(r.width - r.height) > 1) out.push({ rule: 'KPI のアイコンの箱（7 章）', where: parentWho(el), expected: '正方形', actual: `${Math.round(r.width)}×${Math.round(r.height)}px` })
      }
      const k = el as HTMLElement
      if (k.scrollWidth > k.clientWidth + 1) out.push({ rule: 'KPI の枠の幅（7 章）', where: parentWho(el), expected: '中身が枠に収まる', actual: `中身 ${k.scrollWidth}px > 枠 ${k.clientWidth}px` })
    }

    // 5 章: ボタンの高さ（ヘッダーは 40px、ほかは 34px）
    for (const el of document.querySelectorAll('.btn')) {
      if (!visible(el)) continue
      const h = Math.round(el.getBoundingClientRect().height)
      const expected = el.closest('header.top') ? 40 : 34
      if (!near(h, expected)) out.push({ rule: 'ボタンの高さ（5 章）', where: parentWho(el), expected: `${expected}px`, actual: `${h}px` })
    }

    // 1 章: アイコンだけのボタンは aria-label と data-tip。ブラウザ標準の title は使わない
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (!visible(el) || (el.textContent || '').trim() || !el.querySelector('svg')) continue
      if (!el.getAttribute('aria-label')) out.push({ rule: 'アイコンだけのボタン（1 章）', where: parentWho(el), expected: 'aria-label あり', actual: 'なし' })
      if (!el.hasAttribute('data-tip')) out.push({ rule: 'アイコンだけのボタン（1 章）', where: parentWho(el), expected: 'data-tip あり', actual: 'なし' })
    }
    for (const el of document.querySelectorAll('[title]')) {
      if (!el.closest('svg')) out.push({ rule: 'title を使わない（1 章）', where: parentWho(el), expected: 'data-tip', actual: `title="${el.getAttribute('title')}"` })
    }
    return out
  }, args)
}
