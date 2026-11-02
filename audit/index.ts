// 描いた画面の監査（DESIGN.md の測れる決まりを、実際の画面で確かめる）。採用アプリは画面の一覧を渡すだけで、同じ監査を受ける。
// 使い方は docs/adopting.md。結果は test-results-audit/report.md（とスクリーンショット）に書く。
import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { Assist } from '../src/assist'
import { contrastRatio, contrastRulesFor, type ContrastRule } from '../src/contrast'
import { SKINS } from '../src/skin'
import { SHELL_SIZES, shellBreakpoints } from '../src/ui/shellLayout'
import { measure, type LayoutMeasurement, type Measured } from './measure'
import { withPreparation } from './lifecycle'

export type { LayoutMeasurement } from './measure'
export type AuditFinding = Measured

export interface AuditScreen {
  name: string
  /** URL に載せた状態で開く（baseURL からの相対） */
  path: string
  /** 開いたあとの操作（パネルを開く・メニューを押すなど） */
  act?: (page: Page) => Promise<unknown>
  /** アクセシビリティの設定を選んだ状態で開く */
  assist?: Partial<Assist>
  /** axe の測定中だけ適用する処理。prepare の途中失敗でも restore を呼ぶ */
  axe?: { prepare: (page: Page) => Promise<unknown>; restore: (page: Page) => Promise<unknown> }
  /** 指定した段組み測定を採用側で置換する。他の共通測定は維持する */
  layout?: { replace: LayoutMeasurement[]; measure: (page: Page) => Promise<AuditFinding[]> }
}
export interface AuditWidth {
  name: string
  width: number
  height: number
  /** この画面（name）だけを開く。無ければ全画面 */
  screens?: string[]
}
/** 7 章「状態で表示が変わる部品」: 操作の前後で箱と文字の位置が変わらないこと */
export interface AuditState {
  name: string
  path: string
  before: string
  act: (page: Page) => Promise<unknown>
  after: string
}
export interface IgniteAuditConfig {
  screens: AuditScreen[]
  /** 既定は DEFAULT_WIDTHS */
  widths?: AuditWidth[]
  states?: AuditState[]
  /** 重ねた詳細パネルを開いた画面（5 章「操作の結果を見える場所に出す」）。中のボタンを 1 つずつ押す */
  reveals?: { name: string; path: string }[]
  /** 主役の状態に数えない URL のパラメータ（reveals 用。既定は open・tab・mode・skin） */
  panelParams?: string[]
  /** タッチの端末で入力欄の文字を測る画面（name）。既定は全画面（assist を除く） */
  touchScreens?: string[]
  /** ホバーを測る、開いたときにだけ出る部品の画面 */
  hoverScreens?: AuditScreen[]
  /** ホバーを測らないセレクタ（8 章の例外。アプリの部品の分） */
  hoverSkip?: string[]
  /** アプリの部品の分の測る対象を足す */
  rows?: string[]
  overflow?: string[]
  bars?: string[]
  frames?: string[]
  /** アプリのトークンの組（DESIGN.md 2 章） */
  contrastRules?: ContrastRule[]
  /** 決まりに書いてある例外。キーは「決まり どこ 期待 実際」。足すときは先に文書へ書く */
  exceptions?: { match: RegExp; why: string }[]
  /** 画面を開いて準備ができるまで待つ */
  open?: (page: Page, path: string) => Promise<unknown>
  /** ページの時計（日付で結果が変わるアプリ向け） */
  today?: Date
  outDir?: string
}

export const DEFAULT_WIDTHS: AuditWidth[] = [
  { name: 'PC', width: 1440, height: 900 },
  { name: '小さな窓', width: 600, height: 800 },
  { name: 'スマホ', width: 375, height: 812 },
]

