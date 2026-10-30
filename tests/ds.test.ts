import { describe, expect, it } from 'vitest'

// 部品の純粋な関数のテスト
import { DEFAULT_ASSIST, applyAssist, assistChanged, currentAssist, parseAssist, sameAssist, setAssist, shortcutsOn, startAssist, type AssistEnv } from '../src/index'
import { CONTRAST_TEXT_MORE, contrastRulesFor, releaseDays } from '../src/index'
import { lineRows, lineSummary, seriesSummary, stackRows, tileName } from '../src/ui/Chart'
import { CONTRAST_RULES, CONTRAST_TEXT, CONTRAST_UI, contrastRatio, currentTheme, isMode, isSkin, kpiVariants, pickFitStep, pickTheme, pickWidestFit, setTheme, shellBreakpoints, shellLayout, squarify, startTheme, type ThemeEnv } from '../src/index'

const at = (width: number, o: { collapsed?: boolean; panelOpen?: boolean; keepSide?: boolean } = {}) =>
  shellLayout({ width, collapsed: o.collapsed ?? false, panelOpen: o.panelOpen ?? true, keepSide: o.keepSide })

describe('アプリの枠の骨組み（shellLayout）', () => {
  it('区切りは寸法から計算で出る（左右の余白の下限 8px で。左右の余白が下限になる 1180px より狭い）', () => {
    expect(shellBreakpoints()).toEqual({ compactBelow: 1405, railBelow: 986, overlayBelow: 814 })
  })


  it('パネルを閉じていても、狭くなると 広げる → 畳む → 引き出し の順（畳む幅はパネルを開いたときと同じ）', () => {
    expect(at(1440, { panelOpen: false })).toEqual({ side: 'full', panel: 'none', panelW: 0, autoRail: false })
    expect(at(1440, { panelOpen: false, collapsed: true })).toEqual({ side: 'rail', panel: 'none', panelW: 0, autoRail: false })
    expect(at(986, { panelOpen: false }).side).toBe('full')
    expect(at(985, { panelOpen: false })).toEqual({ side: 'rail', panel: 'none', panelW: 0, autoRail: true })
    expect(at(601, { panelOpen: false })).toEqual({ side: 'rail', panel: 'none', panelW: 0, autoRail: true })
    expect(at(600, { panelOpen: false })).toEqual({ side: 'drawer', panel: 'none', panelW: 0, autoRail: false })
    // つまみで広げたら、畳む幅より広くなるまで広げたまま。畳めないアプリは自動で畳まない
    expect(at(900, { panelOpen: false, keepSide: true }).side).toBe('full')
    expect(shellLayout({ width: 900, collapsed: false, panelOpen: false, railable: false }).side).toBe('full')
  })

  it('幅が足りなくなると、パネルを詰める → 左メニューを畳む → 重ねる の順', () => {
    expect(at(1440)).toEqual({ side: 'full', panel: 'full', panelW: 380, autoRail: false })
    expect(at(1405)).toEqual({ side: 'full', panel: 'full', panelW: 380, autoRail: false })
    // パネルは主役とパネルに使える幅の 1/3 で、窓に合わせてなめらかに縮む（下限 320px）
    expect(at(1404)).toEqual({ side: 'full', panel: 'compact', panelW: 379, autoRail: false })
    expect(at(1300)).toEqual({ side: 'full', panel: 'compact', panelW: 345, autoRail: false })
    expect(at(1190)).toEqual({ side: 'full', panel: 'compact', panelW: 320, autoRail: false })
    expect(at(986)).toEqual({ side: 'full', panel: 'compact', panelW: 320, autoRail: false })
    expect(at(985)).toEqual({ side: 'rail', panel: 'compact', panelW: 320, autoRail: true })
    expect(at(860)).toEqual({ side: 'rail', panel: 'compact', panelW: 320, autoRail: true })
    expect(at(814)).toEqual({ side: 'rail', panel: 'compact', panelW: 320, autoRail: true })
    // 重ねても左メニューは畳んだまま（引き出しにするのはスマホの幅だけ）
    expect(at(813)).toEqual({ side: 'rail', panel: 'overlay', panelW: 0, autoRail: true })
    expect(at(601)).toEqual({ side: 'rail', panel: 'overlay', panelW: 0, autoRail: true })
    expect(at(600)).toEqual({ side: 'drawer', panel: 'overlay', panelW: 0, autoRail: false })
    expect(at(375).panel).toBe('overlay')
  })

  it('左メニューを畳んでいれば、空いた幅の分だけパネルを広く保つ', () => {
    // 畳んだ左メニュー（64px）なら 1233px 以上で 380px のパネルが入る
    expect(at(1233, { collapsed: true })).toEqual({ side: 'rail', panel: 'full', panelW: 380, autoRail: false })
    expect(at(1232, { collapsed: true }).panelW).toBe(379)
    expect(at(1190, { collapsed: true }).panelW).toBe(365)
  })

  it('左メニューを畳めないアプリでは、自動で畳まずにパネルを重ねる', () => {
    expect(shellLayout({ width: 900, collapsed: false, panelOpen: true, railable: false })).toEqual({ side: 'full', panel: 'overlay', panelW: 0, autoRail: false })
  })

  it('窓を 1px ずつ狭めても、左メニューは 広げる → 畳む → 引き出し、パネルは 並べる → 詰める → 重ねる の順にしか進まず、段を飛ばさない', () => {
    const SIDE = ['full', 'rail', 'drawer']
    const PANEL = ['full', 'compact', 'overlay']
    for (const panelOpen of [false, true]) {
      const seen: string[] = []
      let side = 0
      let panel = 0
      let lastW = 0
      for (let w = 1600; w >= 320; w--) {
        const l = at(w, { panelOpen })
        const s = SIDE.indexOf(l.side)
        expect(s - side, `${w}px の左メニュー ${l.side}`).toBeGreaterThanOrEqual(0)
        expect(s - side, `${w}px の左メニュー ${l.side}`).toBeLessThanOrEqual(1)
        side = s
        if (!seen.includes(l.side)) seen.push(l.side)
        if (panelOpen) {
          const p = PANEL.indexOf(l.panel)
          expect(p - panel, `${w}px のパネル ${l.panel}`).toBeGreaterThanOrEqual(0)
          expect(p - panel, `${w}px のパネル ${l.panel}`).toBeLessThanOrEqual(1)
          panel = p
          // 横に並べているあいだ、パネルの幅は窓を狭めても広がらず、1px に 1px 以下でなめらかに縮む
          if (l.panelW > 0 && lastW > 0) expect(lastW - l.panelW, `${w}px のパネルの幅`).toBeGreaterThanOrEqual(0)
          if (l.panelW > 0 && lastW > 0) expect(lastW - l.panelW, `${w}px のパネルの幅`).toBeLessThanOrEqual(1)
          lastW = l.panelW
        }
      }
      expect(seen).toEqual(SIDE)
    }
  })

  it('つまみで広げたら、自動で畳む幅のあいだは畳まない（主役が狭くても横に並べたまま）', () => {
    expect(at(900, { keepSide: true })).toEqual({ side: 'full', panel: 'compact', panelW: 320, autoRail: false })
  })
})

