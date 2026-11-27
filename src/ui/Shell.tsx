// アプリの枠（左メニュー・ヘッダー・帯・内容・詳細パネル）。見た目は styles/components/shell.css。
// 大きさへの対応はこの部品が持つ（DESIGN.md 5 章）。骨組み（左メニューを畳む・詳細パネルを詰める・重ねる）は shellLayout.ts が
// 窓の幅と寸法から決める。スマホ幅（600px 以下）では左メニューを引き出しにし、開くボタンは画面名と 1 つにまとめる（幅を空けるため）。開いた引き出しは左へ払って閉じる。

import { IconChevronLeft, IconClock, IconMenu2, IconRefresh } from '@tabler/icons-react'
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

import { shortcutsOn } from '../assist'
import { FOCUSABLE } from './A11y'
import { Button } from './Button'
import { Toaster } from './Toast'
import { Drawer, isTyping, type DrawerPeek } from './Controls'
import { reducedMotion } from './Motion'
import { SHELL_SIZES, shellLayout, swipeCloses, type ShellLayout, type ShellSizes, type ShellState } from './shellLayout'
import { startTips } from './tip'

// 左メニューを畳む・広げる動きの長さ（shell.css の .app の grid-template-columns と合わせる）
const SIDE_MS = 280

const onResize = (cb: () => void) => (window.addEventListener('resize', cb), () => window.removeEventListener('resize', cb))
/**
 * 窓の幅から決まる骨組み。骨組みが変わったときだけ描き直す（窓の幅が 1px 変わるたびに枠の中身を描き直さない）。
 * 利用者が左メニューを広げたとき（keepSide）の骨組みも一緒に持ち、どちらを使うかは描くときに選ぶ
 */
function useShellLayouts(state: Omit<ShellState, 'width' | 'keepSide'>, sizes: ShellSizes): [plain: ShellLayout, kept: ShellLayout] {
  const at = (width: number) => JSON.stringify([shellLayout({ ...state, width }, sizes), shellLayout({ ...state, width, keepSide: true }, sizes)])
  const key = useSyncExternalStore(onResize, () => at(window.innerWidth), () => at(1440))
  return useMemo(() => JSON.parse(key), [key])
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
  /** まとまりの見出し。続く項目で同じ値なら 1 回だけ出す（畳むと文字を消し、項目の位置は動かさない） */
  group?: string
}

/**
 * 左メニューの項目の並び。選んでいる項目は aria-current="page"（current が null なら、どれも選んでいない。設定の画面など）。collapsed（AppShell の side が受け取る状態）なら、名前（.side-t）は消え、
 * ホバーで右に吹き出し（data-tip）と読み上げ用の名前（aria-label）を付ける。選択中の地は選んだ項目にその場で付け、項目の間を動かさない
 */
export function SideNav<K extends string>({ items, current, onSelect, collapsed = false, label = 'メインメニュー' }: { items: NavItem<K>[]; current: K | null; onSelect: (key: K) => void; collapsed?: boolean; label?: string }) {
  return (
    <nav className="nav" aria-label={label}>
      {items.map((it, i) => (
        <Fragment key={it.key}>
          {it.group != null && it.group !== items[i - 1]?.group && <span className="nav-h">{it.group}</span>}
          <button type="button" {...(collapsed ? { 'data-tip': it.label, 'aria-label': it.label } : {})} aria-current={current === it.key ? 'page' : undefined} onClick={() => onSelect(it.key)}>
            {it.icon}
            <span className="side-t">{it.label}</span>
          </button>
        </Fragment>
      ))}
    </nav>
  )
}

