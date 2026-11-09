import { Button, KeyValues, Notice, Segmented, shellBreakpoints, shellLayout, SHELL_SIZES } from '@ymasaki/ignite'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { Case, Cases, Page, Spec } from './kit'

// 大きさが変わったときの調整（DESIGN.md 5 章）を、カタログ自身の画面を iframe に入れて見せる。
// 部品は端末ではなく実際の幅で形を決める（Shell は窓の幅、部品の中はコンテナクエリ）ので、iframe の幅を変えれば本物と同じに切り替わる。
// 見本は見るだけにする（inert）。中を操作できると、読み上げで同じ目印（header・main・nav）が画面の数だけ重なる

type ScreenKey = 'detail' | 'list' | 'dashboard' | 'forms'
const SCREENS: { value: ScreenKey; label: string; short: string; query: string; panel: boolean }[] = [
  { value: 'detail', label: '一覧と詳細', short: '詳細', query: 'nav=list&open=p1', panel: true },
  { value: 'list', label: '一覧', short: '一覧', query: 'nav=list', panel: false },
  { value: 'dashboard', label: 'ダッシュボード', short: '集計', query: 'nav=dashboard', panel: false },
  { value: 'forms', label: 'フォーム', short: '入力', query: 'nav=forms', panel: false },
]
// 画面の切り替えを短い名前にする欄の幅（4 つの長い名前が 305px 要る）
const SHORT_BELOW = 360

const MIN = 320
const MAX = 1440
const HEIGHT = 720
const bp = shellBreakpoints()
// 区切りのボタン。★ の幅は寸法から計算した区切り（shellBreakpoints）。その 1px 下で形が変わる
const PRESETS: { width: number; label: string }[] = [
  { width: 1440, label: 'PC' },
  { width: 1180, label: '小さめの PC' },
  { width: bp.railBelow - 1, label: '左メニューを畳む' },
  { width: 860, label: 'ヘッダーを 2 段に' },
  { width: bp.overlayBelow - 1, label: '詳細を重ねる' },
  { width: 720, label: '下からのシート' },
  { width: SHELL_SIZES.drawerAt, label: '引き出し' },
  { width: 375, label: 'スマホ' },
]
const PHONE = { short: 390, long: 844 }
// スマホの枠の縁（catalog.css の .cat-phone の border と同じ）
const BEZEL = 10

const inFrame = () => { try { return window.self !== window.top } catch { return true } }