describe('詰める段階の選び方（@ds の pickFitStep）', () => {
  it('入る最初の段階を選び、どれも入らなければ最後の段階', () => {
    const widths = [650, 620, 560, 315, 275, 230]
    expect(pickFitStep(700, widths)).toBe(0)
    expect(pickFitStep(630, widths)).toBe(1)
    expect(pickFitStep(560, widths)).toBe(2)
    expect(pickFitStep(307, widths)).toBe(4)
    expect(pickFitStep(252, widths)).toBe(5)
    expect(pickFitStep(200, widths)).toBe(5)
  })
})

describe('KPI の帯の畳み方（KpiBand）', () => {
  it('開く・まとめるの組み合わせは、先のまとまりを開くほうから', () => {
    expect(kpiVariants(2)).toEqual([[true, true], [true, false], [false, true], [false, false]])
    expect(kpiVariants(0)).toEqual([[]])
  })
  // [両方開く, 組織格だけ開く, 拠点だけ開く, 両方畳む]
  it('入るもののうち幅をいちばん使うものを選ぶ（組織格を畳んでも拠点が入るなら拠点を開く）', () => {
    expect(pickWidestFit([900, 700, 560, 420], 1000)).toBe(0)
    expect(pickWidestFit([900, 700, 560, 420], 800)).toBe(1)
    expect(pickWidestFit([900, 500, 640, 420], 700)).toBe(2)
    expect(pickWidestFit([900, 700, 560, 420], 600)).toBe(2)
    expect(pickWidestFit([900, 700, 560, 420], 500)).toBe(3)
  })
  it('同じ幅なら先のもの、どれも入らなければいちばん狭いもの', () => {
    expect(pickWidestFit([900, 600, 600, 420], 700)).toBe(1)
    expect(pickWidestFit([900, 700, 560, 420], 300)).toBe(3)
  })
})

