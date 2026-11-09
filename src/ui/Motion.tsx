// 読み込み中・出現・開閉の動き。見た目は styles/components/motion.css。
// 動きの長さと緩急は DESIGN.md 6 章。prefers-reduced-motion では CSS 側で動きを切る。

import { IconChevronDown } from '@tabler/icons-react'
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** 動きを減らす設定か（JS で動かすものはこれを見て止める） */
// 端末の設定のほか、設定の「動きを減らす」（assist.ts が <html data-motion="reduce"> を付ける）でも止める
export const reducedMotion = () => document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * テーマなど画面全体の色の切り替えを、0.3s のフェードで見せる（View Transitions。長さは motion.css）。
 * setTheme は当てるだけで動かないので、利用者の操作で切り替えるときはこれで包む。
 * 対応していないブラウザ・動きを減らす設定では、apply をその場で呼ぶ
 */
export function withFade(apply: () => void) {
  const start = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition
  if (start && !reducedMotion()) start.call(document, apply)
  else apply()
}

/**
 * 読み込み中の形。中身と同じ並び（見出し＋数行）の薄い帯を、左から右へ光らせる。
 * 「読み込み中…」の文字や回転するマークの代わりに、中身が出る場所で使う
 */
export function Skeleton({ blocks = 1, lines = 3, heading = true, label = '読み込み中', variant }: { blocks?: number; lines?: number; heading?: boolean; label?: string; variant?: 'compact' | 'row' }) {
  // row: 一覧の 1 行（顔＋名前・補足の 2 行。EntityRow と同じ大きさ）。compact: 表の枠などの中に置く、上下の余白の小さい形
  if (variant === 'row')
    return (
      <span className="skel-row" role="status" aria-label={label}>
        <span className="skel-l" />
        <span>
          <span className="skel-l" />
          <span className="skel-l" />
        </span>
      </span>
    )
  return (
    <div className={`skel${variant === 'compact' ? ' compact' : ''}`} role="status" aria-label={label}>
      {Array.from({ length: blocks }, (_, b) => (
        <div className="skel-block" key={b}>
          {heading && <span className="skel-h" />}
          {Array.from({ length: lines }, (_, i) => (
            <span className="skel-l" key={i} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** 読み込み終わった中身を出すときの入り。子を上から順に少しずつ遅らせて、下から浮かせる */
export function Appear({ children }: { children: ReactNode }) {
  return <div className="appear">{children}</div>
}

/**
 * 長い中身を lines 行分の高さで畳み、「続きを読む」で開く。高さをなめらかに動かし、畳んでいる間は下端をぼかす。
 * 畳む必要がない（lines 行に収まる）ときはボタンを出さない
 */
export function Expandable({ lines = 6, more = '続きを読む', less = '折りたたむ', children }: { lines?: number; more?: string; less?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false)
  const [open, setOpen] = useState(false)
  // 畳んだときの高さ（中身の 1 行の高さ × lines）
  const limit = () => {
    const el = ref.current
    const first = el?.firstElementChild
    const lh = first ? parseFloat(getComputedStyle(first).lineHeight) : NaN
    return Math.round((Number.isFinite(lh) ? lh : 22) * lines)
  }
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const o = el.scrollHeight > limit() + 4
      setOver(o)
      if (!open) el.style.maxHeight = o ? `${limit()}px` : ''
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, open])

  const toggle = () => {
    const el = ref.current
    if (!el) return
    const full = el.scrollHeight
    if (!open) {
      // 開く: 今の高さ → 中身の高さ。動き終わったら高さの指定を外す（幅が変わっても追従する）
      el.style.maxHeight = `${full}px`
      // 中の要素の動き（ホバーなど）の終わりも届くので、自分の高さの動きだけを見る
      const done = (e?: TransitionEvent) => {
        if (e && (e.target !== el || e.propertyName !== 'max-height')) return
        el.removeEventListener('transitionend', done)
        el.style.maxHeight = 'none'
      }
      if (reducedMotion()) done()
      else el.addEventListener('transitionend', done)
      setOpen(true)
    } else {
      // 閉じる: 高さを数値に戻してから、畳んだ高さへ
      el.style.maxHeight = `${full}px`
      void el.offsetHeight
      el.style.maxHeight = `${limit()}px`
      setOpen(false)
    }
  }
  return (
    <div className={`expand ${over && !open ? 'clipped' : ''}`}>
      <div className="expand-body" ref={ref}>
        {children}
      </div>
      {over && (
        <button type="button" className="linkbtn expand-t" aria-expanded={open} onClick={toggle}>
          {open ? less : more}
          <IconChevronDown size={14} stroke={1.8} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * 中身の出し入れと、中身の高さの変化を、高さのアニメーションでなめらかにする（絞り込みの帯など、上に差し込まれて下を押し下げるもの）。
 * 閉じても、閉じ終わるまでは前の中身を残す。動いている間だけはみ出しを隠す（ツールチップを切らないように）
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)
  const kept = useRef<ReactNode>(children)
  if (open) kept.current = children
  if (open && !mounted) setMounted(true)
  useLayoutEffect(() => {
    const o = outer.current
    if (!o) return
    const fit = () => (o.style.height = open && inner.current ? `${inner.current.offsetHeight}px` : '0px')
    fit()
    // 動きを減らす設定では、閉じる動きがない（transitionend が来ない）ので、すぐ中身を外す
    if (!open && mounted && reducedMotion()) {
      setMounted(false)
      return
    }
    const on = (e: TransitionEvent) => e.target === o && o.classList.add('moving')
    const off = (e: TransitionEvent) => {
      if (e.target !== o) return
      o.classList.remove('moving')
      if (!open) setMounted(false)
    }
    o.addEventListener('transitionrun', on)
    o.addEventListener('transitionend', off)
    const ro = new ResizeObserver(fit)
    if (inner.current) ro.observe(inner.current)
    return () => (ro.disconnect(), o.removeEventListener('transitionrun', on), o.removeEventListener('transitionend', off))
  }, [open, mounted])
  return (
    // 閉じる途中の中身は読み上げとフォーカスから外す（見えなくなっていく帯の中のボタンに Tab で入らないように）
    <div className={`collapse ${open ? 'open' : ''}`} ref={outer} aria-hidden={!open || undefined} inert={!open}>
      {mounted && <div ref={inner}>{kept.current}</div>}
    </div>
  )
}

/**
 * 横の並びの中で、中身の実際の幅でなめらかに出し入れする（Collapse の横向き）。帯の中の、表示方法によって要る操作など。
 * 閉じると幅 0 に縮み、並びの間（gap。既定は帯の --bar-gap）も打ち消す。閉じているあいだは読み上げとフォーカスから外す
 */
export function CollapseInline({ open, gap, children }: { open: boolean; gap?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => el.style.setProperty('--collapse-w', `${el.scrollWidth}px`)
    measure()
    // 並びの幅で中身が出入りする（FitBar など）ので、置き場所の幅が変わったら測り直す
    const ro = new ResizeObserver(measure)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={`collapse-x${open ? ' open' : ''}`} style={gap ? ({ '--collapse-gap': gap } as CSSProperties) : undefined} aria-hidden={!open || undefined} inert={!open}>
      {children}
    </div>
  )
}

// 並びから外したものを残しておく長さ（motion.css の .collapse の transition と合わせる）
const LIST_OUT_MS = 320

/**
 * 並びの出し入れ（左メニューのお気に入りなど）。足したものは高さ 0 から開いてふわっと出し、外したものは閉じてから消す
 * （どちらも Collapse）。まわりの行は高さの変化に合わせてなめらかに詰まる・押し下がる。最初から出ているものは動かさない。
 * 外したものは、前にあった場所に閉じ終わるまで残す
 */
export function AnimatedList<T>({ items, keyOf, children }: { items: T[]; keyOf: (x: T) => string; children: (x: T) => ReactNode }) {
  const prev = useRef<{ k: string; x: T; gone: boolean }[] | null>(null)
  const expired = useRef(new Set<string>())
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const first = prev.current === null
  const before = new Set((prev.current || []).map((e) => e.k))
  const merged = items.map((x) => ({ k: keyOf(x), x, gone: false }))
  const now = new Set(merged.map((e) => e.k))
  const old = prev.current || []
  old.forEach((e, i) => {
    if (now.has(e.k) || expired.current.has(e.k)) return
    // 直前にあった行（まだ残っているもの）の後ろに残す
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const p = merged.findIndex((m) => m.k === old[j].k)
      if (p >= 0) {
        at = p + 1
        break
      }
    }
    merged.splice(at, 0, { ...e, gone: true })
  })
  const goneKeys = merged.filter((e) => e.gone).map((e) => e.k).join('\n')
  useLayoutEffect(() => {
    prev.current = merged
    now.forEach((k) => expired.current.delete(k))
  })
  useEffect(() => {
    if (!goneKeys) return
    const t = window.setTimeout(() => {
      goneKeys.split('\n').forEach((k) => expired.current.add(k))
      rerender()
    }, LIST_OUT_MS)
    return () => window.clearTimeout(t)
  }, [goneKeys])
  return (
    <>
      {merged.map((e) => (
        <ListItem key={e.k} enter={!first && !before.has(e.k)} gone={e.gone}>
          {children(e.x)}
        </ListItem>
      ))}
    </>
  )
}

/** AnimatedList の 1 行。足した直後は閉じた形で描いてから、次の描画で開く（高さ 0 から動かすため） */
function ListItem({ enter, gone, children }: { enter: boolean; gone: boolean; children: ReactNode }) {
  const [ready, setReady] = useState(!enter)
  useEffect(() => {
    if (ready) return
    // 閉じた形が描かれてから開く。裏のタブなど描画が止まっているときも開くよう、少し待つ処理も併せる
    const go = () => setReady(true)
    const r = requestAnimationFrame(() => requestAnimationFrame(go))
    const t = window.setTimeout(go, 60)
    return () => (cancelAnimationFrame(r), window.clearTimeout(t))
  }, [ready])
  return <Collapse open={ready && !gone}>{children}</Collapse>
}

/**
 * 数字が変わるとき、桁ごとに 0〜9 の帯を上下に回して止める（スロットのように）。増えると上へ、減ると下へ回る。
 * 桁は右からそろえる。桁が減るときは消える桁が 0 へ回りながら幅 0 に縮み、増えるときは新しい桁が幅 0 から広がる
 * （まわりの文字がガクッと動かないように）。初めの表示は動かさない。decimals は小数の桁数（小数点の後ろは桁数が決まっているので、幅は変えずに回す）
 */
export function RollingNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [int, frac = ''] = Math.max(0, value).toFixed(decimals).split('.')
  const digits = int.split('')
  const n = digits.length
  // 落ち着いている桁の数。増えたときは新しい桁を幅 0 で出してから広げ、減ったときは縮み終わるまで前の桁数のまま
  const [cols, setCols] = useState(n)
  useLayoutEffect(() => {
    if (n > cols) {
      let f2 = 0
      const f1 = requestAnimationFrame(() => (f2 = requestAnimationFrame(() => setCols(n))))
      return () => (cancelAnimationFrame(f1), cancelAnimationFrame(f2))
    }
    if (n < cols) {
      const t = window.setTimeout(() => setCols(n), 420)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])
  const total = Math.max(cols, n)
  const padded = [...Array(total - n).fill('0'), ...digits]
  // 幅 0 にする桁: 消えていく桁（先頭の 0）と、増えたばかりの桁
  const gone = (i: number) => i < total - n || i < n - cols
  const col = (d: string, key: string, off = false) => (
    <span className={`roll-col ${off ? 'gone' : ''}`} key={key} aria-hidden="true">
      <span className="roll-strip" style={{ transform: `translateY(${-Number(d) * 10}%)` }}>
        {DIGITS.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </span>
    </span>
  )
  return (
    <span className="roll">
      <span className="roll-sr">{decimals ? Math.max(0, value).toFixed(decimals) : Math.max(0, Math.round(value))}</span>
      {padded.map((d, i) => col(d, String(total - i), gone(i)))}
      {frac && <span className="roll-dot" aria-hidden="true">.</span>}
      {frac.split('').filter(Boolean).map((d, i) => col(d, `f${i}`))}
    </span>
  )
}
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * 文字の中の数字の部分だけを RollingNumber で回す（「12 件」「45.5%」「−3」など）。数でも文字でもない中身（要素）はそのまま出す。
 * 部品の件数・値の表示はこれを通し、値が変われば必ず桁が回るようにする（部品ごとに回す・回さないを分けない）
 */
export function RollingText({ children }: { children: ReactNode }) {
  if (typeof children === 'number') {
    if (!Number.isFinite(children)) return <>{String(children)}</>
    const t = String(Math.abs(children))
    return <>{children < 0 && '−'}{/e/.test(t) ? t : <RollingNumber value={Math.abs(children)} decimals={t.split('.')[1]?.length ?? 0} />}</>
  }
  if (typeof children !== 'string') return <>{children}</>
  const parts = children.split(/(\d+(?:\.\d+)?)/)
  return <>{parts.map((x, i) => (i % 2 ? <RollingNumber key={i} value={Number(x)} decimals={x.split('.')[1]?.length ?? 0} /> : x))}</>
}
