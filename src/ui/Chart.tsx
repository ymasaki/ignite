// グラフの部品（ダッシュボード）。1 色（--pri の濃淡）で描く。見た目は styles/components/chart.css。

import { ChartTooltip, chartTip } from './ChartTooltip'

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { announce } from './A11y'
import { RollingNumber } from './Motion'
import { squarify } from './squarify'

/**
 * グラフ 1 枚の枠（見出し・右端の補足・中身）。ダッシュボードの格子に並べる。wide は格子の横いっぱい、span は大小のタイルの格子（ChartGrid の tiles）で 2 マス分。
 * 見出しは読み上げの見出し（level、既定は h2。ページの h1 の下）。見た目は変えない
 */
export function ChartCard({ title, meta, wide = false, span, level = 2, children }: { title: ReactNode; meta?: ReactNode; wide?: boolean; span?: 2; level?: 2 | 3 | 4; children: ReactNode }) {
  const H = `h${level}` as const
  return (
    <section className={`chart ${wide ? 'wide' : ''} ${span === 2 ? 'span-2' : ''}`}>
      <div className="chart-h">
        <H className="chart-t">{title}</H>
        {meta && <span className="chart-meta">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

export interface BarItem {
  label: ReactNode
  value: number
  /** 右端に出す値（省略時は value） */
  text?: string
  /** 薄い色で描く（「なし」「その他」など） */
  muted?: boolean
}

/** 横棒の一覧（区分ごとの割合・項目ごとの件数など）。棒の長さは max（省略時は最大値）に対する割合 */
export function BarList({ items, max }: { items: BarItem[]; max?: number }) {
  const id = useId()
  const top = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <ChartTooltip>
    <div className="barlist">
      {items.map((it, i) => (
        <div className="bl" key={i} aria-labelledby={`${id}-${i}-label ${id}-${i}-value`} {...chartTip(`${typeof it.label === 'string' ? `${it.label}　` : ''}${it.text ?? it.value}`)}>
          <span id={`${id}-${i}-label`} className="bl-l">{it.label}</span>
          <span className="bl-t">
            <span className={`bl-f ${it.muted ? 'muted' : ''}`} style={{ width: `${Math.min(100, (it.value / top) * 100)}%` }} />
          </span>
          <span id={`${id}-${i}-value`} className="bl-v num">{it.text ?? it.value}</span>
        </div>
      ))}
    </div>
    </ChartTooltip>
  )
}

export interface LineSeries {
  label: string
  values: number[]
  /** 淡い線（補助の系列） */
  soft?: boolean
}

/**
 * 折れ線（利用者数の推移など）。x は等間隔。縦の目盛りは 3 本で、0 から最大値まで。fit は値のある範囲に合わせる
 * （人数の推移のように、0 から描くと変化が見えないもの。棒ではないので 0 から描かなくてよい）。
 * 枠の実際の幅で描く（決まった幅で描いて拡大すると、目盛りの文字まで大きくなるため）
 */
export function LineChart({ series, height = 180, xLabels = [], fit = false, area = false, legend = true, unit = '' }: { series: LineSeries[]; height?: number; xLabels?: string[]; fit?: boolean; area?: boolean; legend?: boolean; unit?: string }) {
  const grad = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height, L = 36, R = 20, T = 8, B = xLabels.length ? 20 : 8
  const points = Math.max(0, ...series.map((s) => s.values.length))
  const n = Math.max(2, points)
  const vals = series.flatMap((s) => s.values)
  const max = Math.max(1, ...vals)
  const min = fit && vals.length ? Math.min(...vals) : 0
  // 目盛りの間隔。fit は下の目盛りを間隔の倍数に切り下げ、2 間隔で最大値に届くまで広げる
  let step = niceStep(Math.max(1, max - min) / 2)
  // 値がすべて同じ（fit で幅が 0）ときは、線を下端に貼りつけず真ん中の目盛りに置く
  let bottom = fit && max === min ? min - step : Math.floor(min / step) * step
  while (bottom + step * 2 < max) {
    step = niceStep(step * 1.5)
    bottom = Math.floor(min / step) * step
  }
  const top = bottom + step * 2
  const x = (i: number) => L + (i * (W - L - R)) / (n - 1)
  const y = (v: number) => T + (1 - (v - bottom) / (top - bottom)) * (H - T - B)
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')
  // 日付の目盛りは 80px に 1 つまで
  const every = Math.max(1, Math.ceil(xLabels.length / Math.max(2, Math.floor(W / 80))))
  return (
    <ChartTooltip>
    <div className="line" ref={ref}>
      {/* 読み上げには、期間・最初と最新の値・最小と最大をまとめた名前と、見えない表（点ごとの値。ホバーの帯の代わり）を渡す */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={lineSummary(series, xLabels, unit)}>
        {[bottom, bottom + step, top].map((v) => (
          <g key={v}>
            <line className="line-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="line-ax" x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {xLabels.map((t, i) => i % every === 0 && <text key={i} className="line-ax" x={x(i)} y={H - 4} textAnchor="middle">{t}</text>)}
        {area && series[0] && (
          <>
            <defs>
              <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
                <stop className="line-area-top" offset="0" />
                <stop className="line-area-end" offset="1" />
              </linearGradient>
            </defs>
            <path className="line-area" fill={`url(#${grad})`} d={`${path(series[0].values)}L${x(series[0].values.length - 1).toFixed(1)} ${H - B}L${x(0).toFixed(1)} ${H - B}Z`} />
          </>
        )}
        {series.map((s) => <path key={s.label} className={`line-p ${s.soft ? 'soft' : ''}`} d={path(s.values)} />)}
        {/* 最後の値（今）に点を打つ。点が 1 つだけの系列は線にならないので、その点を打つ */}
        {area && series[0]?.values.length > 0 && <circle className="line-dot" cx={x(series[0].values.length - 1)} cy={y(series[0].values.at(-1)!)} r={4} />}
        {series.map((s, k) => s.values.length === 1 && !(area && k === 0) && <circle key={s.label} className={`line-dot ${s.soft ? 'soft' : ''}`} cx={x(0)} cy={y(s.values[0])} r={4} />)}
      </svg>
      {/* ホバーで、その点の期間と値を出す（点ごとの縦の帯。操作する範囲を広げるため HTML で重ねる）。
          帯はグラフの範囲に収める（両端の点の帯は半分の幅。点が 1 つなら範囲いっぱいの 1 本） */}
      <div className="line-hits" style={{ left: L, width: W - L - R, top: T, height: H - T - B }}>
        {Array.from({ length: points }, (_, i) => (
          <span key={i} className={points > 1 && (i === 0 || i === points - 1) ? 'edge' : ''} {...chartTip([xLabels[i], ...series.filter((s) => s.values[i] != null).map((s) => `${series.length > 1 ? `${s.label} ` : ''}${s.values[i]}${unit}`)].filter(Boolean).join('　'))}>
            {series.map((s) => s.values[i] != null && <i key={s.label} className={`line-pt${s.soft ? ' soft' : ''}`} style={{ top: y(s.values[i]!) - T }} aria-hidden="true" />)}
          </span>
        ))}
      </div>
      {legend && (
        <div className="line-legend" aria-hidden="true">
          {series.map((s) => (
            <span key={s.label}><i className={`line-key ${s.soft ? 'soft' : ''}`} />{s.label}</span>
          ))}
        </div>
      )}
      <SrTable head={['期間', ...series.map((s) => s.label)]} rows={lineRows(series, xLabels, unit)} />
    </div>
    </ChartTooltip>
  )
}

/** 数の並びの読み上げ用の要約（「最初 3名、最新 5名（最小 2名・最大 7名）」）。値のない点（null）は飛ばす */
export function seriesSummary(values: (number | null)[], unit = ''): string {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!nums.length) return '値なし'
  const u = (v: number) => `${v}${unit}`
  if (nums.length === 1) return u(nums[0])
  return `最初 ${u(nums[0])}、最新 ${u(nums.at(-1)!)}（最小 ${u(Math.min(...nums))}・最大 ${u(Math.max(...nums))}）`
}

/** 折れ線の読み上げ用の名前（期間の範囲と、系列ごとの要約） */
export function lineSummary(series: LineSeries[], xLabels: string[], unit = ''): string {
  const range = xLabels.length > 1 ? `${xLabels[0]}〜${xLabels.at(-1)}` : xLabels[0] || ''
  return [range, ...series.map((s) => `${s.label} ${seriesSummary(s.values, unit)}`)].filter(Boolean).join('、')
}

/** 折れ線の見えない表の行（点ごとに、期間の名前と系列ごとの値。値のない点は「—」） */
export function lineRows(series: LineSeries[], xLabels: string[], unit = ''): string[][] {
  const points = Math.max(0, ...series.map((s) => s.values.length))
  return Array.from({ length: points }, (_, i) => [xLabels[i] ?? String(i + 1), ...series.map((s) => (s.values[i] == null ? '—' : `${s.values[i]}${unit}`))])
}

/** 積み上げの縦の棒の見えない表の行（期間ごとに、内訳・合計・減った数） */
export function stackRows(labels: string[], stacks: { values: number[] }[], down?: { values: number[] }): string[][] {
  return labels.map((l, i) => {
    const vs = stacks.map((s) => s.values[i] || 0)
    return [l, ...vs.map(String), String(vs.reduce((a, b) => a + b, 0)), ...(down ? [String(down.values[i] || 0)] : [])]
  })
}

/**
 * 読み上げにだけ渡す表（.sr-only。グラフの値を目で見る代わりに、表の見出しで行と列を読み進められる）。1 列目は行の見出し。
 * 表は幅を中身より狭くできず、.sr-only の 1px でもはみ出して横に送れてしまうので、.sr-only の箱に入れて切り取る
 */
export function SrTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="sr-only">
      <table>
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, k) => (k ? <td key={k}>{c}</td> : <th key={k} scope="row">{c}</th>))}</tr>)}</tbody>
      </table>
    </div>
  )
}