describe('タイルの敷き詰め（squarify）', () => {
  const area = (t: { w: number; h: number }) => t.w * t.h
  it('面積は大きさに比例し、枠をすき間なく埋める。大きい順に置く', () => {
    const tiles = squarify([{ n: 'b', v: 2 }, { n: 'a', v: 6 }, { n: 'c', v: 4 }, { n: 'd', v: 0 }], (t) => t.v, 600, 400)
    expect(tiles.map((t) => t.item.n)).toEqual(['a', 'c', 'b'])
    tiles.forEach((t) => expect(area(t)).toBeCloseTo((t.item.v / 12) * 600 * 400, 6))
    expect(tiles.reduce((a, t) => a + area(t), 0)).toBeCloseTo(600 * 400, 6)
    tiles.forEach((t) => { expect(t.x + t.w).toBeLessThanOrEqual(600 + 1e-6); expect(t.y + t.h).toBeLessThanOrEqual(400 + 1e-6) })
  })
  it('同じ大きさを並べると正方形に近くなる（縦長の枠でも）', () => {
    const tiles = squarify([1, 1, 1, 1], (v) => v, 200, 200)
    tiles.forEach((t) => { expect(t.w).toBeCloseTo(100, 6); expect(t.h).toBeCloseTo(100, 6) })
    const tall = squarify([3, 2, 1], (v) => v, 100, 600)
    tall.forEach((t) => expect(Math.max(t.w / t.h, t.h / t.w)).toBeLessThanOrEqual(3 + 1e-9))
  })
  it('置くものがない・枠がないときは空', () => {
    expect(squarify([], () => 1, 100, 100)).toEqual([])
    expect(squarify([0], (v) => v, 100, 100)).toEqual([])
    expect(squarify([1], (v) => v, 0, 100)).toEqual([])
  })
})