/** 畳んだ左メニューのアイコンのボタン 1 つ（.side-ic。高さ 34px。useFitCount の slot に渡す値は SIDE_ICON_SIZE）。label は吹き出しと読み上げの名前 */
export const SIDE_ICON_SIZE = 34
export function SideIconButton({ label, children, ...rest }: { label: string; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'type'>) {
  return <button type="button" className="side-ic" data-tip={label} aria-label={label} {...rest}>{children}</button>
}

/**
 * 左メニューの下の状態の 1 行（最終同期・集計の鮮度など）。見出し label を左、値 value を右に置く。知らせは見出しと入れ替えるので、
 * 出し入れで行の高さも値の位置も変わらない。state は idle / updating（回るアイコン）/ updated（値を強調し、しばらくで戻す）。
 * collapsed では文字の代わりに icon（既定は時計。更新中は回る）を出し、内容は吹き出しと読み上げで渡す。joined は上の SettingsButton と同じまとまりにする
 */
export function SideStatus({ label, value, state = 'idle', collapsed = false, joined = false, icon, updatingLabel = '更新中', updatedLabel = '更新しました' }: {
  label: string; value: ReactNode; state?: 'idle' | 'updating' | 'updated'; collapsed?: boolean; joined?: boolean; icon?: ReactNode; updatingLabel?: string; updatedLabel?: string
}) {
  const text = typeof value === 'string' ? `${label} ${value}` : label
  return (
    <div className={`side-status${joined ? ' joined' : ''}${state === 'idle' ? '' : ` ${state}`}`} {...(collapsed ? { 'data-tip': text } : {})}>
      {collapsed && <span className="sr-only">{text}</span>}
      <span className="side-status-ic" aria-hidden="true">{state === 'updating' ? <IconRefresh size={16} stroke={1.7} /> : icon ?? <IconClock size={16} stroke={1.7} />}</span>
      <span className="side-t side-status-l" key={state}>
        {state === 'idle' ? label : (
          <span className="side-status-note">
            {state === 'updating' && <IconRefresh size={12} stroke={2} aria-hidden="true" />}
            {state === 'updating' ? updatingLabel : updatedLabel}
          </span>
        )}
      </span>
      <b className="side-t num">{value}</b>
    </div>
  )
}

/** 左メニューの一番下のアカウントの欄。children に EntityRow（畳むと顔だけになる）を置く。読み込み中は Skeleton、人が分からないときは text（メールなど）を出す */
export function SideAccount({ text, children }: { text?: string; children?: ReactNode }) {
  return <div className="side-account">{children ?? <span className="side-account-t">{text}</span>}</div>
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
 * id は中身の別（変わったら畳んだのを戻す）、peek は重ねる形で畳んだときの 1 行（useShell().revealMain）。
 * pinned は閉じない常時表示（open・onClose は渡さない。中の PanelHeader にも onClose を渡さず×を出さない）。
 * 横に並べる形ではいつも出し、重ねる形では peek の 1 行に畳んで残す（押すと広げ、Esc・外側のクリック・revealMain で 1 行に戻す。重ねる形で id が変わったら広げる）
 */
/**
 * 詳細パネルの幅をドラッグ（と境目にフォーカスして ← →）で変える。幅はアプリが持つ（覚えておくなら保存する）。
 * width を省くと窓に合わせた幅から始める。min は最低幅（既定は SHELL_SIZES の panel.compact）、max は上限。
 * 主役に最小幅（sizes.mainMin）が残らない分は、決めた幅でも詰め、最低幅でも残らない窓では重ねる
 */
export interface ShellPanelResize {
  width?: number
  onChange: (width: number) => void
  min?: number
  max?: number
}

export type ShellPanel = {
  content: ReactNode
  id?: string
  resize?: ShellPanelResize
} & ({ pinned?: false; open: boolean; closing?: boolean; onClose: () => void; peek?: DrawerPeek } | { pinned: true; open?: undefined; closing?: undefined; onClose?: undefined; peek: DrawerPeek })

/** 枠の中（詳細パネルの中身など）から使う操作 */
interface ShellApi {
  /**
   * 主役（裏の画面）を変える操作のあとに呼ぶ。詳細を重ねる形（引き出し）のときは、詳細を下の 1 行に畳んで変化を見せる。
   * 横に並べる形では裏が見えているので何もしない（DESIGN.md 5 章「操作の結果を見える場所に出す」）
   */
  revealMain: () => void
  /** AppShell の中か（枠の外に置く画面の型が、枠の中で見本として描かれたときに main を重ねないため） */
  inShell: boolean
}
const ShellContext = createContext<ShellApi>({ revealMain: () => {}, inShell: false })
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
 * - panel（周り）: 詳細パネル。幅に合わせて横に並べる → 詰める → 重ねる（Drawer）を shellLayout が決める。pinned で閉じない常時表示、resize でドラッグして幅を変える
 * - sizes: 寸法（既定は SHELL_SIZES）。区切りの幅は寸法から計算で出る
 */
export function AppShell({ side, foot, collapse, title, titleAfter, search, tools, actions, aux, band, panel, sizes: baseSizes = SHELL_SIZES, children }: {
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
  const sideRef = useRef<HTMLElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const pinned = !!panel?.pinned
  const panelOpen = pinned || !!panel?.open
  // 幅を変えられるパネルの最低幅は、詰めるときの下限（panel.compact）として骨組みの計算に渡す（区切りの幅もこれで決まる）
  const resize = panel?.resize
  const sizes = useMemo(() => {
    const min = resize?.min
    return min === undefined ? baseSizes : { ...baseSizes, panel: { ...baseSizes.panel, compact: min, full: Math.max(baseSizes.panel.full, min) } }
  }, [baseSizes, resize?.min])
  const panelWidth = resize?.width === undefined ? undefined : Math.min(resize.width, resize.max ?? Infinity)
  // 幅が足りずに自動で畳んでいるあいだにつまみで広げたら、畳む幅より広くなる（自動で畳む場面でなくなる）まで畳まない（覚えている設定は変えない）
  const [keepSide, setKeepSide] = useState(false)
  const [plain, kept] = useShellLayouts({ collapsed: !!collapse?.collapsed, panelOpen, railable: !!collapse, panelWidth }, sizes)
  // 幅が足りないので自動で畳む場面か（そのときのつまみは、覚えている設定ではなく「この場面のあいだ広げる」を切り替える）
  const autoCase = plain.autoRail
  if (keepSide && !autoCase) setKeepSide(false)
  const layout = keepSide ? kept : plain
  const toggle = () => (autoCase ? setKeepSide((v) => !v) : collapse?.onChange(!collapse.collapsed))
  const rail = layout.side === 'rail'
  const drawerSide = layout.side === 'drawer'
  // 窓の幅で左メニューが引き出し ⇔ 横に並ぶ形に切り替わった直後は、動きを付けずに最後の姿で出す（.side-switch）
  const [lastDrawer, setLastDrawer] = useState(drawerSide)
  const [switching, setSwitching] = useState(false)
  if (lastDrawer !== drawerSide) {
    setLastDrawer(drawerSide)
    setSwitching(true)
    // 引き出しを開いたまま窓を広げたら閉じた状態に戻す（狭め直したときに開いた姿で出さない）
    if (!drawerSide) setOpen(false)
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
    // 中で開いた一覧・ポップオーバーが Esc で先に閉じたとき（preventDefault 済み）は、引き出しまで閉じない
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [drawerOpen])
  // 開いた引き出しは左へ払って閉じる（指・ペンだけ。マウスは文字の選択とぶつかる）。払うあいだは指に付いて動き、背景の暗さも薄める。
  // 離したときの距離と速さで閉じるか戻るかを決める（swipeCloses）。縦に動かしたら中のスクロールに任せる。
  // 開く向き（画面の左端から引き出す）は持たない。端末の「戻る」の払い（iOS・Android のジェスチャー操作）とぶつかるので、開くのはメニューのボタンだけ
  useEffect(() => {
    const el = sideRef.current
    const scrim = scrimRef.current
    if (!drawerOpen || !el || !scrim) return
    let drag: { id: number; x0: number; y0: number; dx: number; lastX: number; lastT: number; vx: number; on: boolean } | null = null
    const paint = (dx: number) => {
      el.style.transition = scrim.style.transition = 'none'
      el.style.transform = `translateX(${dx}px)`
      scrim.style.opacity = String(Math.max(0, 1 + dx / (el.offsetWidth || 1)))
    }
    const reset = () => {
      for (const s of [el.style, scrim.style]) s.transition = s.transform = s.opacity = ''
    }
    // 払い終えた直後の click（指を離した位置の項目）は押したことにしない
    const eat = (e: MouseEvent) => (el.contains(e.target as Node) || e.target === scrim) && (e.preventDefault(), e.stopPropagation())
    let eatTimer = 0
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !e.isPrimary || drag) return
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, lastX: e.clientX, lastT: e.timeStamp, vx: 0, on: false }
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x0
      if (!drag.on) {
        const dy = e.clientY - drag.y0
        if (Math.hypot(dx, dy) < 10) return
        // 左向きが主の動きだけを払いとして受ける（縦・右向きは見送る）
        if (dx >= 0 || Math.abs(dx) <= Math.abs(dy)) return void (drag = null)
        drag.on = true
      }
      const dt = e.timeStamp - drag.lastT
      if (dt > 0) drag.vx = (e.clientX - drag.lastX) / dt
      drag.lastX = e.clientX
      drag.lastT = e.timeStamp
      drag.dx = Math.min(0, dx)
      paint(drag.dx)
    }
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const d = drag
      drag = null
      if (!d.on) return
      // 止めてから離したら速さは 0（ゆっくり戻した・止めたのに、最後の速さで閉じない）
      const vx = e.timeStamp - d.lastT > 100 ? 0 : d.vx
      window.addEventListener('click', eat, true)
      window.clearTimeout(eatTimer)
      eatTimer = window.setTimeout(() => window.removeEventListener('click', eat, true), 400)
      reset()
      if (e.type === 'pointerup' && swipeCloses(d.dx, vx, el.offsetWidth)) setOpen(false)
    }
    el.addEventListener('pointerdown', down)
    scrim.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      el.removeEventListener('pointerdown', down)
      scrim.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.clearTimeout(eatTimer)
      window.removeEventListener('click', eat, true)
      reset()
    }
  }, [drawerOpen])
  // Esc で吹き出し（data-tip）を消し、マウスを動かす・フォーカスを移すと戻す（WCAG 1.4.13。見えている説明を閉じられるように）
  useEffect(() => {
    startTips() // 窓からはみ出す吹き出しを寄せる（startAssist を呼ばないアプリでも効くように）
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
  // 常時表示（pinned）のパネルを重ねる形で広げているか。はじめは 1 行に畳み、重ねる形のまま別の中身（id）を選んだら広げる。
  // 横に並べる形になったら戻す（狭め直したときに、全面の詳細をいきなり重ねない）
  const [expanded, setExpanded] = useState(false)
  if (expanded && inline) setExpanded(false)
  const [minKey, setMinKey] = useState(panel?.id)
  if (minKey !== panel?.id || (minimized && (!panel?.open || inline))) {
    if (minKey !== panel?.id && pinned && !inline) setExpanded(true)
    setMinKey(panel?.id)
    setMinimized(false)
  }
  const peeked = !!panel && !inline && (pinned ? !expanded : minimized)
  // 広げた常時表示のパネルは Esc で 1 行に戻す（閉じない。中で開いた一覧などが先に Esc を受けたときは戻さない）
  const pinExpanded = pinned && !inline && expanded
  useEffect(() => {
    if (!pinExpanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pinExpanded])
  useEffect(() => {
    const expand = () => setMinimized(false)
    window.addEventListener('popstate', expand)
    return () => window.removeEventListener('popstate', expand)
  }, [])
  // 幅を変えるつまみ。上限は resize.max と、主役に最小幅が残る幅の小さいほう（決めた幅を大きくした骨組みで測る）
  const [resizing, setResizing] = useState(false)
  const widthRange = () => {
    const min = sizes.panel.compact
    const room = shellLayout({ width: window.innerWidth, collapsed: !!collapse?.collapsed, panelOpen: true, railable: !!collapse, keepSide, panelWidth: 1e6 }, sizes).panelW
    // 骨組みの計算は外側の余白を下限（sizes.gutter）で見積もるので、広い窓では描いた主役の幅で上限を測り直す（主役に mainMin を必ず残す）
    const content = mainRef.current?.querySelector<HTMLElement>(':scope > .content')
    const slot = content?.querySelector<HTMLElement>(':scope > .pslot')
    let drawn = Infinity
    if (content && slot && content.clientWidth > 0) {
      const cs = getComputedStyle(content)
      const mainW = content.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - slot.getBoundingClientRect().width
      drawn = layout.panelW + mainW - sizes.mainMin
    }
    return { min, max: Math.max(min, Math.floor(Math.min(resize?.max ?? Infinity, room, drawn))) }
  }
  const setWidth = (w: number) => {
    const { min, max } = widthRange()
    resize?.onChange(Math.round(Math.min(max, Math.max(min, w))))
  }
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = layout.panelW
    setResizing(true)
    // パネルは右にあるので、境目を左へ動かすと広がる
    const move = (ev: PointerEvent) => setWidth(startW + startX - ev.clientX)
    const up = () => {
      setResizing(false)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const onHandleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16
    const { min, max } = widthRange()
    const next = { ArrowLeft: layout.panelW + step, ArrowRight: layout.panelW - step, Home: min, End: max }[e.key]
    if (next === undefined) return
    e.preventDefault()
    setWidth(next)
  }
  const shellApi: ShellApi = { revealMain: () => !inline && (pinned ? setExpanded(false) : panel?.open && panel.peek && setMinimized(true)), inShell: true }
  return (
    <ShellContext.Provider value={shellApi}>
      <div className={`app${peeked ? ' panel-peek' : ''}${resizing ? ' panel-resizing' : ''}${rail ? ' side-min' : ''}${rail && settled ? ' side-min-done' : ''}${switching ? ' side-switch' : ''}`} style={vars}>
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
        <div ref={scrimRef} className={`side-scrim ${open ? 'on' : ''}`} onClick={close} />
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
                {inline && panelOpen && (
                  <div className={`pslot${panel.closing ? ' closing' : ''}`} style={{ '--panel-w': `${layout.panelW}px` } as CSSProperties}>
                    {resize && (
                      // 窓の分割のつまみ（WAI-ARIA の window splitter）。ドラッグ・← →（Shift で大きく）・Home（最低幅）・End（上限）
                      <div
                        className="pslot-handle"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="詳細の幅"
                        aria-valuenow={layout.panelW}
                        aria-valuemin={sizes.panel.compact}
                        tabIndex={0}
                        data-tip="ドラッグで幅を変える"
                        onPointerDown={onHandleDown}
                        onKeyDown={onHandleKey}
                      />
                    )}
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
      <Toaster inert={drawerOpen || (panelOpen && !inline && !peeked)} />
      {panel && !inline && (
        <Drawer
          open={panelOpen}
          closing={panel.closing}
          onClose={panel.pinned ? () => setExpanded(false) : panel.onClose}
          pinned={pinned}
          peek={panel.peek}
          minimized={peeked}
          onExpand={() => (pinned ? setExpanded(true) : setMinimized(false))}
        >
          {panel.content}
        </Drawer>
      )}
    </ShellContext.Provider>
  )
}