/**
 * グラフの格子。既定は 1 枚 360px 以上で折り返す。tiles は大小のタイル（4 列。ChartCard の span=2 で 2 マス。
 * 格子の幅が狭ければ 2 列・1 列に減らす）。いちばん大事な数字のタイルを大きくして、見る順を付ける
 */
export function ChartGrid({ tiles = false, children }: { tiles?: boolean; children: ReactNode }) {
  if (!tiles) return <div className="chart-grid">{children}</div>
  return (
    <div className="chart-tiles">
      <div className="chart-grid tiles">{children}</div>
    </div>
  )
}

/** ダッシュボードの大きな数字（label・数字・単位）。size は lg（タイルの主役）/ md。数字は変わると桁ごとに回す。value が null は「—」（0 と区別する） */
export function Stat({ label, value, unit, decimals = 0, size = 'md', tone, after }: { label?: ReactNode; value: number | null; unit?: string; decimals?: number; size?: 'lg' | 'md'; tone?: 'muted'; after?: ReactNode }) {
  return (
    <div className={`stat ${size} ${tone || ''}`}>
      {label && <span className="stat-l">{label}</span>}
      <span className="stat-v num">
        {value === null ? '—' : <RollingNumber value={value} decimals={decimals} />}
        {unit && <small>{unit}</small>}
        {after}
      </span>
    </div>
  )
}

