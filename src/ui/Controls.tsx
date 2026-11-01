// 切り替え・タブ・ポップオーバー・引き出し。見た目は styles/components/controls.css。

import { IconCheck, IconChevronDown, IconChevronUp, IconSearch, IconX } from '@tabler/icons-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { shortcutsOn } from '../assist'
import { useField } from './Field'
import { RollingNumber, reducedMotion } from './Motion'

/**
 * 選択中の地（つまみ）を、選んだボタンの位置と幅へスライドさせる。切り替え（Segmented）とタブ（Tabs）で共通。
 * 初めの位置は動かさずに置き、その後の切り替えだけを動かす（.ready）。
 * 横の位置と幅は枠に対する % で置く（枠の幅がアニメーションで変わっても地が一緒に伸び縮みし、スライドをやり直さない）。
 * 幅の変化で置き直すのはスライドしていないときだけ。動かしはじめてよいか（ready）は状態で持ち、枠のクラスに描く
 * （DOM のクラスを直接足すと、修飾でクラス名が変わって描き直したときに消えるため）
 */
export function useThumb(value: string) {
  const ref = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const box = ref.current
    const th = thumb.current
    if (!box || !th) return
    let sliding = false
    const place = () => {
      const on = box.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"], [aria-current="page"]')
      th.style.opacity = on ? '1' : '0'
      if (!on || !box.clientWidth) return
      th.style.left = `${(on.offsetLeft / box.clientWidth) * 100}%`
      th.style.width = `${(on.offsetWidth / box.clientWidth) * 100}%`
      th.style.top = `${on.offsetTop}px`
      th.style.height = `${on.offsetHeight}px`
    }
    const start = () => (sliding = true)
    const end = () => {
      sliding = false
      place()
    }
    place()
    th.addEventListener('transitionrun', start)
    th.addEventListener('transitionend', end)
    th.addEventListener('transitioncancel', end)
    const ro = new ResizeObserver(() => !sliding && place())
    ro.observe(box)
    const frame = requestAnimationFrame(() => setReady(true))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
      th.removeEventListener('transitionrun', start)
      th.removeEventListener('transitionend', end)
      th.removeEventListener('transitioncancel', end)
    }
  }, [value])
  return { ref, thumb, ready }
}

/** 文字を入力中か（入力欄・選択欄にフォーカスがある）。1 文字のキーの操作（F・[・Esc など）を、入力中は横取りしないために使う */
export const isTyping = () => /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName || '')

/**
 * ボタン群から 1 つ選ぶ（表示方法・階層の深さ・直属／配下・変更の種類など）。選択中の地がスイッチのようにスライドする。count はラベルの右に小さく出す件数（変わるとスロットのように回る）。
 * 狭いときの詰め方（DESIGN.md 5 章。どれを使うかは置き場所で決める。useFitStep）: hideCounts 件数を隠す → fill 置き場所の幅いっぱいに伸ばす →
 * dense ボタンの左右の余白を詰める → short 選択肢の short（短いラベル）を出す
 */
export function Segmented<T extends string>({ value, options, onChange, label, hideCounts, fill, dense, short }: { value: T; options: { value: T; label: ReactNode; short?: ReactNode; count?: number }[]; onChange: (v: T) => void; label: string; hideCounts?: boolean; fill?: boolean; dense?: boolean; short?: boolean }) {
  const { ref, thumb, ready } = useThumb(value)
  return (
    <div className={`seg${ready ? ' ready' : ''}${hideCounts ? ' no-n' : ''}${fill ? ' fill' : ''}${dense ? ' dense' : ''}`} role="group" aria-label={label} ref={ref}>
      <span className="thumb" ref={thumb} aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {short && o.short != null ? o.short : o.label}
          {o.count != null && <span className="n num"><RollingNumber value={o.count} /></span>}
        </button>
      ))}
    </div>
  )
}

