// アプリの枠（左メニュー・ヘッダー・帯・内容・詳細パネル）。見た目は styles/components/shell.css。
// 大きさへの対応はこの部品が持つ（DESIGN.md 5 章）。骨組み（左メニューを畳む・詳細パネルを詰める・重ねる）は shellLayout.ts が
// 窓の幅と寸法から決める。スマホ幅（600px 以下）では左メニューを引き出しにし、開くボタンは画面名と 1 つにまとめる（幅を空けるため）。

import { IconChevronLeft, IconMenu2 } from '@tabler/icons-react'
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'

import { shortcutsOn } from '../assist'
import { FOCUSABLE } from './A11y'
import { Button } from './Button'
import { Toaster } from './Toast'
import { Drawer, isTyping, type DrawerPeek } from './Controls'
import { reducedMotion } from './Motion'
import { SHELL_SIZES, shellLayout, type ShellSizes } from './shellLayout'

// 左メニューを畳む・広げる動きの長さ（shell.css の .app の grid-template-columns と合わせる）
const SIDE_MS = 280

const onResize = (cb: () => void) => (window.addEventListener('resize', cb), () => window.removeEventListener('resize', cb))
/** 窓の幅（変わったら描き直す） */
function useWindowWidth() {
  return useSyncExternalStore(onResize, () => window.innerWidth, () => 1440)
}