/**
 * 積み上げの縦の棒（期間ごとの内訳。stacks は下から順に --chart-1 からの濃淡）。down は 0 の線から下に伸ばす減った数（薄い灰色）。
 * 棒の上に積み上げの合計、下に期間の名前。current の期間の名前を太字にする
 */
export function StackColumns({ labels, stacks, down, current, height = 180 }: { labels: string[]; stacks: { label: string; values: number[] }[]; down?: { label: string; values: number[] }; current?: number; height?: number }) {
  const totals = labels.map((_, i) => stacks.reduce((a, s) => a + (s.values[i] || 0), 0))
  const upMax = Math.max(1, ...totals), downMax = down ? Math.max(0, ...down.values) : 0
  const every = Math.max(1, Math.ceil(labels.length / 8))
  return (
    <ChartTooltip>
    <div className="stackcols">
      {/* 列の名前は内訳を含める。期間・凡例は重複を避けて隠し、同じ値を見えない表でも渡す */}
      <div className="sc-cols" style={{ height }}>
        {labels.map((l, i) => (
          <div className={`sc-col${i === current ? ' on' : ''}`} key={i} {...chartTip([l, ...stacks.map((s) => `${s.label} ${s.values[i] || 0}`), ...(down ? [`${down.label} ${down.values[i] || 0}`] : [])].join('　'))}>
            <span className="sc-up" style={{ flexGrow: upMax }}>
              <span className="sc-stack" style={{ height: `${(totals[i] / upMax) * 100}%` }}>
                <span className="sc-total num">{totals[i]}</span>
                {stacks.map((s, k) => (s.values[i] ? <i key={k} className={`chart-c${Math.min(k + 1, 5)}`} style={{ flexGrow: s.values[i] }} /> : null))}
              </span>
            </span>
            {downMax > 0 && <span className="sc-down" style={{ flexGrow: downMax }}><i style={{ height: `${((down!.values[i] || 0) / downMax) * 100}%` }} /></span>}
          </div>
        ))}
      </div>
      <div className="sc-labels" aria-hidden="true">
        {labels.map((l, i) => <span key={i} className={i === current ? 'on' : ''}>{(i % every === 0 || i === labels.length - 1 || i === current) && l}</span>)}
      </div>
      <div className="line-legend" aria-hidden="true">
        {stacks.map((s, k) => <span key={s.label}><i className={`sc-key chart-c${Math.min(k + 1, 5)}`} />{s.label}</span>)}
        {down && <span><i className="sc-key chart-muted" />{down.label}</span>}
      </div>
      <SrTable head={['期間', ...stacks.map((s) => s.label), '合計', ...(down ? [down.label] : [])]} rows={stackRows(labels, stacks, down)} />
    </div>
    </ChartTooltip>
  )
}