/** 今のテーマを iframe に渡す。カタログのテーマを変えたら中も変わる（<html> の印を見る） */
function useThemeQuery() {
  const read = () => { const d = document.documentElement.dataset; return `skin=${d.skin ?? 'red'}&mode=${d.modePref ?? d.mode ?? 'light'}` }
  const [q, setQ] = useState(read)
  useEffect(() => {
    const mo = new MutationObserver(() => setQ(read()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-skin', 'data-mode', 'data-mode-pref'] })
    return () => mo.disconnect()
  }, [])
  return q
}

/** 要素の内側の幅（変わったら描き直す） */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** 画面を決まった大きさの iframe に描き、scale 倍に縮めて置く */
function Frame({ screen, width, height, scale, title, onWindow }: { screen: ScreenKey; width: number; height: number; scale: number; title: string; onWindow?: (w: Window | null) => void }) {
  const theme = useThemeQuery()
  const src = `${location.pathname}?${SCREENS.find((s) => s.value === screen)!.query}&${theme}`
  const size = { '--fw': width, '--fh': height, '--fs': scale } as CSSProperties
  return (
    <div className="cat-frame" role="img" aria-label={title} inert style={size} /* design-ok: 幅はドラッグで、縮める倍率は欄の幅で決まる。値だけを渡し、寸法は CSS で計算する */>
      <iframe aria-label={title} src={src} tabIndex={-1} onLoad={(e) => onWindow?.(e.currentTarget.contentWindow)} />
    </div>
  )
}

/** iframe の中の外側の余白（tokens.css の clamp() の計算済みの値）を読む */
function useShellSpace(win: Window | null, width: number) {
  const [space, setSpace] = useState<{ x: string; gap: string } | null>(null)
  useEffect(() => {
    if (!win) return
    const read = () => {
      try {
        const cs = win.getComputedStyle(win.document.documentElement)
        const px = (name: string) => `${Math.round(parseFloat(cs.getPropertyValue(name)) * 10) / 10}px`
        setSpace({ x: px('--shell-x'), gap: px('--shell-gap') })
      } catch { setSpace(null) }
    }
    read()
    win.addEventListener('resize', read)
    return () => win.removeEventListener('resize', read)
  }, [win, width])
  return space
}

const SIDE = { full: '広げて並べる', rail: 'アイコンの列に畳む', drawer: '引き出し（メニューのボタンで開く）' }

function WindowDemo() {
  const [screen, setScreen] = useState<ScreenKey>('detail')
  const [fit, setFit] = useState<'fit' | 'actual'>('fit')
  const [width, setWidth] = useState(1180)
  const [win, setWin] = useState<Window | null>(null)
  const [dragging, setDragging] = useState(false)
  const [stage, stageW] = useWidth<HTMLDivElement>()
  const drag = useRef<{ x: number; w: number } | null>(null)
  // 欄の幅からつまみの分を除いた、iframe に使える幅
  const room = Math.max(MIN, stageW - 20)
  // 「欄に合わせる」は最大の幅が入る倍率に固定する（ドラッグしてもつまみが指から離れない）。「等倍」は欄に入る幅まで
  const scale = fit === 'fit' ? Math.min(1, room / MAX) : 1
  const max = fit === 'fit' ? MAX : Math.max(MIN, Math.floor(room))
  const w = Math.min(max, Math.max(MIN, width))
  const set = (v: number) => setWidth(Math.round(Math.min(max, Math.max(MIN, v))))
  const space = useShellSpace(win, w)
  const def = SCREENS.find((s) => s.value === screen)!
  const shell = shellLayout({ width: w, collapsed: false, panelOpen: def.panel })

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, w }
    setDragging(true)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => { if (drag.current) set(drag.current.w + (e.clientX - drag.current.x) / scale) }
  const up = () => { drag.current = null; setDragging(false) }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 100 : 10
    const next = { ArrowLeft: w - step, ArrowRight: w + step, Home: MIN, End: max }[e.key]
    if (next == null) return
    e.preventDefault()
    set(next)
  }

  const rows: [string, string][] = [
    ['左メニュー', SIDE[shell.side]],
    ...(def.panel ? [['詳細パネル', shell.panel === 'overlay' ? (w <= 720 ? '下からのシートで重ねる' : '右から重ねる') : `横に並べる（${shell.panelW}px${shell.panel === 'compact' ? '。詰めている' : ''}）`] as [string, string]] : []),
    ['ヘッダー', w <= SHELL_SIZES.drawerAt ? 'メニューと画面名を 1 つのボタンに' : w <= 860 ? '検索欄を 2 段目に' : '1 段'],
    ['外側の余白', space ? `左右 ${space.x}・間 ${space.gap}` : '読み込み中'],
  ]
  return (
    <>
      <div className="cat-row">
        <Segmented label="見せる画面" value={screen} onChange={setScreen} options={SCREENS} short={stageW < SHORT_BELOW} />
        <Segmented label="表示の倍率" value={fit} onChange={setFit} options={[{ value: 'fit', label: '欄に合わせる' }, { value: 'actual', label: '等倍' }]} />
      </div>
      <div className="cat-row">
        {PRESETS.filter((p) => p.width <= max).map((p) => <Button key={p.width} active={w === p.width} aria-pressed={w === p.width} onClick={() => set(p.width)}><span className="num">{p.width}</span>{` ${p.label}`}</Button>)}
      </div>
      <div className="cat-resize-info">
        <span className="cat-resize-w num" aria-live="polite">{w}px</span>
        {scale < 1 && <span className="cat-t-sub">{Math.round(scale * 100)}% に縮めて表示</span>}
        <span className="cat-t-sub">右端のつまみをドラッグ、または ← → キー（Shift で 100px）</span>
      </div>
      <div className="cat-resize" ref={stage} data-drag={dragging || undefined}>
        <Frame screen={screen} width={w} height={HEIGHT} scale={scale} title={`${def.label}を幅 ${w}px で表示`} onWindow={setWin} />
        <div
          className="cat-resize-grip"
          role="separator"
          aria-orientation="vertical"
          aria-label="表示の幅"
          aria-valuemin={MIN}
          aria-valuemax={max}
          aria-valuenow={w}
          aria-valuetext={`${w}px`}
          tabIndex={0}
          data-on={dragging || undefined}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        />
      </div>
      <KeyValues rows={rows} />
    </>
  )
}

function PhoneDemo() {
  const [screen, setScreen] = useState<ScreenKey>('list')
  const [stage, stageW] = useWidth<HTMLDivElement>()
  const gap = 24
  // 縦と横を 1 段に並べられる倍率。小さくなりすぎるなら縦に積み、横向きの幅に合わせる
  const side = (stageW - gap - BEZEL * 4) / (PHONE.short + PHONE.long)
  const scale = Math.min(1, side >= 0.45 ? side : (stageW - BEZEL * 2) / PHONE.long)
  return (
    <>
      <div ref={stage}><Segmented label="スマホで見せる画面" value={screen} onChange={setScreen} options={SCREENS} short={stageW < SHORT_BELOW} /></div>
      <div>
        {stageW > 0 && (
          <Cases>
            <Case label={`縦 ${PHONE.short}×${PHONE.long}`}>
              <div className="cat-phone"><Frame screen={screen} width={PHONE.short} height={PHONE.long} scale={scale} title="スマホの縦向き" /></div>
            </Case>
            <Case label={`横 ${PHONE.long}×${PHONE.short}`}>
              <div className="cat-phone"><Frame screen={screen} width={PHONE.long} height={PHONE.short} scale={scale} title="スマホの横向き" /></div>
            </Case>
          </Cases>
        )}
      </div>
      <span className="cat-t-sub">タッチの端末だけの違いは実機で確かめる</span>
    </>
  )
}

export function ResponsivePage({ target }: { target?: string | null }) {
  // 埋め込んだ画面の中でこのページを開くと入れ子が続くので、中では見本を描かない
  if (inFrame()) return <Page page="responsive" target={target}><Notice tone="info">埋め込みの中では見本を表示しません</Notice></Page>
  return (
    <Page page="responsive" target={target}>
      <Spec page="responsive" id="window"><WindowDemo /></Spec>
      <Spec page="responsive" id="phone"><PhoneDemo /></Spec>
    </Page>
  )
}
