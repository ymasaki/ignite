// DESIGN.md の決まりのうち、描いた画面で測れるもの。page.evaluate の中で動くので、外の変数を読まない（引数で受ける）。
import type { Page } from '@playwright/test'

export type LayoutMeasurement = 'rows' | 'boardLeft' | 'boardRight' | 'boardBottom'

/** 横の切り抜きだけを受理する、パン描画の枠と内容のセレクタ */
export interface AuditPanRegion { viewport: string; content: string }

export interface MeasureArgs {
  FONT_SIZES: number[]
  FONT_WEIGHTS: string[]
  RADII: number[]
  SHELL: { overlayBelow: number; sideMinBelow: number; drawerSideAt: number; minBoard: number; rail: number }
  rows: string
  overflow: string
  bars: string
  frames: string
  /** 角丸の枠を重ねてよい枠（部品そのものが持つ枠・見本の枠）。この中と、これ自身は測らない */
  nestOk?: string
  /** 角丸の枠の外に置いてよい中身（1 章の例外）。この中と、これ自身は測らない */
  bareOk?: string
  panRegions?: AuditPanRegion[]
  skipLayout?: LayoutMeasurement[]
}
export type Measured = { rule: string; where: string; expected: string; actual: string }

export function measure(page: Page, args: MeasureArgs): Promise<Measured[]> {
  return page.evaluate(({ FONT_SIZES, FONT_WEIGHTS, RADII, SHELL, rows: rowSel, overflow, bars, frames, nestOk = '', bareOk = '', panRegions = [], skipLayout = [] }) => {
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

    // 7・12 章: グラフの確認口は Tab で到達し、読み上げから隠さない。
    // 円の SVG 区分はホバー専用で、対応する凡例から同じ値を確認する。
    for (const el of document.querySelectorAll<HTMLElement | SVGElement>('[data-chart-tip]')) {
      if (el instanceof SVGElement && !el.hasAttribute('tabindex')) continue
      if (el.closest('[inert]')) continue
      if (el.tabIndex < 0 || el.closest('[aria-hidden="true"]')) {
        out.push({ rule: 'グラフの値の確認（7・12 章）', where: who(el), expected: 'Tab で到達でき、読み上げから隠れていない', actual: `tabIndex=${el.tabIndex}、aria-hidden=${!!el.closest('[aria-hidden="true"]')}` })
      }
    }

    // 5 章: 画面の段組み。ヘッダー → 最初の段が --shell-top、段と段が --shell-gap、左右が --shell-x、最後の段の下が --shell-bottom
    const main = document.querySelector('.mainwrap')
    const header = document.querySelector('header.top')
    // 段は本体（main.shell-main、display:contents）の子。位置は箱を持つ .mainwrap で測る
    const body = main?.querySelector(':scope > .shell-main') || main
    if (main && body && header) {
      const rows = skipLayout.includes('rows') ? [] : [...body.querySelectorAll(rowSel)].filter(visible)
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
        if (!skipLayout.includes('boardLeft') && !near(b.left - m.left, shell.x)) out.push({ rule: '段組みの余白（5 章）', where: '内容の枠の左', expected: `${shell.x}px（--shell-x）`, actual: `${Math.round(b.left - m.left)}px` })
        // 設定の面は行の幅で止めて左に寄せる（7 章「画面の型」の設定）ので、右は測らない
        if (!skipLayout.includes('boardRight') && !board.classList.contains('settings-board') && !near(m.right - right, shell.x)) out.push({ rule: '段組みの余白（5 章）', where: '内容の枠（詳細パネルを含む）の右', expected: `${shell.x}px（--shell-x）`, actual: `${Math.round(m.right - right)}px` })
        if (!skipLayout.includes('boardBottom') && !near(m.bottom - b.bottom, shell.bottom)) out.push({ rule: '段組みの余白（5 章）', where: '内容の枠の下', expected: `${shell.bottom}px（--shell-bottom）`, actual: `${Math.round(m.bottom - b.bottom)}px` })
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
    // セレクタは実要素へ解決し、厳密な子孫関係がある組だけを使う。
    const pans = panRegions.flatMap(({ viewport, content }) => {
      const contents = [...document.querySelectorAll(content)]
      return [...document.querySelectorAll(viewport)].flatMap((vp) => {
        if (!['hidden', 'clip'].includes(getComputedStyle(vp).overflowX)) return []
        return contents.filter((c) => c !== vp && vp.contains(c)).map((c) => ({ viewport: vp, content: c }))
      })
    })
    const acceptsPan = (el: Element, vp: Element) => {
      if (!pans.some((p) => p.viewport === vp && p.content.contains(el))) return false
      // 固定操作は、対象自身も含めてパン内容と区別する。
      for (let n: Element | null = el; n; n = n.parentElement) {
        if (['fixed', 'sticky'].includes(getComputedStyle(n).position)) return false
        if (n === vp) return true
      }
      return false
    }
    // 枠自身は子が窓外にパンされていても独立して測る。
    for (const vp of new Set(pans.map((p) => p.viewport))) {
      if (!visible(vp)) continue
      const r = vp.getBoundingClientRect()
      let clip = ''
      let scrolls = false
      for (let a = vp.parentElement; a && !clip && !scrolls; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX
        scrolls = ox === 'auto' || ox === 'scroll'
        if (ox !== 'hidden' && ox !== 'clip') continue
        const ar = a.getBoundingClientRect()
        if (r.right > ar.right + 1 || r.left < ar.left - 1) clip = who(a)
      }
      if (!clip && !scrolls && (r.right > innerWidth + 1 || r.left < -1)) clip = '窓'
      if (clip) out.push({ rule: '横のはみ出し（5 章）', where: parentWho(vp), expected: 'パンの枠が切られない', actual: `${clip} の外へ ${Math.round(r.left)}〜${Math.round(r.right)}px` })
    }
    // 枠に切られた中身（5 章「どの大きさでも崩さない」）。枠は overflow:hidden なので、ページ全体のはみ出しには出ない。スクロールできる枠の中はよい
    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], input, textarea, [role="tab"], h1, h2, h3, th, td, label')) {
      if (el.closest('[inert], [aria-hidden="true"], .fit-measure, .sr-only') || !visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      let clip: string | null = null
      let scrolls = false
      for (let a = el.parentElement; a && !clip && !scrolls; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX
        if (acceptsPan(el, a)) { scrolls = true; break }
        scrolls = ox === 'auto' || ox === 'scroll'
        if (ox !== 'hidden' && ox !== 'clip') continue
        const ar = a.getBoundingClientRect()
        if (r.right > ar.right + 1 || r.left < ar.left - 1) clip = a.className ? `.${String(a.className).split(' ')[0]}` : a.tagName
      }
      if (!clip && !scrolls && (r.right > innerWidth + 1 || r.left < -1)) clip = '窓'
      if (clip) out.push({ rule: '横のはみ出し（5 章）', where: parentWho(el), expected: '中身が枠に切られない', actual: `${clip} の外へ ${Math.round(r.left)}〜${Math.round(r.right)}px` })
    }
    // 回る数字（RollingNumber）の桁は、見えている数字の字の幅を切らない。桁の枠は overflow:hidden で、箱どうしの比較では
    // 枠の中の字のはみ出しが見えないので、字の幅（Range）で測る。消えていく桁（.gone）は幅 0 が正しい
    for (const col of document.querySelectorAll<HTMLElement>('.roll-col:not(.gone)')) {
      const strip = col.querySelector<HTMLElement>('.roll-strip')
      const shift = strip && /translateY\((-?[\d.]+)%\)/.exec(strip.style.transform)
      const digit = shift && strip.children[Math.round(-parseFloat(shift[1]) / 10)]
      if (!digit || !visible(col)) continue
      const range = document.createRange()
      range.selectNodeContents(digit)
      const glyph = range.getBoundingClientRect().width
      const box = col.getBoundingClientRect().width
      if (glyph > box + 0.5) out.push({ rule: '横のはみ出し（5 章）', where: parentWho(col.parentElement || col), expected: '数字の字が桁の枠に収まる', actual: `字 ${glyph.toFixed(1)}px > 桁 ${box.toFixed(1)}px` })
    }
    // 開いたパネルは窓と枠に切られない（縦も）。スクロールして見える場所でも、開いた直後に操作の一部が隠れるので測る
    for (const el of document.querySelectorAll('.popover-body')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      let cut = r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1 ? '窓' : ''
      for (let a = getComputedStyle(el).position === 'fixed' ? null : el.parentElement; a && !cut; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if (cs.position === 'fixed') break
        if (cs.overflowY === 'visible') continue
        const ar = a.getBoundingClientRect()
        if (r.top < ar.top - 1 || r.bottom > ar.bottom + 1) cut = a.className ? `.${String(a.className).split(' ')[0]}` : a.tagName
      }
      if (cut) out.push({ rule: '開いたパネルが切れない（5 章）', where: parentWho(el), expected: '全体が見える', actual: `${cut} に切られる ${Math.round(r.top)}〜${Math.round(r.bottom)}px` })
    }
    // DatePicker の面は日付の表と余白の幅に収める（7 章）。親フォームの最小幅を受け継がない
    for (const el of document.querySelectorAll('.datepicker .popover-body')) {
      const table = el.querySelector('.cal table')
      if (!table || !visible(el)) continue
      const cs = getComputedStyle(el)
      const expected = table.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
      const actual = el.getBoundingClientRect().width
      if (actual > expected + 1) out.push({ rule: 'カレンダーの幅（7 章）', where: parentWho(el), expected: `日付の表と余白 ${Math.round(expected)}px`, actual: `${Math.round(actual)}px` })
    }
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
        if (hit.closest('.popover-body') && !frame.matches('.popover-body')) continue // 枠の上に浮いたパネルは枠の中身の地ではない
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

    // 7 章: 角丸の枠の上に角丸の枠を重ねない。枠はカード・パネルの段の角丸（12px 以上。丸い部品の 99px・50% を除く）で四辺に線があるもの。
    // ボタン・入力欄（角丸 10 以下）は枠に数えない。部品そのものが持つ枠（表・コード・アイコンの箱など）は nestOk で除く
    const lined = (cs: CSSStyleDeclaration) => (['Top', 'Right', 'Bottom', 'Left'] as const).every((side) => {
      const color = cs[`border${side}Color`]
      return parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none' && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)
    })
    const card = (el: Element) => {
      const cs = getComputedStyle(el)
      const rad = cs.borderTopLeftRadius
      const r = parseFloat(rad)
      return !rad.endsWith('%') && r >= 12 && r < 99 && lined(cs)
    }
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || (nestOk && el.closest(nestOk)) || !card(el)) continue
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (!card(a)) continue
        out.push({ rule: '角丸の枠を重ねない（7 章）', where: `${who(a)} の中の ${who(el)}`, expected: '角丸の枠の中は見出し・線・余白で区切る', actual: `角丸 ${parseFloat(getComputedStyle(a).borderTopLeftRadius)}px の枠の中に、角丸 ${parseFloat(getComputedStyle(el).borderTopLeftRadius)}px の枠` })
        break
      }
    }

    // 1 章: 上のヘッダーのほかは、中身を角丸の枠の上に置く（ページの地に直接置かない）。
    // 本体（.shell-main）の中の見える文字・操作・画像を拾い、祖先に角丸の枠（上の card）か、内容の枠・帯（frames・bars）がなければ指摘する。
    // 読み上げだけの文字（1px 以下）は見えないので除く。同じ枠の外の塊は 1 回だけ書く
    const shellMain = document.querySelector('.shell-main')
    if (shellMain) {
      const surface = [frames, bars].filter(Boolean).join(', ')
      const onSurface = new Map<Element, boolean>()
      const covered = (el: Element): boolean => {
        const known = onSurface.get(el)
        if (known !== undefined) return known
        const ok = el === shellMain || !el.parentElement ? false : (surface && el.matches(surface)) || card(el) || covered(el.parentElement)
        onSurface.set(el, ok)
        return ok
      }
      const reported = new Set<Element>()
      for (const el of shellMain.querySelectorAll('*')) {
        const content = el.matches('button, input, select, textarea, img, svg, canvas, video') || [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
        if (!content || !visible(el) || (bareOk && el.closest(bareOk))) continue
        const r = el.getBoundingClientRect()
        if (r.width <= 1 || r.height <= 1 || el.parentElement?.closest('svg') || covered(el)) continue
        // 枠の外にある一番外側の塊（本体の直下）で 1 回にまとめる
        let top: Element = el
        while (top.parentElement && top.parentElement !== shellMain) top = top.parentElement
        if (reported.has(top)) continue
        reported.add(top)
        out.push({ rule: '中身は角丸の枠の上に置く（1 章）', where: `${who(top)} の中の ${who(el)}`, expected: '上のヘッダーのほかは、内容の枠（Board など）・カード・帯の上に置く', actual: `角丸の枠の外に「${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 20)}」` })
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