const onModeChange = (cb: () => void) => {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })
  return () => mo.disconnect()
}
/** 今描いている表示モード（<html data-mode> の light / dark。「端末に合わせる」も決まった方。切り替わったら描き直す） */
export function useShownMode(): 'light' | 'dark' {
  return useSyncExternalStore(onModeChange, () => (document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'), () => 'light')
}

/**
 * 左メニューの一番上のブランド（マークと名前。small は名前の上の小さな行）。onClick を渡すと押せる（ホームへ戻るなど。label は読み上げ用の名前）。
 * 名前（.side-t）は、左メニューを畳むと消える
 */
export function Brand({ mark, name, small, onClick, label }: { mark?: ReactNode; name: ReactNode; small?: ReactNode; onClick?: () => void; label?: string }) {
  const body = (
    <>
      {mark}
      <span className="brand-txt side-t">
        {small && <small>{small}</small>}
        {name}
      </span>
    </>
  )
  return onClick ? (
    <button type="button" className="brand" aria-label={label} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="brand">{body}</div>
  )
}

export interface NavItem<K extends string> {
  key: K
  label: string
  icon: ReactNode
}

/**
 * 左メニューの項目の並び。選んでいる項目は aria-current="page"（current が null なら、どれも選んでいない。設定の画面など）。collapsed（AppShell の side が受け取る状態）なら、名前（.side-t）は消え、
 * ホバーで右に吹き出し（data-tip）と読み上げ用の名前（aria-label）を付ける
 */
export function SideNav<K extends string>({ items, current, onSelect, collapsed = false, label = 'メインメニュー' }: { items: NavItem<K>[]; current: K | null; onSelect: (key: K) => void; collapsed?: boolean; label?: string }) {
  return (
    <nav className="nav" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} type="button" {...(collapsed ? { 'data-tip': it.label, 'aria-label': it.label } : {})} aria-current={current === it.key ? 'page' : undefined} onClick={() => onSelect(it.key)}>
          {it.icon}
          <span className="side-t">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}

/** 左メニューの中身に渡す状態。collapsed はアイコンの列に畳んでいる（名前の吹き出しを付ける）、settled は畳み終わった（はみ出してよい）、
 * collapsible は畳める形（引き出しでない）か */
export interface ShellSideState {
  collapsed: boolean
  settled: boolean
  collapsible: boolean
}

/**
 * 詳細パネル。開閉と閉じる途中（閉じる動きを見せるあいだ）はアプリが持つ。
 * id は中身の別（変わったら畳んだのを戻す）、peek は重ねる形で畳んだときの 1 行（useShell().revealMain）
 */
export interface ShellPanel {
  open: boolean
  closing?: boolean
  onClose: () => void
  content: ReactNode
  id?: string
  peek?: DrawerPeek
}

/** 枠の中（詳細パネルの中身など）から使う操作 */
interface ShellApi {
  /**
   * 主役（裏の画面）を変える操作のあとに呼ぶ。詳細を重ねる形（引き出し）のときは、詳細を下の 1 行に畳んで変化を見せる。
   * 横に並べる形では裏が見えているので何もしない（DESIGN.md 5 章「操作の結果を見える場所に出す」）
   */
  revealMain: () => void
}
const ShellContext = createContext<ShellApi>({ revealMain: () => {} })
export const useShell = () => useContext(ShellContext)

/**
 * アプリの枠。領域で組む（DESIGN.md 5 章の役割）:
 * - side（周り）: 左メニューの中身（押したら引き出しを閉じる close と、畳み方の状態を受け取る）。foot は一番下の欄
 * - collapse: 渡すと左メニューをアイコンの列に畳める（覚えている設定と変更。つまみ・[ キー・動きはこの部品が持つ）
 * - title / titleAfter（周り）: ヘッダーの見出し（画面の名前）と見出しの後ろ（表示範囲の選択など。狭いと省略記号で詰める）
 * - search / tools（ヘッダーの右）: search は主役（検索欄。860px 以下では 2 段目に幅いっぱい、低い横長の画面では 1 段目）、
 *   tools は補助（絞り込みなど。search に付随して並べ、狭いときは中の data-fit="extra" の文字を落としてアイコンにする）。
 *   ショートカットの手がかりに data-fit="hint" を付けると 860px 以下で落とす。actions はそのほかの右の要素（詰めない）
 * - aux（補助）: ヘッダーの直後の帯（KPI）。低い横長の画面では出さない（高さを主役に回す）
 * - band: aux の後の帯（絞り込みの帯など。いつも出す）
 * - children（主役）: 内容。panel を渡すと内容の段（.content）に入れ、右に詳細パネルを並べる
 * - panel（周り）: 詳細パネル。幅に合わせて横に並べる → 詰める → 重ねる（Drawer）を shellLayout が決める
 * - sizes: 寸法（既定は SHELL_SIZES）。区切りの幅は寸法から計算で出る
 */
export function AppShell({ side, foot, collapse, title, titleAfter, search, tools, actions, aux, band, panel, sizes = SHELL_SIZES, children }: {
  side: (close: () => void, state: ShellSideState) => ReactNode
  foot?: ReactNode
  collapse?: { collapsed: boolean; onChange: (collapsed: boolean) => void }
  title: ReactNode
  titleAfter?: ReactNode
  search?: ReactNode
  tools?: ReactNode
  actions?: ReactNode
  aux?: ReactNode
  band?: ReactNode
  panel?: ShellPanel
  sizes?: ShellSizes
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const width = useWindowWidth()
  const sideRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const panelOpen = !!panel?.open
  // 幅が足りずに自動で畳んでいるあいだにつまみで広げたら、畳む幅より広くなる（自動で畳む場面でなくなる）まで畳まない（覚えている設定は変えない）
  const [keepSide, setKeepSide] = useState(false)
  const state = { width, collapsed: !!collapse?.collapsed, panelOpen, railable: !!collapse }
  // 幅が足りないので自動で畳む場面か（そのときのつまみは、覚えている設定ではなく「この場面のあいだ広げる」を切り替える）
  const autoCase = shellLayout(state, sizes).autoRail
  if (keepSide && !autoCase) setKeepSide(false)
  const layout = shellLayout({ ...state, keepSide }, sizes)
  const toggle = () => (autoCase ? setKeepSide((v) => !v) : collapse?.onChange(!collapse.collapsed))
  const rail = layout.side === 'rail'
  const drawerSide = layout.side === 'drawer'
  // 窓の幅で左メニューが引き出し ⇔ 横に並ぶ形に切り替わった直後は、動きを付けずに最後の姿で出す（.side-switch）
  const [lastDrawer, setLastDrawer] = useState(drawerSide)
  const [switching, setSwitching] = useState(false)
  if (lastDrawer !== drawerSide) {
    setLastDrawer(drawerSide)
    setSwitching(true)
  }
  useEffect(() => {
    if (!switching) return
    let f2 = 0
    const f1 = requestAnimationFrame(() => (f2 = requestAnimationFrame(() => setSwitching(false))))
    return () => (cancelAnimationFrame(f1), cancelAnimationFrame(f2))
  }, [switching])
  // 畳み終わったら（幅の動きのあと）はみ出してよい（名前の吹き出し・ポップオーバーを右に出す）。広げるときはすぐ外す
  const [settled, setSettled] = useState(rail)
  useEffect(() => {
    if (!rail) return setSettled(false)
    const t = window.setTimeout(() => setSettled(true), reducedMotion() || switching ? 0 : SIDE_MS)
    return () => window.clearTimeout(t)
    // switching は切り替わった瞬間の値だけを見る（戻ったときに待ち直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rail])
  // [ キーでも畳む・広げる（入力中・引き出しのときは除く）
  const collapsible = !!collapse && !drawerSide
  useEffect(() => {
    if (!collapsible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '[' && shortcutsOn() && !isTyping() && !e.metaKey && !e.ctrlKey && !e.altKey && !e.isComposing) toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // 引き出しの左メニュー（狭い幅）は、開いているあいだ modal のダイアログ。中の最初の項目へフォーカスを移し、Esc で閉じ、閉じたら開いたボタンへ戻す。
  // 閉じているあいだは画面の外にずらしているだけなので、inert で Tab と読み上げから外す（下の aside）
  const drawerOpen = drawerSide && open
  useEffect(() => {
    if (!drawerOpen) return
    const back = document.activeElement as HTMLElement | null
    sideRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [drawerOpen])
  // Esc で吹き出し（data-tip）を消し、マウスを動かす・フォーカスを移すと戻す（WCAG 1.4.13。見えている説明を閉じられるように）
  useEffect(() => {
    const root = document.documentElement
    const off = (e: KeyboardEvent) => e.key === 'Escape' && (root.dataset.tips = 'off')
    const on = () => root.dataset.tips && delete root.dataset.tips
    window.addEventListener('keydown', off)
    window.addEventListener('pointermove', on)
    window.addEventListener('focusin', on)
    return () => (window.removeEventListener('keydown', off), window.removeEventListener('pointermove', on), window.removeEventListener('focusin', on))
  }, [])
  // 本文へ移る（スキップリンク）: 本体の最初の操作へ。本体（main）は箱を作らないので、それ自体にはフォーカスを置けない
  const skip = () => mainRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  // 寸法は CSS に変数で渡す（左メニューの幅・パネルの幅。shell.css は既定値を持つ）。横に並べたパネルの幅は窓に合わせて shellLayout が決める
  const vars = { '--side-full': `${sizes.side.full}px`, '--side-rail': `${sizes.side.rail}px`, '--panel-full': `${sizes.panel.full}px` } as CSSProperties
  const inline = panel && (layout.panel === 'full' || layout.panel === 'compact')
  // 重ねた詳細を下の 1 行に畳んでいるか。閉じた・別の中身を開いた・ブラウザで戻った・横に並べる形になったら戻す
  const [minimized, setMinimized] = useState(false)
  const [minKey, setMinKey] = useState(panel?.id)
  if (minKey !== panel?.id || (minimized && (!panel?.open || inline))) {
    setMinKey(panel?.id)
    setMinimized(false)
  }
  useEffect(() => {
    const expand = () => setMinimized(false)
    window.addEventListener('popstate', expand)
    return () => window.removeEventListener('popstate', expand)
  }, [])
  const shellApi: ShellApi = { revealMain: () => !inline && panel?.open && panel.peek && setMinimized(true) }
  return (
    <ShellContext.Provider value={shellApi}>
      <div className={`app${minimized ? ' panel-peek' : ''}${rail ? ' side-min' : ''}${rail && settled ? ' side-min-done' : ''}${switching ? ' side-switch' : ''}`} style={vars}>
        {/* Tab を押したときだけ出る。左メニュー（お気に入りが多いと長い）を毎回越えずに本体へ（WCAG 2.4.1） */}
        <button type="button" className="skip-link" onClick={skip}>本文へ移る</button>
        <aside ref={sideRef} className={`side ${open ? 'open' : ''}`} aria-label="メニュー" inert={drawerSide && !open} {...(drawerOpen ? { role: 'dialog', 'aria-modal': true } : {})}>
          {side(close, { collapsed: rail, settled: rail && settled, collapsible })}
          {/* 一番下の欄（集計日など）。畳んだアイコンの列では文字が入らないので出さない（shell.css の .shell-foot） */}
          {foot && <div className="side-foot shell-foot">{foot}</div>}
        </aside>
        {/* 畳む・広げるのつまみ。左メニューと本体の境目にまたがり、境目と一緒に動く。左メニューの外に置く（中だと畳むあいだの切り取りで欠ける） */}
        {collapsible && (
          <button type="button" className="side-handle" aria-expanded={!rail} aria-label={rail ? 'メニューを広げる' : 'メニューを折りたたむ'} data-tip={rail ? 'メニューを広げる（[ キー）' : 'メニューを折りたたむ（[ キー）'} onClick={toggle}>
            <IconChevronLeft size={14} stroke={2} />
          </button>
        )}
        <div className={`side-scrim ${open ? 'on' : ''}`} onClick={close} />
        {/* 読み上げのランドマーク: 左メニュー（aside）・ヘッダー（header）・本体（main）・詳細パネル（section）。内容はどれかの中に置く */}
        <div className="mainwrap" inert={drawerOpen}>
          <header className="top">
            <div className="ttl">
              <h1>
                <span className="ttl-t">{title}</span>
                <Button className="ttl-menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} icon={<IconMenu2 size={18} stroke={1.7} />}>
                  {title}
                </Button>
              </h1>
              {titleAfter}
            </div>
            {(search || tools) && (
              <div className={`sbar${search ? ' has-search' : ''}`}>
                {search}
                {tools}
              </div>
            )}
            {actions}
          </header>
          {/* 本体。枠の段組みを変えないように箱を作らない（shell.css の .shell-main は display:contents） */}
          <main ref={mainRef} className="shell-main">
            {aux && <div className="shell-aux">{aux}</div>}
            {band}
            {panel ? (
              <div className="content">
                {children}
                {inline && panel.open && (
                  <div className={`pslot${panel.closing ? ' closing' : ''}`} style={{ '--panel-w': `${layout.panelW}px` } as CSSProperties}>
                    <section className="panel" aria-label="詳細">{panel.content}</section>
                  </div>
                )}
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
      <Toaster inert={drawerOpen || (!!panel?.open && !inline && !minimized)} />
      {panel && !inline && (
        <Drawer open={panel.open} closing={panel.closing} onClose={panel.onClose} peek={panel.peek} minimized={minimized} onExpand={() => setMinimized(false)}>
          {panel.content}
        </Drawer>
      )}
    </ShellContext.Provider>
  )
}
