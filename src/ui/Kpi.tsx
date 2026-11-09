// KPI の 1 枠（アイコン・ラベル・数字）。見た目は styles/components/kpi.css。

import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

import { useReturnFocus } from './A11y'
import { RollingNumber } from './Motion'

/**
 * アイコン・ラベル・数字の 1 枠。onClick を渡すと押せる枠になり（その値で絞り込む・強調する）、active で押し込まれた状態。
 * hidden（true / false）を渡すと、帯を畳むときに幅を 0 にして隠せる枠になる。sub は数字の下の比較（前の期間との差など。Delta）。
 * expanded（true / false）は、押すと一覧を開く枠（KpiBand がまとめた枠に付ける）
 */
export interface KpiProps {
  icon: ReactNode
  label: string
  value: number | null
  decimals?: number
  unit?: string
  sub?: ReactNode
  hidden?: boolean
  active?: boolean
  expanded?: boolean
  onClick?: () => void
}

export function Kpi({ icon, label, value, decimals = 0, unit, sub, hidden, active = false, expanded, onClick }: KpiProps) {
  const subId = useId()
  const number = value === null ? '—' : Math.max(0, value).toFixed(decimals)
  const cls = `kpi ${onClick ? 'press' : ''} ${active ? 'on' : ''} ${hidden != null ? 'fold' : ''} ${hidden ? 'hide' : ''}`
  const body = (
    <>
      <span className="kpi-ic" aria-hidden="true">{icon}</span>
      <span className="kpi-b" aria-hidden={onClick ? true : undefined}>
        <span className="kpi-l">{label}</span>
        <span className="kpi-v num">
          {value === null ? '—' : <RollingNumber value={value} decimals={decimals} />}
          {unit && <small>{unit}</small>}
        </span>
        {sub && <span className="kpi-s" id={subId}>{sub}</span>}
        {/* 一覧を開くボタンでもある押し込まれた枠は、押した状態を aria-pressed で言えないので文字で添える */}
        {active && expanded !== undefined && <span className="sr-only">（選択中）</span>}
      </span>
    </>
  )
  // 数字の表示を固定し、押せるときだけ透明なネイティブボタンを重ねる（数字を作り直すと回転しない）
  return (
    <div className={cls} aria-hidden={hidden || undefined} data-expanded={expanded}>
      {body}
      {onClick && (
        // 一覧を開く枠は開閉のボタン。選択中と開閉を同時に言わない
        <button type="button" className="kpi-action" aria-label={`${label} ${number}${unit || ''}${active && expanded !== undefined ? '（選択中）' : ''}`} aria-describedby={sub ? subId : undefined} aria-pressed={expanded === undefined ? active : undefined} aria-expanded={expanded} tabIndex={hidden ? -1 : undefined} onClick={onClick} />
      )}
    </div>
  )
}

/** KPI の帯のまとまり。summary（まとめた 1 枠。「拠点 3」など）を渡すと、入らないときに items（1 つずつの枠）をまとめられる */
export interface KpiGroup {
  key: string
  summary?: ReactElement<KpiProps>
  items: ReactElement<KpiProps>[]
}

/** まとめられるまとまりが n 個のときの、開く（true）・まとめる（false）の組み合わせ。先のまとまりを開くほうを先に並べる */
export function kpiVariants(n: number): boolean[][] {
  return Array.from({ length: 2 ** n }, (_, i) => Array.from({ length: n }, (_, j) => !((i >> (n - 1 - j)) & 1)))
}

/** 組み合わせごとの帯の幅から、入るもののうち幅をいちばん使うもの（同じ幅なら先のもの）を選ぶ。どれも入らなければいちばん狭いもの */
export function pickWidestFit(widths: number[], available: number): number {
  let best = -1
  widths.forEach((w, i) => {
    if (w <= available && (best < 0 || w > widths[best])) best = i
  })
  return best >= 0 ? best : widths.indexOf(Math.min(...widths))
}

/**
 * 幅に合わせて畳む KPI の帯（DESIGN.md 5 章「落とす順番」の 6 まとめる）。入らないまとまりは 1 つずつの枠を summary の 1 枠にまとめ、
 * 組み合わせは入るもののうち幅をいちばん使うもの。枠は幅と透明度でなめらかに出し入れする（本来の幅は見えない写しで測る）。
 * resetKey が変わったとき（画面を切り替えたとき）と初めて出すときは、動かさずにすぐ出す。
 * まとめた枠は押すと下に一覧（1 つずつの枠）を開き、そこで枠を押せる。押し込まれた枠（active）のあるまとまりは、まとめた枠の代わりに
 * その枠を帯に残す（押すと同じ一覧を開く）
 */