const FONT_SIZES = [11, 12, 13, 14, 16, 20, 24, 32]
const FONT_WEIGHTS = ['400', '600', '700']
const RADII = [0, 3, 6, 8, 10, 12, 14, 99]
const BASE_EXCEPTIONS = [
  { match: /^文字の大きさ .*\.av\.xs .* 10px$/, why: 'DESIGN.md 3 章: 20px の顔アイコンの頭文字は 10px' },
  { match: /^文字の大きさ .*\.av\.xl .* 26px$/, why: 'avatar.css の design-ok: 72px の顔アイコンの頭文字' },
]
// 8 章の例外（今選んでいて押しても変わらないもの・入れ物）
const BASE_HOVER_SKIP = ['.seg button[aria-pressed="true"]', '[role="tab"][aria-selected="true"]', '[aria-current="page"]', '.erow.on', '.swatch[aria-pressed="true"]', '.mark-sw[aria-pressed="true"]', '.tm-tile[aria-pressed="true"]', '.cal-d.on', '.select-opt.on', '[role="region"]', '[role="group"]', '[role="tablist"]']
// 測るあいだに消える部品（時間で消える知らせなど）を待ち続けず、飛ばす
const GONE = { timeout: 1000 }
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

type Finding = { rule: string; where: string; expected: string; actual: string }

const withParams = (p: string, params: Record<string, string>) => {
  const u = new URL(p, 'http://x')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return u.pathname + u.search
}

async function axe(page: Page): Promise<Finding[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  // 詰めて並べた顔アイコン（.avstack.tight）の押す面は例外（DESIGN.md 12 章「押す面」）
  const tight = await page.evaluate((sels) => sels.map((sel) => !!document.querySelector(sel)?.closest('.avstack.tight')), r.violations.flatMap((v) => (v.id === 'target-size' ? v.nodes.map((n) => String(n.target[0])) : [])))
  let t = 0
  r.violations.forEach((v) => v.id === 'target-size' && (v.nodes = v.nodes.filter(() => !tight[t++])))
  return r.violations.flatMap((v) => v.nodes.map((n) => ({ rule: `アクセシビリティ（12 章・axe ${v.id}）`, where: n.target.join(' '), expected: v.help, actual: n.failureSummary?.split('\n').slice(1).join(' ').trim() || v.impact || '' })))
}

/** 箱の上端・高さと、最初の文字の左・下端（箱からの距離） */
async function boxOf(page: Page, selector: string) {
  const el = page.locator(selector).first()
  if (!(await el.isVisible())) return null
  return el.evaluate((node) => {
    const r = node.getBoundingClientRect()
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) })
    const text = walker.nextNode()
    const range = document.createRange()
    if (text) range.selectNodeContents(text)
    const g = text ? range.getClientRects()[0] : null
    return { 上端: r.top, 高さ: r.height, 文字の左: g ? g.left - r.left : 0, 文字の下端: g ? g.bottom - r.top : 0 }
  })
}