/** 一覧の絞り込みの入力欄（placeholder は「〜で絞り込み」と対象を 3 つまで）。先頭に虫眼鏡、shortcut を付けると F で移れて、行き先になっているあいだは右端に「F」（1 文字のショートカットを切っていれば「⌘K」）の印を出す */
export function SearchField({ value, onChange, placeholder, label, shortcut = false }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; shortcut?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const target = useFocusShortcut(ref, shortcut)
  return (
    <span className="sfield">
      <IconSearch className="sfield-ic" size={16} stroke={1.7} aria-hidden="true" />
      <input ref={ref} className="field" type="search" placeholder={placeholder} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {/* 1 文字のショートカットを切っているとき（data-keys="off"）は、効く ⌘K に差し替える（CSS で出し分ける） */}
      {target && (
        <kbd className="kbd-key">
          <span className="k-one">F</span>
          <span className="k-mod">⌘K</span>
        </kbd>
      )}
    </span>
  )
}

// ---- 検索欄へ移るショートカット ----
// 画面に検索欄が 2 つ以上あっても、F の行き先は 1 つ（priority の大きいもの、同じなら後から出たもの）。行き先の欄にだけ「F」の印を出す
type ShortcutEntry = { ref: { current: HTMLInputElement | null }; priority: number; seq: number }
const shortcuts: ShortcutEntry[] = []
const shortcutListeners = new Set<() => void>()
let shortcutSeq = 0
let shortcutInstalled = false
const shortcutTarget = () =>
  shortcuts.filter((e) => e.ref.current?.isConnected).sort((a, b) => b.priority - a.priority || b.seq - a.seq)[0]

/**
 * 検索欄へ移るショートカット: F（修飾キーなし。入力中は除く。Cmd/Ctrl+F はブラウザのページ内検索に残す）と Cmd/Ctrl+K。
 * 画面ごとにいちばん主な検索欄に付ける。priority を大きくした欄が優先（アプリのヘッダーの検索など）。
 * 返り値は、この欄がいま F の行き先か（「F」の印を出すかどうか）
 */
export function useFocusShortcut(ref: { current: HTMLInputElement | null }, enabled = true, priority = 0): boolean {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    shortcutListeners.add(listener)
    return () => void shortcutListeners.delete(listener)
  }, [])
  useEffect(() => {
    if (!enabled) return
    if (!shortcutInstalled) {
      shortcutInstalled = true
      window.addEventListener('keydown', (e) => {
        const typing = isTyping()
        // F だけのショートカットは、設定で 1 文字のショートカットを切っていれば受けない（Ctrl+K / ⌘K は残す）
        const plainF = e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.isComposing && shortcutsOn()
        if (!((plainF && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)))) return
        const input = shortcutTarget()?.ref.current
        if (!input) return
        e.preventDefault()
        input.focus()
        input.select()
      })
    }
    const entry = { ref, priority, seq: ++shortcutSeq }
    shortcuts.push(entry)
    shortcutListeners.forEach((l) => l())
    return () => {
      shortcuts.splice(shortcuts.indexOf(entry), 1)
      shortcutListeners.forEach((l) => l())
    }
  }, [ref, enabled, priority])
  return enabled && shortcutTarget()?.ref === ref
}

/** Select の選択肢。lead は先頭の絵（アイコン・ロゴ）、meta は右端の補足（人数など） */
export type SelectOption<T extends string> = { value: T; label: string; lead?: ReactNode; meta?: ReactNode }

/**
 * 1 つを選ぶプルダウン（表示の範囲・対象月・並び順）。ボタンを押すと選択肢の一覧が開き、選んだものにチェックが付く。
 * ブラウザ標準の <select> は使わない（見た目がそろわないため）。size="lg" はヘッダーに置く大きさ。
 * leadWidth は一覧の先頭の絵の幅（ロゴのように幅がまちまちなとき、名前の頭をそろえる）。
 * display はボタンに出す選択中の名前を、文字列の代わりに描くとき（月の数字をスロットで回すなど）
 */