/** 数字に添える小さな推移の線（目盛りなし。形だけを見せる）。値のない点（null）は飛ばす。点が 1 つなら点を打つ。読み上げの名前は label と推移の要約（unit は値の単位） */
export function Sparkline({ values, label, unit = '', height = 32 }: { values: (number | null)[]; label: string; unit?: string; height?: number }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  const W = 100, max = Math.max(...pts.map((p) => p[1])), min = Math.min(...pts.map((p) => p[1]))
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * W : W / 2)
  const y = (v: number) => (max === min ? height / 2 : 3 + (1 - (v - min) / (max - min)) * (height - 6))
  return (
    <ChartTooltip inline>
    <svg {...chartTip(`${label}、${seriesSummary(values, unit)}`)} className="spark" viewBox={`0 0 ${W} ${height}`} height={height} preserveAspectRatio="none" role="img" aria-label={`${label}、${seriesSummary(values, unit)}`}>
      {pts.length > 1 && <path d={pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join('')} />}
      {pts.length === 1 && <line className="spark-dot" x1={x(pts[0][0])} x2={x(pts[0][0])} y1={y(pts[0][1])} y2={y(pts[0][1])} />}
    </svg>
    </ChartTooltip>
  )
}

/**
 * 段ごとに減っていく数（全体 → … → いちばん深い段）。段ごとに名前・数・棒（最初の段を 100% とした高さ）と、
 * 前の段・最初の段に対する割合を出す。ofPrev・ofFirst は割合の前に添える語、note は最初の段の補足
 */