describe('テーマ（スキンとライト／ダーク。pickTheme・startTheme・setTheme）', () => {
  const memory = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init))
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
  }
  /** 偽の環境。osDark は端末がダークの設定か（変えてから fire() で「設定が変わった」を知らせる） */
  const newEnv = (store: ThemeEnv['store'] = memory()) => {
    const state = { osDark: false, fire: () => {} }
    const env: ThemeEnv = { root: { dataset: {} }, store, dark: () => state.osDark, watch: (cb) => void (state.fire = cb) }
    return { env, state }
  }

  it('項目ごとに URL の指定 → 前に選んだもの → 既定 の順に決め、知らない名前は飛ばす', () => {
    expect(pickTheme()).toEqual({ skin: 'red', mode: 'light' })
    expect(pickTheme({ skin: 'blue', mode: 'dark' })).toEqual({ skin: 'blue', mode: 'dark' })
    expect(pickTheme({ skin: 'blue' }, { skin: 'green', mode: 'auto' })).toEqual({ skin: 'green', mode: 'auto' })
    expect(pickTheme({ skin: 'neon', mode: null }, { skin: 'yellow', mode: 'sepia' })).toEqual({ skin: 'red', mode: 'light' })
    expect(pickTheme({ skin: 'green' }, { skin: 'neon' })).toEqual({ skin: 'green', mode: 'light' })
    expect(isSkin('green')).toBe(true)
    expect(isSkin(undefined)).toBe(false)
    expect(isMode('auto')).toBe(true)
  })

  it('起動時に既定を当て、URL で指定したものだけを覚えて次からも使う', async () => {
    const store = memory(), { env } = newEnv(store)
    expect(await startTheme({}, env)).toEqual({ skin: 'red', mode: 'light' })
    expect(env.root.dataset).toEqual({ skin: 'red', mode: 'light', modePref: 'light' })
    expect(store.m.size).toBe(0)

    expect(await startTheme(Promise.resolve({ skin: 'blue' }), env)).toEqual({ skin: 'blue', mode: 'light' })
    expect([...store.m]).toEqual([['ds.skin', 'blue']])
    // 次に URL の指定なしで開いても、覚えたスキンのまま。知らない名前は覚えない
    expect(await startTheme({ skin: 'neon', mode: 'dark' }, env)).toEqual({ skin: 'blue', mode: 'dark' })
    expect(env.root.dataset.mode).toBe('dark')
    expect(store.m.get('ds.skin')).toBe('blue')
  })

  it('設定から切り替えると、その場で当てて覚える。今のテーマは <html> の属性から読む', async () => {
    const store = memory(), { env } = newEnv(store)
    expect(currentTheme(env)).toEqual({ skin: 'red', mode: 'light' })
    setTheme({ skin: 'green', mode: 'dark' }, env)
    expect(currentTheme(env)).toEqual({ skin: 'green', mode: 'dark' })
    expect(await startTheme({}, newEnv(store).env)).toEqual({ skin: 'green', mode: 'dark' })
  })

  it('「端末に合わせる」は端末の設定でライト／ダークを決め、設定が変わったら当て直す', async () => {
    const { env, state } = newEnv()
    await startTheme({}, env)
    setTheme({ skin: 'red', mode: 'auto' }, env)
    expect(env.root.dataset).toEqual({ skin: 'red', mode: 'light', modePref: 'auto' })
    expect(currentTheme(env).mode).toBe('auto')
    state.osDark = true
    state.fire()
    expect(env.root.dataset.mode).toBe('dark')
    // ライト・ダークを選んでいるあいだは、端末の設定が変わっても変えない
    setTheme({ skin: 'red', mode: 'light' }, env)
    state.fire()
    expect(env.root.dataset.mode).toBe('light')
  })

  it('保存先が使えなくても、この表示には当てる', async () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    const { env } = newEnv(broken)
    expect(await startTheme({ skin: 'blue' }, env)).toEqual({ skin: 'blue', mode: 'light' })
    setTheme({ skin: 'green', mode: 'dark' }, env)
    expect(env.root.dataset.mode).toBe('dark')
    expect(await startTheme({}, newEnv(null).env)).toEqual({ skin: 'red', mode: 'light' })
  })
})

describe('色のコントラスト（contrastRatio・CONTRAST_RULES）', () => {
  it('コントラスト比は 1（同じ色）〜 21（白と黒）。順番は問わない', () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5)
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
    expect(contrastRatio([120, 120, 120], [120, 120, 120])).toBe(1)
    // よく知られた値: #767676 は白の上でちょうど 4.5 を超える
    expect(contrastRatio([0x76, 0x76, 0x76], [255, 255, 255])).toBeGreaterThanOrEqual(CONTRAST_TEXT)
    expect(contrastRatio([0x77, 0x77, 0x77], [255, 255, 255])).toBeLessThan(CONTRAST_TEXT)
  })

  it('決まりは文字が 4.5、文字でないものが 3。例外は決まりより緩い値だけ', () => {
    for (const r of CONTRAST_RULES) {
      expect([CONTRAST_TEXT, CONTRAST_UI]).toContain(r.min)
      for (const v of Object.values(r.except ?? {})) expect(v).toBeLessThan(r.min)
    }
  })
})