export function Select<T extends string>({ value, options, onChange, label: labelProp, size = 'md', leadWidth, display, fit = false, disabled = false }: { value: T; options: SelectOption<T>[]; onChange: (v: T) => void; label?: string; size?: 'md' | 'lg'; leadWidth?: number; display?: ReactNode; fit?: boolean; disabled?: boolean }) {
  const f = useField(labelProp)
  const label = f.label ?? ''
  const cur = options.find((o) => o.value === value) || options[0]
  const listRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  // fit: ボタンの幅が足りないとき、名前を省略する前に補足（meta）→ 先頭の印（lead）の順に隠して、名前をなるべく全部出す
  useLayoutEffect(() => {
    const b = btnRef.current
    const box = b?.parentElement?.parentElement
    if (!fit || !b || !box) return
    const cut = () => {
      const lab = b.querySelector<HTMLElement>('.sel-label')
      return !!lab && lab.scrollWidth > lab.clientWidth + 1
    }
    const place = () => {
      b.classList.remove('fit-1', 'fit-2')
      if (cut()) b.classList.add('fit-1')
      if (cut()) b.classList.add('fit-2')
    }
    place()
    // 通知の中でクラスを付け替えると見ている枠の大きさが変わって通知が重なる（ResizeObserver loop）ので、次の描画で決める
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    })
    ro.observe(box)
    return () => (ro.disconnect(), cancelAnimationFrame(frame))
  }, [fit, value, cur?.label])
  // 選んだものが変わってボタンの幅が変わるときは、前の幅から新しい幅へなめらかに動かす
  const lastW = useRef<number | null>(null)
  useLayoutEffect(() => {
    const b = btnRef.current
    if (!b) return
    const prev = lastW.current
    b.style.width = ''
    const next = b.offsetWidth
    lastW.current = next
    if (prev == null || prev === next || reducedMotion()) return
    b.style.width = `${prev}px`
    void b.offsetWidth
    b.classList.add('resizing')
    b.style.width = `${next}px`
    const done = (e: TransitionEvent) => {
      if (e.propertyName !== 'width') return
      b.removeEventListener('transitionend', done)
      b.classList.remove('resizing')
      b.style.width = ''
    }
    b.addEventListener('transitionend', done)
    return () => b.removeEventListener('transitionend', done)
  }, [value, cur?.label])
  // 開いたら選択中の選択肢にフォーカスを置き、↑↓（Home・End で端）で移る。Enter・Space で選ぶ、Esc で閉じる（どちらもボタンへ戻る）
  const onKey = (e: ReactKeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null
    if (to === null) return
    e.preventDefault()
    items[Math.max(0, Math.min(items.length - 1, to))]?.focus()
  }
  return (
    <Popover
      className={`select ${size}`}
      trigger={(open, toggle) => (
        <button ref={btnRef} id={f.id} type="button" disabled={disabled} className={`btn select-btn ${open ? 'on' : ''}`} aria-invalid={f.invalid || undefined} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${cur?.label ?? ''}`} aria-describedby={f.describedBy} onClick={toggle}>
          {/* data-fit: 狭いときに落とす順番の目印（DESIGN.md 5 章。監査が「主役を詰める前に extra を隠したか」を測る） */}
          {cur?.lead && <span className="sel-lead" data-fit="extra">{cur.lead}</span>}
          <span className="sel-label" data-fit="main">{display ?? cur?.label}</span>
          {cur?.meta != null && <span className="sel-meta num" data-fit="extra">{cur.meta}</span>}
          <IconChevronDown className="sel-chev" size={15} stroke={1.8} />
        </button>
      )}
    >
      {(close) => (
        <div
          role="listbox"
          aria-label={label}
          ref={(el) => {
            // 開いた最初の 1 回だけ選択中の選択肢へ（開いているあいだに描き直されても、今いる選択肢から動かさない）
            if (!el) return
            if (listRef.current !== el) el.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
            listRef.current = el
          }}
          onKeyDown={onKey}
        >
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value} className="select-opt" onClick={() => (close(), btnRef.current?.focus(), o.value !== value && onChange(o.value))}>
              {(o.lead || leadWidth) && (
                <span className="sel-lead" style={leadWidth ? { width: leadWidth } : undefined}>
                  {o.lead}
                </span>
              )}
              <span className="sel-label">{o.label}</span>
              <IconCheck className="sel-check" size={15} stroke={1.8} />
              {o.meta != null && <span className="sel-meta num">{o.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

/**
 * パネル内の表示の切り替え（概要／メンバー）。count はラベルの右に小さく出す件数。
 * キーボードはタブの決まった型（WAI-ARIA の tablist）: Tab で入るのは選んでいるタブだけ、←→（Home・End で端）で隣のタブへ移って切り替える
 */
/**
 * タブ（WAI-ARIA の tabs。選んでいるタブだけ Tab で入り、← → / Home / End で切り替える）。label はタブの並びの名前。
 * id を渡すと、中身と結び付ける（中身の側は tabPanelProps(id, value) を付けた要素で包む）
 */
export function Tabs<T extends string>({ value, tabs, onChange, fit = false, label, id }: { value: T; tabs: { value: T; label: ReactNode; count?: number }[]; onChange: (v: T) => void; fit?: boolean; label?: string; id?: string }) {
  const { ref, thumb, ready } = useThumb(value)
  const onKey = (e: ReactKeyboardEvent) => {
    const i = tabs.findIndex((t) => t.value === value)
    const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
    if (to === null) return
    e.preventDefault()
    onChange(tabs[to].value)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus()
  }
  return (
    <div className={`tabs${ready ? ' ready' : ''}${fit ? ' fit' : ''}`} role="tablist" aria-label={label} ref={ref} onKeyDown={onKey}>
      <span className="thumb" ref={thumb} aria-hidden="true" />
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" id={id && `${id}-tab-${t.value}`} aria-controls={id && t.value === value ? `${id}-panel` : undefined} aria-selected={t.value === value} tabIndex={t.value === value ? 0 : -1} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count != null && <span className="n num">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Tabs の中身を包む要素に付ける（選んでいるタブの名前で読み上げる） */
export const tabPanelProps = (id: string, value: string) => ({ role: 'tabpanel', id: `${id}-panel`, 'aria-labelledby': `${id}-tab-${value}` }) as const

/** 要素を切り取る範囲（画面と、はみ出しを隠す親の重なり） */
function clipRect(el: HTMLElement) {
  const r = { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p)
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
    const b = p.getBoundingClientRect()
    r.top = Math.max(r.top, b.top)
    r.left = Math.max(r.left, b.left)
    r.right = Math.min(r.right, b.right)
    r.bottom = Math.min(r.bottom, b.bottom)
  }
  return r
}

/** 開いた面が下・右で切れるなら、反対側に開く（反対側のほうが広いときだけ）。Popover・Combobox で共通 */
export function usePlaced(ref: { current: HTMLElement | null }, open: boolean) {
  useLayoutEffect(() => {
    const el = ref.current
    const host = el?.parentElement
    if (!open || !el || !host) return
    const place = () => {
      el.classList.remove('up', 'flip')
      const clip = clipRect(el)
      const r = el.getBoundingClientRect()
      const h = host.getBoundingClientRect()
      if (r.bottom > clip.bottom && h.top - clip.top > clip.bottom - h.bottom) el.classList.add('up')
      if (r.left < clip.left || r.right > clip.right) el.classList.add('flip')
    }
    place()
    // 開いたまま中身が変わる（候補が絞られる）ときは測り直す。通知の中で動かすと通知が重なるので次の描画で
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    })
    ro.observe(el)
    return () => (ro.disconnect(), cancelAnimationFrame(frame))
  }, [ref, open])
}

/** ボタンで開閉し、外側のクリック・Esc・Tab で外へ出たときに閉じる小さなパネル。place="right" はボタンの右に、ボタンの下端から上へ開く（折りたたんだ左メニューの「+N」） */
export function Popover({ trigger, children, className = '', place = 'below' }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: ReactNode | ((close: () => void) => ReactNode); className?: string; place?: 'below' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  usePlaced(body, open && place === 'below')
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    // Esc で閉じたら、開いたボタンへフォーカスを戻す（キーボードで続けて操作できるように）
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Dialog の中で開いているときに、Dialog まで一緒に閉じないように
      e.preventDefault()
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    // Tab でパネルの外へフォーカスが出たら閉じる（開いたまま取り残さない。どこも押していない＝行き先が無いときは閉じない）
    <div className={`popover ${className}`} ref={ref} onBlur={(e) => open && e.relatedTarget && !ref.current?.contains(e.relatedTarget as Node) && setOpen(false)}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div ref={body} className={`popover-body ${place === 'right' ? 'right' : ''}`}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>}
    </div>
  )
}

/** 畳んだ引き出しに出す 1 行（何の詳細か。lead はアイコン、title は名前、sub は補足） */
export interface DrawerPeek {
  lead?: ReactNode
  title: ReactNode
  sub?: ReactNode
}

/**
 * 狭い画面で詳細を右（スマホ幅では下）から出す引き出し。開いたら引き出しにフォーカスを移し、閉じたら開く前の場所へ戻す
 * （Esc で閉じるのはアプリの役目。詳細を閉じる操作はアプリが持つ）。
 * peek を渡して minimized にすると、中身を残したまま画面の下の 1 行に畳む（裏の画面を見せる。DESIGN.md 5 章「操作の結果を見える場所に出す」）。
 * 畳んでいるあいだは背面を操作でき、行を押す・上へ払うと onExpand で広げる
 */
export function Drawer({ open, closing = false, onClose, label = '詳細', peek, minimized = false, onExpand, children }: { open: boolean; closing?: boolean; onClose: () => void; label?: string; peek?: DrawerPeek; minimized?: boolean; onExpand?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const min = !!peek && minimized
  // 上へ払ったら広げる（指を置いた位置から 30px 以上上へ）
  const touchY = useRef<number | null>(null)
  useEffect(() => {
    if (!open || min) return
    const back = document.activeElement as HTMLElement | null
    // 開いているあいだは背面を操作・読み上げの外にする（aria-modal だけでは Tab で背面へ出られる）。
    // 知らせの置き場は左メニューとも関わるので AppShell がまとめて決める（ここで外すと左メニューの分まで外してしまう）
    const behind = [...(ref.current?.parentElement?.children || [])].filter((el) => el !== ref.current && !el.classList.contains('drawer-scrim') && !el.classList.contains('toasts')) as HTMLElement[]
    for (const el of behind) el.inert = true
    ref.current?.focus()
    return () => {
      for (const el of behind) el.inert = false
      back?.focus?.()
    }
  }, [open, min])
  if (!open) return null
  return (
    <>
      {!min && <div className={`drawer-scrim ${closing ? 'closing' : ''}`} onClick={onClose} />}
      <div ref={ref} className={`drawer${min ? ' peek' : ''}${closing ? ' closing' : ''}`} {...(min ? { role: 'region' } : { role: 'dialog', 'aria-modal': true })} aria-label={label} tabIndex={-1}>
        {min && peek && (
          <div
            className="drawer-peek"
            onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
            onTouchEnd={(e) => touchY.current !== null && touchY.current - e.changedTouches[0].clientY > 30 && onExpand?.()}
          >
            <button type="button" className="drawer-peek-open" aria-expanded={false} onClick={onExpand}>
              {peek.lead}
              <span className="drawer-peek-t">
                <b>{peek.title}</b>
                {peek.sub && <small>{peek.sub}</small>}
              </span>
              <IconChevronUp size={18} stroke={1.8} aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn drawer-peek-x" aria-label={`${label}を閉じる`} data-tip="閉じる" onClick={onClose}>
              <IconX size={16} stroke={1.8} />
            </button>
          </div>
        )}
        {/* 畳んでも中身は残す（広げたときにスクロールの位置・開いていたところがそのまま） */}
        <div className="drawer-body" hidden={min}>
          {children}
        </div>
      </div>
    </>
  )
}