/** Playwright のテストとして監査を登録する。アプリの e2e/ignite.audit.ts から呼ぶ */
export function defineIgniteAudit(config: IgniteAuditConfig): void {
  const screens = config.screens
  const widths = config.widths ?? DEFAULT_WIDTHS
  const states = config.states ?? []
  const reveals = config.reveals ?? []
  const outDir = config.outDir ?? path.join(process.cwd(), 'test-results-audit')
  const exceptions = [...BASE_EXCEPTIONS, ...(config.exceptions ?? [])]
  const hoverSkip = [...BASE_HOVER_SKIP, ...(config.hoverSkip ?? [])].join(',')
  const panelParams = config.panelParams ?? ['open', 'tab', 'mode', 'skin']
  const bp = shellBreakpoints()
  const args = {
    FONT_SIZES,
    FONT_WEIGHTS,
    RADII,
    SHELL: { overlayBelow: bp.overlayBelow, sideMinBelow: bp.railBelow, drawerSideAt: SHELL_SIZES.drawerAt, minBoard: SHELL_SIZES.mainMin, rail: SHELL_SIZES.side.rail },
    rows: [':scope > .kpis-wrap', ':scope > .shell-aux > .kpis-wrap', ':scope > .content .board', ':scope > .board', ':scope > .dash > *', ':scope > .content > .dash > *', ...(config.rows ?? [])].join(', '),
    overflow: ['.dash', '.kpis', '.seg', '.tabs', ...(config.overflow ?? [])].join(', '),
    bars: ['header.top', '.lscreen-bar', ...(config.bars ?? [])].join(', '),
    frames: ['.board', '.pslot > *', '.kpis', '.popover-body', '.drawer', ...(config.frames ?? [])].join(', '),
  }

  const findings = new Map<string, Finding & { count: number; screens: Set<string> }>()
  const shots: string[] = []
  const hovered = new Map<string, string>()
  const record = (key: string, f: Finding, screen: string) => {
    const cur = findings.get(key) ?? { ...f, count: 0, screens: new Set<string>() }
    cur.count++
    cur.screens.add(screen)
    findings.set(key, cur)
  }

  const test = base.extend<{ pageErrors: string[] }>({
    pageErrors: [
      async ({ page }, use) => {
        const errors: string[] = []
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(`console: ${m.text()}`)
        })
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
        if (config.today) await page.clock.install({ time: config.today })
        // 外には出ず 1px の画像を返す（ネットワークの有無で結果が変わらないように）
        await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }))
        await use(errors)
        // 落とすと直列の残りの画面が測られないので、指摘として記録して最後まで測る
        for (const e of errors) record(`エラー ${e}`, { rule: 'コンソールのエラー', where: page.url().replace(/^https?:\/\/[^/]+/, ''), expected: 'エラーが出ない', actual: e.split('\n')[0].slice(0, 200) }, page.url())
      },
      { auto: true },
    ],
  })
  const open = config.open ?? (async (page: Page, p: string) => {
    await page.goto(p)
    // 開発サーバーの最初の表示は依存の事前処理で待たされる
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30000 })
    await expect(page.locator('#boot')).toHaveCount(0)
  })

  test.describe.configure({ mode: 'serial' })
  // 前回のスクリーンショットを残さない（番号が変わると取り違えるため）
  test.beforeAll(() => fs.rmSync(outDir, { recursive: true, force: true }))

  for (const w of widths) {
    for (const s of screens.filter((s) => !w.screens || w.screens.includes(s.name))) {
      test(`${s.name}（${w.name}）`, async ({ page }) => {
        await page.setViewportSize({ width: w.width, height: w.height })
        if (s.assist) await page.addInitScript((a) => localStorage.setItem('ds.assist', JSON.stringify(a)), s.assist)
        await open(page, s.path)
        if (s.act) await s.act(page)
        // 出てくる動き（フェードイン・パネルの出し入れ）が終わってから測る
        await page.waitForTimeout(1200)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        const measured = await measure(page, { ...args, skipLayout: s.layout?.replace })
        const extra = s.layout ? await s.layout.measure(page) : []
        const hooks = s.axe
        const accessible = hooks
          ? await withPreparation(() => hooks.prepare(page), () => hooks.restore(page), () => axe(page))
          : await axe(page)
        for (const f of [...measured, ...extra, ...accessible]) {
          if (exceptions.some((e) => e.match.test(`${f.rule.replace(/（.*）/, '')} ${f.where} ${f.expected} ${f.actual}`))) continue
          record(`${f.rule} ${f.where} ${f.expected} ${f.actual}`, f, `${s.name}（${w.name}）`)
        }
        fs.mkdirSync(outDir, { recursive: true })
        const file = `${String(shots.length + 1).padStart(2, '0')}-${s.name}-${w.name}.png`.replace(/[（）\s/]/g, '_')
        await page.screenshot({ path: path.join(outDir, file) })
        shots.push(`${file}（${s.name}・${w.name}）`)
      })
    }
  }

  for (const w of widths.filter((w) => !w.screens)) {
    for (const s of states) {
      test(`${s.name}（${w.name}）`, async ({ page }) => {
        await page.setViewportSize({ width: w.width, height: w.height })
        await open(page, s.path)
        await page.waitForTimeout(800)
        const before = await boxOf(page, s.before)
        if (!before) return // 狭い幅で畳まれて見えないものは測らない
        await s.act(page)
        await page.waitForTimeout(800)
        const after = await boxOf(page, s.after)
        const diffs = after ? Object.entries(before).filter(([k, v]) => Math.abs(v - after[k as keyof typeof after]) >= 0.5).map(([k, v]) => `${k} ${v.toFixed(1)}→${after[k as keyof typeof after].toFixed(1)}px`) : ['操作のあとに見えない']
        if (!diffs.length) return
        const f = { rule: '状態で箱がずれない（7 章）', where: `${s.name}: ${s.before}${s.after === s.before ? '' : ` → ${s.after}`}`, expected: '同じ上端・高さ・文字の位置', actual: diffs.join('、') }
        record(`${f.rule} ${f.where} ${f.actual}`, f, `${s.name}（${w.name}）`)
      })
    }
  }

  const mainState = (url: string) => {
    const p = new URL(url).searchParams
    for (const k of panelParams) p.delete(k)
    p.sort()
    return p.toString()
  }
  const inDrawer = 'button:visible:not([aria-label*="閉じる"]):not([role="tab"]):not([inert] *)'
  for (const w of widths.filter((w) => w.width <= 600 && !w.screens)) {
    for (const r of reveals) {
      test(`${r.name}: 裏の画面を変える操作の結果が見える（${w.name}）`, async ({ page }) => {
        test.setTimeout(240000)
        await page.setViewportSize({ width: w.width, height: w.height })
        await open(page, r.path)
        const drawer = page.locator('.drawer')
        if (!(await drawer.isVisible())) return
        const n = Math.min(await drawer.locator(inDrawer).count(), 40)
        for (let i = 0; i < n; i++) {
          await open(page, r.path)
          const b = page.locator('.drawer').locator(inDrawer).nth(i)
          if (!(await b.isVisible())) continue
          const label = ((await b.getAttribute('aria-label')) || (await b.innerText())).trim().split('\n')[0].slice(0, 30)
          const before = mainState(page.url())
          await b.click()
          await page.waitForTimeout(600)
          if (mainState(page.url()) === before || !(await page.locator('.drawer:not(.peek)').isVisible())) continue
          record(`操作の結果 ${r.name} ${label}`, { rule: '操作の結果を見える場所に出す（5 章）', where: `${r.name}: 「${label}」`, expected: '重ねた詳細を畳んで裏の変化を見せる（useShell().revealMain）', actual: '裏の画面が変わったのに、詳細が全面のまま' }, `${r.name}（${w.name}）`)
        }
      })
    }
  }

  // 3 章: タッチの端末では入力欄の文字を 16px 以上にする
  for (const s of screens.filter((s) => (config.touchScreens ? config.touchScreens.includes(s.name) : !s.assist))) {
    test(`${s.name}（タッチの端末の入力欄）`, async ({ browser, baseURL }) => {
      const ctx = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' })
      const page = await ctx.newPage()
      await open(page, s.path)
      if (s.act) await s.act(page)
      const sizes = await page.locator('input:not([type="checkbox"]):not([type="radio"]):visible, textarea:visible').evaluateAll((els) => els.map((el) => ({ label: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName, size: parseFloat(getComputedStyle(el).fontSize) })))
      await ctx.close()
      for (const x of sizes.filter((x) => x.size < 16)) {
        const f = { rule: 'タッチの端末の入力欄は 16px 以上（3 章）', where: `${s.name}: ${x.label}`, expected: '16px 以上', actual: `${x.size}px` }
        record(`${f.rule} ${f.where} ${f.actual}`, f, `${s.name}（タッチ）`)
      }
    })
  }

  // 8 章「ホバー」「押している間」: 押せる要素は、載せると変わり、押している間はもう一段変わる。:active は DevTools の仕組みで作る
  for (const s of [...screens.filter((s) => !s.assist), ...(config.hoverScreens ?? [])]) {
    test(`${s.name}（ホバー）`, async ({ page }) => {
      test.setTimeout(240000)
      await page.setViewportSize({ width: 1440, height: 900 })
      await open(page, s.path)
      if (s.act) await s.act(page)
      await page.waitForTimeout(1200)
      const targets = await page.evaluate((SKIP) => {
        const SEL = 'a[href], button, input:not([type="hidden"]), textarea, select, summary, label:has(> input), [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"], [role="menuitem"], [role="link"], [tabindex]:not([tabindex="-1"])'
        const who = (el: Element) => {
          const cls = [...el.classList].filter((c) => !/^c\d$/.test(c)).slice(0, 3).join('.')
          return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''}${el instanceof HTMLInputElement ? `[type=${el.type}]` : ''}`
        }
        const seen = new Set<string>()
        const out: { i: number; where: string; label: string }[] = []
        let i = 0
        for (const el of [...document.querySelectorAll(SEL), ...[...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).cursor === 'pointer')]) {
          if (el.closest('label:has(> input)') && el.matches('input')) continue
          // 指のカーソルは中の要素に受け継がれるので、押せる要素の中身や、親から受け継いだだけのものは数えない
          if (!el.matches(SEL) && (el.parentElement?.closest(SEL) || (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer'))) continue
          if (el.matches(SKIP) || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue
          const r = el.getBoundingClientRect()
          if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
          const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2)
          const hit = document.elementFromPoint(x, y)
          if (!hit || !(el === hit || el.contains(hit) || (el instanceof HTMLLabelElement && el.control === hit))) continue
          // 同じ形の要素でも、置き場所（親）が違えば別の部品として数える
          const parent = el.parentElement?.closest(SEL)
          const key = `${parent ? who(parent) + ' ' : ''}${el.parentElement && el.parentElement !== parent ? who(el.parentElement) + ' > ' : ''}${who(el)}`
          if (seen.has(key)) continue
          seen.add(key)
          el.setAttribute('data-hover-audit', String(i))
          out.push({ i: i++, where: key, label: (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('placeholder') || '').trim().split('\n')[0].slice(0, 20) })
        }
        return out
      }, hoverSkip)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('DOM.enable')
      await cdp.send('CSS.enable')
      const press = async (i: number, on: boolean) => {
        if (on) await page.evaluate((n) => { for (let e = document.querySelector(`[data-hover-audit="${n}"]`); e; e = e.parentElement) e.setAttribute('data-press-audit', '') }, i)
        const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
        const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-press-audit]' })
        for (const nodeId of nodeIds) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: on ? ['active'] : [] })
        if (!on) await page.evaluate(() => document.querySelectorAll('[data-press-audit]').forEach((e) => e.removeAttribute('data-press-audit')))
      }
      /** 要素とその中の、ホバーで変えうる見た目（::after は吹き出しなので除く） */
      const look = (i: number) =>
        page.locator(`[data-hover-audit="${i}"]`).evaluate((el) => {
          const P = ['color', 'background-color', 'background-image', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'box-shadow', 'text-decoration-line', 'opacity', 'outline-style', 'filter', 'transform', 'scale']
          const pick = (cs: CSSStyleDeclaration) => P.map((p) => cs.getPropertyValue(p)).join('|')
          const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height }
          const up: Element[] = []
          for (let p = el.parentElement; p && area(p) <= area(el) * 1.5; p = p.parentElement) up.push(p)
          return [...up, el, ...el.querySelectorAll('*')].flatMap((e) => [pick(getComputedStyle(e)), pick(getComputedStyle(e, '::before'))]).join('\n')
        }, undefined, GONE)
      for (const t of targets) {
        hovered.set(t.where, hovered.get(t.where) || t.label)
        const el = page.locator(`[data-hover-audit="${t.i}"]`)
        const box = await el.boundingBox(GONE).catch(() => null)
        if (!box) continue
        await page.mouse.move(0, 899)
        await page.waitForTimeout(250)
        const before = await look(t.i).catch(() => null)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(300)
        const after = await look(t.i).catch(() => null)
        if (before === null || after === null) continue
        if (before === after) {
          // 8 章: 入力欄はフォーカス中はフォーカスの見せ方が勝つ（Dialog が開くと最初の欄にフォーカスがある）
          if (await el.evaluate((e) => e === document.activeElement && e.matches('input, textarea'), undefined, GONE).catch(() => true)) continue
          record(`ホバー ${t.where}`, { rule: 'ホバーで見た目が変わる（8 章）', where: t.where, expected: 'マウスを載せると地・枠・文字の色などが変わる', actual: `変わらない（「${t.label}」）` }, `${s.name}（ホバー）`)
          continue
        }
        if (await el.evaluate((e) => e.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select'), undefined, GONE).catch(() => true)) continue
        await press(t.i, true)
        await page.waitForTimeout(50)
        const pressed = await look(t.i).catch(() => null)
        await press(t.i, false)
        if (pressed === null || pressed !== after) continue
        record(`押している間 ${t.where}`, { rule: '押している間に見た目が変わる（8 章）', where: t.where, expected: '押している間はホバーからもう一段、地・枠・文字の色などが変わる', actual: `ホバーのまま（「${t.label}」）` }, `${s.name}（押している間）`)
      }
    })
  }

  // 2 章「コントラスト」: トークンの組が、どのスキン・表示モードでも決めた比を下回らない。描いた色（color-mix の結果）で測る
  for (const skin of SKINS) {
    for (const mode of ['light', 'dark'] as const) {
      for (const more of [false, true]) {
        const label = `${skin}・${mode}${more ? '・強く' : ''}`
        test(`色のコントラスト（${label}）`, async ({ page }) => {
          if (more) await page.addInitScript(() => localStorage.setItem('ds.assist', JSON.stringify({ contrast: 'more' })))
          await open(page, withParams(screens[0].path, { skin, mode }))
          if (more) await expect(page.locator('html')).toHaveAttribute('data-contrast', 'more')
          await expect(page.locator('html')).toHaveAttribute('data-mode', mode)
          const rules = [...contrastRulesFor(more), ...(config.contrastRules ?? [])]
          const tokens = [...new Set(rules.flatMap((r) => [r.fg, r.bg]))]
          // 描いた色を 1px のキャンバスに塗って読む（color-mix の結果は rgb() の形で返らないことがあるため）
          const colors = await page.evaluate((names) => {
            const probe = document.body.appendChild(document.createElement('i'))
            const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })!
            const out: Record<string, [number, number, number]> = {}
            for (const name of names) {
              probe.style.color = `var(${name})`
              ctx.fillStyle = '#fff'
              ctx.fillRect(0, 0, 1, 1)
              ctx.fillStyle = getComputedStyle(probe).color
              ctx.fillRect(0, 0, 1, 1)
              const d = ctx.getImageData(0, 0, 1, 1).data
              out[name] = [d[0], d[1], d[2]]
            }
            probe.remove()
            return out
          }, tokens)
          for (const r of rules) {
            // スキンごとの例外はライトだけ
            const min = (mode === 'light' && r.except?.[skin]) || r.min
            const ratio = contrastRatio(colors[r.fg], colors[r.bg])
            if (ratio < min) record(`コントラスト ${label} ${r.fg} ${r.bg}`, { rule: '色のコントラスト（2 章）', where: `${label}: ${r.fg} / ${r.bg}（${r.use}）`, expected: `${min} 以上`, actual: ratio.toFixed(2) }, `コントラスト（${label}）`)
          }
        })
      }
    }
  }

  test('決まりから外れたところがない', () => {
    expect([...findings.values()].map((r) => `${r.rule} ${r.where}: 期待 ${r.expected} / 実際 ${r.actual}（${r.count} 件）`), 'test-results-audit/report.md を見る').toEqual([])
  })

  test.afterAll(() => {
    const rows = [...findings.values()].sort((a, b) => a.rule.localeCompare(b.rule) || b.count - a.count)
    const lines = [
      '# Ignite のデザイン監査（描いた画面の測定）',
      '',
      `- 画面: ${screens.map((s) => s.name).join('・')} × ${widths.map((w) => `${w.name} ${w.width}×${w.height}`).join('・')}`,
      `- 状態の切り替え: ${states.map((s) => s.name).join('・') || 'なし'}`,
      `- 決まりから外れたところ: ${rows.length} 種類（同じ要素・同じ値はまとめて件数にする）`,
      '',
      '| 決まり | どこ | 期待 | 実際 | 件数 | 画面 |',
      '|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.rule} | \`${r.where}\` | ${r.expected} | ${r.actual} | ${r.count} | ${[...r.screens].slice(0, 3).join('、')}${r.screens.size > 3 ? ` ほか ${r.screens.size - 3}` : ''} |`),
      '',
      `## ホバー・押している間を確かめた部品（${hovered.size} 種類）`,
      '',
      ...[...hovered].sort(([a], [b]) => a.localeCompare(b)).map(([w, l]) => `- \`${w}\`${l ? `（「${l}」）` : ''}`),
      '',
      '## スクリーンショット（目で確かめる決まりの確認用）',
      '',
      ...shots.map((s) => `- ${s}`),
      '',
    ]
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'))
    console.log(`\nIgnite の監査: 決まりから外れたところ ${rows.length} 種類 → ${path.relative(process.cwd(), path.join(outDir, 'report.md'))}`)
  })
}