describe('アクセシビリティの設定（assist.ts）', () => {
  const fakeEnv = (stored: string | null = null, media: Record<string, boolean> = {}) => {
    const saved: Record<string, string> = {}
    const watchers: Record<string, () => void> = {}
    const env: AssistEnv = {
      root: { dataset: {} },
      store: { getItem: () => stored, setItem: (k, v) => void (saved[k] = v) },
      query: (q) => !!media[q],
      watch: (q, cb) => void (watchers[q] = cb),
    }
    return { env, saved, watchers, media }
  }

  it('知らない値・足りない項目は既定にする', () => {
    expect(parseAssist(null)).toEqual(DEFAULT_ASSIST)
    expect(parseAssist({ motion: 'fast', text: 'larger', focus: 'yes', keys: false })).toEqual({ ...DEFAULT_ASSIST, text: 'larger', keys: false })
  })

  it('既定のままなら <html> に何も付けない（今の見た目のまま）', () => {
    const { env } = fakeEnv()
    applyAssist(DEFAULT_ASSIST, env)
    const { assist: _, ...rest } = env.root.dataset
    expect(rest).toEqual({})
  })

  it('選んだ項目だけを属性で当て、戻すと外す', () => {
    const { env } = fakeEnv()
    const all = { motion: 'reduce', contrast: 'more', text: 'large', focus: true, underline: true, keys: false } as const
    applyAssist(all, env)
    expect(env.root.dataset).toMatchObject({ motion: 'reduce', contrast: 'more', text: 'large', focus: 'always', underline: 'on', keys: 'off' })
    expect(currentAssist(env)).toEqual(all)
    expect(shortcutsOn(env)).toBe(false)
    applyAssist(DEFAULT_ASSIST, env)
    expect(env.root.dataset.motion).toBeUndefined()
    expect(shortcutsOn(env)).toBe(true)
  })

  it('端末の設定（動きを減らす・コントラストを上げる）は「端末に合わせる」のときも当て、変わったら当て直す', () => {
    const f = fakeEnv(null, { '(prefers-reduced-motion: reduce)': true })
    startAssist(f.env)
    expect(f.env.root.dataset.motion).toBe('reduce')
    expect(f.env.root.dataset.contrast).toBeUndefined()
    f.media['(prefers-contrast: more)'] = true
    f.watchers['(prefers-contrast: more)']()
    expect(f.env.root.dataset.contrast).toBe('more')
    // 選び方は「端末に合わせる」のまま（決まった値だけを属性に書く）
    expect(currentAssist(f.env).contrast).toBe('auto')
  })

  it('この端末に覚えたものを起動時に当て、変えたら覚える。壊れた値・保存できない環境でも既定で動く', () => {
    const f = fakeEnv(JSON.stringify({ text: 'larger' }))
    expect(startAssist(f.env).text).toBe('larger')
    setAssist({ ...DEFAULT_ASSIST, underline: true }, f.env)
    expect(JSON.parse(f.saved['ds.assist']).underline).toBe(true)
    expect(startAssist(fakeEnv('{').env)).toEqual(DEFAULT_ASSIST)
    const broken = fakeEnv().env
    broken.store = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(startAssist(broken)).toEqual(DEFAULT_ASSIST)
    setAssist(DEFAULT_ASSIST, broken)
    broken.root.dataset.assist = '{'
    expect(currentAssist(broken)).toEqual(DEFAULT_ASSIST)
  })

  it('同じかどうか・既定から変えた項目', () => {
    expect(sameAssist(DEFAULT_ASSIST, { ...DEFAULT_ASSIST })).toBe(true)
    expect(sameAssist(DEFAULT_ASSIST, { ...DEFAULT_ASSIST, focus: true })).toBe(false)
    expect(assistChanged({ ...DEFAULT_ASSIST, focus: true, text: 'large' })).toEqual(['text', 'focus'])
  })
})