export function KpiBand({ groups, resetKey }: { groups: KpiGroup[]; resetKey?: string }) {
  const foldable = groups.filter((g) => g.summary)
  const variants = kpiVariants(foldable.length)
  const hide = (el: ReactElement<KpiProps>, hidden: boolean) => cloneElement(el, { hidden })
  // 一覧を開いているまとまり（key）。まとめていないときは出さない
  const [pop, setPop] = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  /** 組み合わせ v で帯に並べる枠（畳んで隠す枠も含む。帯の DOM の並びはどの組み合わせでも同じ） */
  const all = (v: boolean[]) =>
    groups.flatMap((g) => {
      if (!g.summary) return g.items
      const open = v[foldable.indexOf(g)]
      // まとめたときに帯に残す枠: 押し込まれた枠があればその枠、なければ summary。どちらも押すと一覧を開く
      const kept = g.items.find((el) => el.props.active)
      const menu = { expanded: pop === g.key, onClick: () => setPop((p) => (p === g.key ? null : g.key)) }
      return [cloneElement(g.summary, { hidden: open || !!kept, ...menu }), ...g.items.map((el) => (el === kept && !open ? cloneElement(el, { hidden: false, ...menu }) : hide(el, !open)))]
    })
  const shown = (v: boolean[]) => all(v).filter((el) => !el.props.hidden)
  const wrapRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  // 初めて出すときと resetKey が変わったときは、枠の出し入れや数字を動かさずにすぐ出す（幅を測って畳むより先に付け、2 フレーム後に外す）
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.classList.add('instant')
    let f2 = 0
    const f1 = requestAnimationFrame(() => (f2 = requestAnimationFrame(() => wrap.classList.remove('instant'))))
    return () => (cancelAnimationFrame(f1), cancelAnimationFrame(f2), wrap.classList.remove('instant'))
  }, [resetKey])
  const [mode, setMode] = useState(0)
  // 帯の中身（枠の顔ぶれ・ラベル・数字・押し込み）。変わっていなければ幅も同じなので測り直さない（描き直すたびにレイアウトの計算を強いないように）
  const content = JSON.stringify(groups.map((g) => [g.key, ...[g.summary, ...g.items].map((el) => el && [el.key, el.props.label, el.props.value, el.props.unit, el.props.active])]))
  const measured = useRef('')
  const pickRef = useRef(() => {})
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const measure = measureRef.current
    if (!wrap || !measure) return
    pickRef.current = () => {
      const rows = [...measure.children] as HTMLElement[]
      setMode(pickWidestFit(rows.map((c) => c.offsetWidth), wrap.clientWidth))
      // 出し入れする枠は、本来の幅と 0 のあいだで動かす（上限の幅で動かすと、縮み始めや広がり終わりが止まって見えてガクつく）。
      // 本来の幅は、全部開いた段と全部まとめた段の写しで測る
      const natural = new Map<string, number>()
      ;[0, variants.length - 1].forEach((vi) => shown(variants[vi]).forEach((el, i) => natural.set(String(el.key), Math.ceil(rows[vi].children[i].getBoundingClientRect().width))))
      const real = wrap.querySelector(':scope > .kpis')!.children
      all(variants[0]).forEach((el, i) => {
        const w = natural.get(String(el.key))
        if (w) (real[i] as HTMLElement).style.setProperty('--kpi-w', `${w}px`)
      })
    }
    if (measured.current === content) return
    measured.current = content
    pickRef.current()
  })
  // 帯の幅の変化と、写しの各段の幅の変化（数字の桁が増えると新しい桁は幅 0 から広がる）を 1 つの ResizeObserver で見続ける
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => pickRef.current())
    ro.observe(wrap)
    ;[...(measureRef.current?.children ?? [])].forEach((row) => ro.observe(row))
    return () => ro.disconnect()
  }, [])
  const current = variants[Math.min(mode, variants.length - 1)]
  const popGroup = foldable.find((g, i) => g.key === pop && !current[i])
  // 一覧は開いた枠の下に、帯の右端からはみ出さない位置で出す
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const el = popRef.current
    const anchor = wrap?.querySelector<HTMLElement>(':scope > .kpis > [data-expanded="true"]')
    if (wrap && el && anchor) el.style.left = `${Math.max(0, Math.min(anchor.offsetLeft, wrap.clientWidth - el.offsetWidth))}px`
  })
  // 外側を押す・Esc で閉じる（開いた枠そのものは、枠の onClick が閉じる）
  const isOpen = !!popGroup
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (!popRef.current?.contains(t) && !t.closest?.('.kpi[data-expanded="true"]')) setPop(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])
  // 一覧を開いたら最初の枠へ、閉じたら（選んで一覧が消えたときも）開いた枠へフォーカスを移す
  useReturnFocus(!!popGroup)
  useEffect(() => {
    if (popGroup) popRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }, [popGroup])
  return (
    <div className="kpis-wrap" ref={wrapRef}>
      <div className="kpis">{all(current)}</div>
      {popGroup && (
        <div className="kpi-pop" ref={popRef} role="group" aria-label={popGroup.summary!.props.label}>
          {popGroup.items.map((el) => cloneElement(el, { hidden: undefined, onClick: el.props.onClick && (() => (el.props.onClick!(), setPop(null))) }))}
        </div>
      )}
      <div className="kpis-measure" ref={measureRef} aria-hidden="true">
        {variants.map((v, i) => (
          <div className="kpis" key={i}>
            {shown(v)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 前の期間との差（「＋15名」）。better は増えて良い指標か減って良い指標か（良くなった差を緑、悪くなった差を茶で示す。0 は薄い文字）。
 * 良し悪しを色だけで伝えないよう、読み上げには「（改善）」「（悪化）」を添える（1.4.1）。value が null（比べる相手がない）ときは何も出さない。
 * 差が変わると、数字の桁は RollingNumber で回す（符号は文字のまま）
 */
export function Delta({ value, unit = '', decimals = 0, better = 'up' }: { value: number | null; unit?: string; decimals?: number; better?: 'up' | 'down' }) {
  if (value === null || !Number.isFinite(value)) return null
  const v = Number(value.toFixed(decimals))
  const tone = v === 0 ? 'flat' : (v > 0) === (better === 'up') ? 'good' : 'bad'
  return <span className={`delta ${tone} num`}>{v > 0 ? '＋' : v < 0 ? '−' : '±'}<RollingNumber value={Math.abs(v)} decimals={decimals} />{unit}{tone !== 'flat' && <span className="sr-only">{tone === 'good' ? '（改善）' : '（悪化）'}</span>}</span>
}