export function Funnel({ steps, unit = '', ofPrev, ofFirst, note }: { steps: { label: string; value: number }[]; unit?: string; ofPrev: string; ofFirst: string; note?: string }) {
  const first = steps[0]?.value || 0
  const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—')
  return (
    <ChartTooltip>
    <div className="funnel-wrap">
      <div className="funnel">
        {steps.map((st, i) => (
          <div className="fn-step" key={i} {...chartTip(`${st.label}　${st.value}${unit}${i ? `　${ofPrev} ${rate(st.value, steps[i - 1].value)}　${ofFirst} ${rate(st.value, first)}` : note ? `　${note}` : ''}`)}>
            <Stat label={st.label} value={st.value} unit={unit} />
            <span className="fn-col"><i className={`chart-c${Math.min(i + 1, 3)}`} style={{ height: `${first ? Math.min(100, (st.value / first) * 100) : 0}%` }} /></span>
            <span className="fn-rate num">{i === 0 ? note : <>{ofPrev} <b>{rate(st.value, steps[i - 1].value)}</b>・{ofFirst} {rate(st.value, first)}</>}</span>
          </div>
        ))}
      </div>
    </div>
    </ChartTooltip>
  )
}

export interface TileItem {
  key: string
  label: string
  /** 名前の下の補足（「34 / 140名」など）。小さいタイルでは出さない */
  sub?: string
  /** タイルの大きな値（「24%」など） */
  value: string
  /** 面積（人数など） */
  size: number
  /** 濃さ（0〜1）。null は値なし（薄い地） */
  ratio: number | null
}

/**
 * 面積で大きさ、濃さで割合を示すタイルの地図（squarify）。1 色の濃淡で描き、押すとその項目を選ぶ。
 * 枠の実際の幅で敷き詰める。scale は濃さの凡例の両端の値
 */
export function TileMap({ items, selected, onSelect, label, height = 360, scale }: { items: TileItem[]; selected?: string; onSelect?: (key: string) => void; label: string; height?: number; scale?: [string, string] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const tiles = W ? squarify(items, (t) => t.size, W, height) : []
  return (
    <ChartTooltip>
    <div className="tilemap">
      <div className="tm-area" ref={ref} style={{ height }} role="group" aria-label={label}>
        {tiles.map(({ item: t, x, y, w, h }) => {
          const size = w < 64 || h < 40 ? ' xs' : w < 120 || h < 76 ? ' sm' : ''
          return (
            <button key={t.key} type="button" className={`tm-tile${size}${t.ratio !== null && t.ratio > 0.55 ? ' dark' : ''}${t.ratio === null ? ' none' : ''}`}
              style={{ left: x, top: y, width: w, height: h, '--r': t.ratio ?? 0 } as CSSProperties}
              aria-pressed={selected === t.key} {...chartTip(`${t.label}　${t.value}${t.sub ? `　${t.sub}` : ''}`)} role="button"
              onClick={() => (onSelect?.(t.key), announce(`${tileName(t)} を選びました`))}>
              <span className="tm-l">{t.label}</span>
              <span className="tm-v num">{t.value}</span>
              {t.sub && <span className="tm-s num">{t.sub}</span>}
            </button>
          )
        })}
      </div>
      {scale && <div className="tm-scale"><span className="num">{scale[0]}</span><i /><span className="num">{scale[1]}</span></div>}
    </div>
    </ChartTooltip>
  )
}

/** タイルの読み上げの名前（名前・値・補足。補足は小さいタイルでは見えないが、読み上げには渡す） */
export function tileName(t: Pick<TileItem, 'label' | 'value' | 'sub'>): string {
  return [t.label, t.value, t.sub].filter(Boolean).join(' ')
}

/** 目盛りの間隔（1・2・5 × 10 の累乗） */
function niceStep(v: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1)))
  const m = v / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p
}