describe('コントラストを強くしたときの決まり（contrastRulesFor）', () => {
  it('ふだんはそのまま。強くすると文字は 7、スキンの例外をなくし、枠の組を足す（文字でないものは 3 のまま）', () => {
    expect(contrastRulesFor(false)).toBe(CONTRAST_RULES)
    const more = contrastRulesFor(true)
    expect(more.filter((r) => r.min === CONTRAST_TEXT)).toEqual([])
    expect(more.filter((r) => r.min === CONTRAST_TEXT_MORE).length).toBe(CONTRAST_RULES.filter((r) => r.min === CONTRAST_TEXT).length)
    expect(more.some((r) => r.except)).toBe(false)
    expect(more.filter((r) => r.fg === '--line-2').every((r) => r.min === CONTRAST_UI)).toBe(true)
    expect(more.length).toBeGreaterThan(CONTRAST_RULES.length)
  })
})

describe('グラフの読み上げ用の要約と見えない表（Chart.tsx）', () => {
  it('数の並びは最初・最新・最小・最大を単位つきで。値のない点は飛ばし、1 つなら値だけ、なければ「値なし」', () => {
    expect(seriesSummary([3, null, 7, 2, 5], '名')).toBe('最初 3名、最新 5名（最小 2名・最大 7名）')
    expect(seriesSummary([null, 4, null])).toBe('4')
    expect(seriesSummary([null, null])).toBe('値なし')
    expect(seriesSummary([])).toBe('値なし')
  })

  it('折れ線の名前は期間の範囲と系列ごとの要約。期間が 1 つならその名前だけ、なければ要約だけ', () => {
    const series = [{ label: '中央値', values: [1.2, 0.9] }, { label: '90%点', values: [3, 2.5], soft: true }]
    expect(lineSummary(series, ['9/1', '9/8'], '秒')).toBe('9/1〜9/8、中央値 最初 1.2秒、最新 0.9秒（最小 0.9秒・最大 1.2秒）、90%点 最初 3秒、最新 2.5秒（最小 2.5秒・最大 3秒）')
    expect(lineSummary([{ label: '週の利用者', values: [4] }], ['9/1'], '名')).toBe('9/1、週の利用者 4名')
    expect(lineSummary([{ label: 'A', values: [1, 2] }], [])).toBe('A 最初 1、最新 2（最小 1・最大 2）')
  })

  it('折れ線の表は点ごとに 1 行（期間の名前がなければ番号、系列の値がない点は「—」）', () => {
    expect(lineRows([{ label: 'A', values: [1, 2, 3] }, { label: 'B', values: [5] }], ['9/1', '9/8'], '名')).toEqual([
      ['9/1', '1名', '5名'], ['9/8', '2名', '—'], ['3', '3名', '—'],
    ])
    expect(lineRows([], [])).toEqual([])
  })

  it('積み上げの表は期間ごとに内訳・合計・減った数（値のない期間は 0）', () => {
    const stacks = [{ values: [3, 1] }, { values: [2] }]
    expect(stackRows(['9/1', '9/8'], stacks, { values: [4] })).toEqual([['9/1', '3', '2', '5', '4'], ['9/8', '1', '0', '1', '0']])
    expect(stackRows(['9/1'], stacks)).toEqual([['9/1', '3', '2', '5']])
  })

  it('タイルの名前は名前・値・補足（補足がなければ名前と値）', () => {
    expect(tileName({ label: 'X', value: '24%', sub: '34 / 140名' })).toBe('X 24% 34 / 140名')
    expect(tileName({ label: 'X', value: '—' })).toBe('X —')
  })
})

describe('バージョン履歴の日付ごとのまとまり（releaseDays）', () => {
  it('新しい順のまま、同じ日の版を 1 つにまとめる', () => {
    const r = (version: string, date: string) => ({ version, date, items: [{ category: 'fixed' as const, text: version }] })
    const days = releaseDays([r('0.3.0', '2026-10-02'), r('0.2.1', '2026-10-01'), r('0.2.0', '2026-10-01')])
    expect(days.map(([d, rs]) => [d, rs.map((x) => x.version)])).toEqual([['2026-10-02', ['0.3.0']], ['2026-10-01', ['0.2.1', '0.2.0']]])
  })
})
