// グラフの部品（縦棒・円・散布図・レーダー・ヒートマップ・ゲージ・滝・箱ひげ）。Chart.tsx と同じく 1 色（--chart-1〜5 の濃淡）で描く。
// 見た目は styles/components/plot.css。形で見せる値は、読み上げに要約の名前と見えない表（SrTable）で渡す

import { ChartTooltip, chartTip } from './ChartTooltip'

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { reducedMotion } from './Motion'

import { SrTable, seriesSummary } from './Chart'

// ---- 共通 ----

/** 値の変化を動かす長さ（DESIGN.md 4 章の「数字・棒の長さの変化」0.6s。RollingNumber と同じ） */
const TWEEN_MS = 600
/** --ease-spring（cubic-bezier(.34,1.32,.5,1)）に近い、少し行き過ぎて戻る動き */
const springOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

/**
 * 数の並びが変わったとき、前の値から新しい値へ TWEEN_MS かけて近づけた値を返す（SVG の棒の高さは CSS では動かせないため）。
 * 初めの表示と、動きを減らす設定のときは新しい値をそのまま返す。並びの長さが変わったときも動かさない
 */
export function useTween(target: number[]): number[] {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const key = target.join(',')
  useLayoutEffect(() => {
    const start = from.current
    if (start.length !== target.length || start.every((v, i) => v === target[i]) || reducedMotion()) {
      from.current = target
      setShown(target)
      return
    }
    const t0 = performance.now()
    let f = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / TWEEN_MS)
      const e = springOut(p)
      const cur = target.map((v, i) => start[i] + (v - start[i]) * e)
      from.current = cur
      setShown(cur)
      if (p < 1) f = requestAnimationFrame(step)
    }
    f = requestAnimationFrame(step)
    return () => cancelAnimationFrame(f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return shown.length === target.length ? shown : target
}

/** 枠の実際の幅（決まった幅で描いて拡大すると、目盛りの文字まで大きくなるため） */
function useWidth(init = 640) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(init)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** 小数のずれ（0.1 + 0.2 など）を消した数 */
const clean = (v: number) => Number(v.toPrecision(12))

/** 目盛りの間隔（1・2・5 × 10 の累乗。小数にも使える） */
function nice(v: number): number {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const m = v / p
  return clean((m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p)
}

/** nice より細かい間隔（1・2・2.5・5 × 10 の累乗）。本数の決まった目盛り（右の目盛り）で上端を空けすぎないため */
function niceFine(v: number): number {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const m = v / p
  return clean((m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p)
}

/**
 * 目盛りの値（下から上へ）。lo〜hi を覆う最小の範囲で、間隔は 1・2・5 × 10 の累乗（区切りがおよそ count になる）。
 * 値がすべて同じときは 0 からその値まで（0 なら 0〜1）
 */
export function axisTicks(lo: number, hi: number, count = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) lo = hi = 0
  if (lo === hi) {
    if (lo === 0) hi = 1
    else if (lo > 0) lo = 0
    else hi = 0
  }
  const step = nice((hi - lo) / count)
  const bottom = Math.floor(clean(lo / step)), top = Math.ceil(clean(hi / step))
  return Array.from({ length: top - bottom + 1 }, (_, i) => clean((bottom + i) * step))
}

/** 目盛りの数の文字 */
const tick = (v: number) => String(clean(v))

/** 縦の目盛り（横の罫線と左の数） */
function YGrid({ ticks, y, L, R, W }: { ticks: number[]; y: (v: number) => number; L: number; R: number; W: number }) {
  return (
    <>
      {ticks.map((v) => (
        <g key={v}>
          <line className={`line-grid${v === 0 && ticks[0] < 0 ? ' plot-zero' : ''}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="line-ax" x={L - 6} y={y(v) + 4} textAnchor="end">{tick(v)}</text>
        </g>
      ))}
    </>
  )
}

/** 横の項目名。gap px（既定 56。区分の名前が欠かせない滝・箱ひげは 36）に 1 つまで間引き、current は太字にして必ず出す */
function XLabels({ labels, cx, y, W, current, gap = 56 }: { labels: string[]; cx: (i: number) => number; y: number; W: number; current?: number; gap?: number }) {
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(W / gap))))
  return <>{labels.map((t, i) => (i % every === 0 || i === current) && <text key={i} className={`line-ax${i === current ? ' on' : ''}`} x={cx(i)} y={y} textAnchor="middle">{t}</text>)}</>
}

/** ホバーの帯（項目ごとに 1 本。操作する範囲を広げるため HTML で重ねる） */
function Hits({ tips, box }: { tips: string[]; box: { left: number; top: number; width: number; height: number } }) {
  return (
    <div className="plot-hits" style={box}>
      {tips.map((t, i) => <span key={i} {...chartTip(t)} />)}
    </div>
  )
}

/** 凡例（見える文字だけ。読み上げは見えない表で渡す） */
function Legend({ items }: { items: { label: string; tone: string; kind?: 'line' | 'box' }[] }) {
  return (
    <div className="line-legend" aria-hidden="true">
      {items.map((it) => <span key={it.label}><i className={`${it.kind === 'line' ? 'line-key' : 'sc-key'} ${it.tone}`} />{it.label}</span>)}
    </div>
  )
}

/** 棒の形（0 から離れた側の角だけを丸める） */
function barPath(x: number, w: number, y0: number, y1: number, r = 6): string {
  const h = Math.abs(y1 - y0)
  const k = Math.max(0, Math.min(r, w / 2, h))
  const top = Math.min(y0, y1), bot = Math.max(y0, y1)
  if (y1 <= y0) return `M${x} ${bot}V${top + k}Q${x} ${top} ${x + k} ${top}H${x + w - k}Q${x + w} ${top} ${x + w} ${top + k}V${bot}Z`
  return `M${x} ${top}V${bot - k}Q${x} ${bot} ${x + k} ${bot}H${x + w - k}Q${x + w} ${bot} ${x + w} ${bot - k}V${top}Z`
}

const valueText = (v: number | null | undefined, unit: string) => (v == null || !Number.isFinite(v) ? '—' : `${clean(v)}${unit}`)

// ---- 縦棒 ----

export interface ColumnSeries {
  label: string
  values: (number | null)[]
}

/**
 * 縦棒（期間・区分ごとの数）。series は 3 系列まで並べ（--chart-1 から濃い順）、縦の目盛りは 0 から。負の数は 0 の線から下に伸ばす。
 * histogram は隙間なく並べる度数の分布（1 系列）。line は棒に重ねる折れ線（右の目盛り。件数と率のような単位の違う値。棒は薄い段 --chart-3 からになり、2 系列まで）。current の項目名を太字にする
 */
export function ColumnChart({ labels, series, line, unit = '', lineUnit = '', histogram = false, current, height = 200, legend }: {
  labels: string[]; series: ColumnSeries[]; line?: ColumnSeries; unit?: string; lineUnit?: string; histogram?: boolean; current?: number; height?: number; legend?: boolean
}) {
  const [ref, W] = useWidth()
  const ss = series.slice(0, line ? 2 : 3)
  const n = Math.max(1, labels.length)
  const vals = ss.flatMap((s) => s.values.filter((v): v is number => v != null))
  const ticks = axisTicks(Math.min(0, ...vals), Math.max(0, ...vals))
  const lineVals = line?.values.filter((v): v is number => v != null) ?? []
  // 右の目盛りは左と同じ本数にして、罫線の位置にそろえる（負の値があるときは独自の目盛り）
  const rStep = niceFine(Math.max(1e-9, ...lineVals) / Math.max(1, ticks.length - 1))
  const rTicks = !line ? [] : Math.min(0, ...lineVals) < 0 ? axisTicks(Math.min(0, ...lineVals), Math.max(0, ...lineVals)) : ticks.map((_, i) => clean(i * rStep))
  const H = height, L = 40, R = line ? 44 : 12, T = 10, B = 20
  // 値が変わったら、棒の高さ・線の点・目盛りの範囲を前の値から動かす（欠けた値は 0 として動かし、描かない）
  const flat = [...ss.flatMap((s) => labels.map((_, i) => s.values[i] ?? 0)), ...(line ? labels.map((_, i) => line.values[i] ?? 0) : []), ticks[0], ticks.at(-1)!, rTicks[0] ?? 0, rTicks.at(-1) ?? 0]
  const tw = useTween(flat)
  const at = (k: number, i: number) => tw[k * n + i]
  const [lo, hi, rlo, rhi] = tw.slice(-4)
  const band = (W - L - R) / n
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const ry = (v: number) => T + (1 - (v - rlo) / (rhi - rlo)) * (H - T - B)
  const cx = (i: number) => L + band * (i + 0.5)
  const groupW = histogram ? band - 1 : Math.min(band * 0.64, 40 * ss.length)
  const barW = histogram ? groupW : (groupW - 2 * (ss.length - 1)) / ss.length
  const linePts = line ? line.values.map((v, i) => [i, v == null ? null : at(ss.length, i)] as const).filter((p): p is readonly [number, number] => p[1] != null) : []
  const showLegend = legend ?? (ss.length > 1 || !!line)
  // 折れ線を重ねるときは、棒を薄い段（--chart-3 から）にして線を見せる
  const tone = line ? 3 : 1
  return (
    <ChartTooltip>
    <div className="plot" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={columnSummary(labels, ss, line, unit, lineUnit)}>
        <YGrid ticks={ticks} y={y} L={L} R={R} W={W} />
        {line && rTicks.map((v) => <text key={v} className="line-ax" x={W - R + 6} y={ry(v) + 4}>{tick(v)}</text>)}
        <XLabels labels={labels} cx={cx} y={H - 4} W={W} current={current} />
        {ss.map((s, k) => s.values.map((v, i) => v == null || v === 0 ? null : (
          <path key={`${k}-${i}`} className={`plot-bar chart-f${k + tone}`} d={barPath(cx(i) - groupW / 2 + k * (barW + 2), barW, y(0), y(at(k, i)), histogram ? 2 : 6)} />
        )))}
        {linePts.length > 1 && <path className="line-p" d={linePts.map(([i, v], k) => `${k ? 'L' : 'M'}${cx(i).toFixed(1)} ${ry(v).toFixed(1)}`).join('')} />}
        {linePts.map(([i, v]) => <circle key={i} className="line-dot" cx={cx(i)} cy={ry(v)} r={4} />)}
      </svg>
      <Hits box={{ left: L, top: T, width: W - L - R, height: H - T - B }} tips={labels.map((l, i) => [l, ...ss.map((s) => `${ss.length > 1 || line ? `${s.label} ` : ''}${valueText(s.values[i], unit)}`), ...(line ? [`${line.label} ${valueText(line.values[i], lineUnit)}`] : [])].join('　'))} />
      {showLegend && <Legend items={[...ss.map((s, k) => ({ label: s.label, tone: `chart-c${k + tone}` })), ...(line ? [{ label: line.label, tone: '', kind: 'line' as const }] : [])]} />}
      <SrTable head={['項目', ...ss.map((s) => s.label), ...(line ? [line.label] : [])]} rows={labels.map((l, i) => [l, ...ss.map((s) => valueText(s.values[i], unit)), ...(line ? [valueText(line.values[i], lineUnit)] : [])])} />
    </div>
    </ChartTooltip>
  )
}

/** 縦棒の読み上げ用の名前（項目の範囲と、系列ごとの要約） */
export function columnSummary(labels: string[], series: ColumnSeries[], line?: ColumnSeries, unit = '', lineUnit = ''): string {
  const range = labels.length > 1 ? `${labels[0]}〜${labels.at(-1)}` : labels[0] || ''
  return [range, ...series.map((s) => `${s.label} ${seriesSummary(s.values, unit)}`), ...(line ? [`${line.label} ${seriesSummary(line.values, lineUnit)}`] : [])].filter(Boolean).join('、')
}

// ---- 滝 ----

/**
 * 増減の積み上げ（期首 → 増えた・減った分 → 期末）。最初の棒は start、増えた分は --chart-2、減った分は灰色で、
 * 棒の上に符号つきの数を書く（色だけに頼らない）。total は最後に置く合計の棒の名前
 */
export function Waterfall({ start, steps, total, unit = '', height = 220 }: { start: { label: string; value: number }; steps: { label: string; value: number }[]; total?: string; unit?: string; height?: number }) {
  const [ref, W] = useWidth()
  const bars = waterfallBars(start, steps, total)
  const ticks = axisTicks(Math.min(0, ...bars.map((b) => Math.min(b.from, b.to))), Math.max(0, ...bars.map((b) => Math.max(b.from, b.to))))
  const H = height, L = 40, R = 12, T = 18, B = 20
  const band = (W - L - R) / bars.length
  const bw = Math.min(band * 0.64, 48)
  const y = (v: number) => T + (1 - (v - ticks[0]) / (ticks.at(-1)! - ticks[0])) * (H - T - B)
  const cx = (i: number) => L + band * (i + 0.5)
  const sign = (v: number) => (v > 0 ? `+${clean(v)}` : v < 0 ? `−${clean(-v)}` : '±0')
  return (
    <ChartTooltip>
    <div className="plot" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${start.label} ${clean(start.value)}${unit}から${total ?? '最後'} ${clean(bars.at(-1)!.to)}${unit}`}>
        <YGrid ticks={ticks} y={y} L={L} R={R} W={W} />
        <XLabels labels={bars.map((b) => b.label)} cx={cx} y={H - 4} W={W} gap={36} />
        {bars.map((b, i) => (
          <g key={i}>
            {i > 0 && <line className="plot-link" x1={cx(i - 1) + bw / 2} x2={cx(i) - bw / 2} y1={y(bars[i - 1].to)} y2={y(bars[i - 1].to)} />}
            <path className={`plot-bar ${b.kind === 'down' ? 'chart-fm' : b.kind === 'up' ? 'chart-f2' : 'chart-f1'}`} d={barPath(cx(i) - bw / 2, bw, y(b.from), y(b.to), b.kind === 'down' ? 0 : 6)} />
            <text className="plot-v" x={cx(i)} y={y(Math.max(b.from, b.to)) - 4} textAnchor="middle">{b.kind === 'up' || b.kind === 'down' ? sign(b.to - b.from) : tick(b.to)}</text>
          </g>
        ))}
      </svg>
      <Hits box={{ left: L, top: T, width: W - L - R, height: H - T - B }} tips={bars.map((b) => `${b.label}　${b.kind === 'up' || b.kind === 'down' ? `${sign(b.to - b.from)}${unit}　累計 ` : ''}${clean(b.to)}${unit}`)} />
      <SrTable head={['項目', '増減', '累計']} rows={bars.map((b) => [b.label, b.kind === 'up' || b.kind === 'down' ? `${sign(b.to - b.from)}${unit}` : '—', `${clean(b.to)}${unit}`])} />
    </div>
    </ChartTooltip>
  )
}

/** 滝の棒（下端 from・上端 to と種類）。start と total は 0 から、増減は前の累計から */
export function waterfallBars(start: { label: string; value: number }, steps: { label: string; value: number }[], total?: string) {
  const out: { label: string; from: number; to: number; kind: 'start' | 'up' | 'down' | 'total' }[] = [{ label: start.label, from: 0, to: start.value, kind: 'start' }]
  let sum = start.value
  for (const s of steps) {
    out.push({ label: s.label, from: sum, to: clean(sum + s.value), kind: s.value < 0 ? 'down' : 'up' })
    sum = clean(sum + s.value)
  }
  if (total) out.push({ label: total, from: 0, to: sum, kind: 'total' })
  return out
}

// ---- 箱ひげ ----

export interface BoxItem {
  label: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  /** ひげの外の値（点で打つ） */
  outliers?: number[]
}

/** 値の並びから箱ひげの 5 つの数を求める（四分位は線形補間。ひげは箱から 1.5 倍の幅の内側でいちばん遠い値、その外は outliers）。値がなければ null */
export function boxStats(values: number[]): Omit<BoxItem, 'label'> | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  const q = (p: number) => {
    const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i)
    return clean(v[lo] + (v[hi] - v[lo]) * (i - lo))
  }
  const q1 = q(0.25), q3 = q(0.75), w = (q3 - q1) * 1.5
  const inside = v.filter((x) => x >= q1 - w && x <= q3 + w)
  return { min: inside[0], q1, median: q(0.5), q3, max: inside.at(-1)!, outliers: v.filter((x) => x < q1 - w || x > q3 + w) }
}

/** 箱ひげ図（区分ごとのばらつき。箱は第 1〜第 3 四分位、太い線は中央値、ひげは最小〜最大、点は外れ値）。縦の目盛りは値のある範囲に合わせる */
export function BoxPlot({ items, unit = '', height = 220 }: { items: BoxItem[]; unit?: string; height?: number }) {
  const [ref, W] = useWidth()
  const all = items.flatMap((b) => [b.min, b.max, ...(b.outliers ?? [])])
  const ticks = axisTicks(Math.min(...all), Math.max(...all))
  const H = height, L = 40, R = 12, T = 10, B = 20
  const band = (W - L - R) / Math.max(1, items.length)
  const bw = Math.min(band * 0.5, 48)
  const y = (v: number) => T + (1 - (v - ticks[0]) / (ticks.at(-1)! - ticks[0])) * (H - T - B)
  const cx = (i: number) => L + band * (i + 0.5)
  const u = (v: number) => `${clean(v)}${unit}`
  return (
    <ChartTooltip>
    <div className="plot" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={items.map((b) => `${b.label} 中央値 ${u(b.median)}`).join('、')}>
        <YGrid ticks={ticks} y={y} L={L} R={R} W={W} />
        <XLabels labels={items.map((b) => b.label)} cx={cx} y={H - 4} W={W} gap={36} />
        {items.map((b, i) => (
          <g key={i}>
            <line className="plot-whisker" x1={cx(i)} x2={cx(i)} y1={y(b.max)} y2={y(b.q3)} />
            <line className="plot-whisker" x1={cx(i)} x2={cx(i)} y1={y(b.q1)} y2={y(b.min)} />
            <line className="plot-whisker" x1={cx(i) - bw / 4} x2={cx(i) + bw / 4} y1={y(b.max)} y2={y(b.max)} />
            <line className="plot-whisker" x1={cx(i) - bw / 4} x2={cx(i) + bw / 4} y1={y(b.min)} y2={y(b.min)} />
            <rect className="plot-box" x={cx(i) - bw / 2} width={bw} y={y(b.q3)} height={Math.max(1, y(b.q1) - y(b.q3))} rx={4} />
            <line className="plot-median" x1={cx(i) - bw / 2} x2={cx(i) + bw / 2} y1={y(b.median)} y2={y(b.median)} />
            {b.outliers?.map((o, k) => <circle key={k} className="plot-out" cx={cx(i)} cy={y(o)} r={3} />)}
          </g>
        ))}
      </svg>
      <Hits box={{ left: L, top: T, width: W - L - R, height: H - T - B }} tips={items.map((b) => `${b.label}　最小 ${u(b.min)}・25% ${u(b.q1)}・中央値 ${u(b.median)}・75% ${u(b.q3)}・最大 ${u(b.max)}${b.outliers?.length ? `・外れ値 ${b.outliers.length}件` : ''}`)} />
      <SrTable head={['区分', '最小', '第1四分位', '中央値', '第3四分位', '最大', '外れ値']} rows={items.map((b) => [b.label, u(b.min), u(b.q1), u(b.median), u(b.q3), u(b.max), b.outliers?.length ? b.outliers.map(u).join('・') : '—'])} />
    </div>
    </ChartTooltip>
  )
}

// ---- 散布図 ----

export interface ScatterPoint {
  /** 吹き出しと読み上げの名前 */
  label?: string
  x: number
  y: number
  /** 点の大きさ（バブル）。1 つでもあれば面積で大きさを示す */
  size?: number
  /** 薄い点（比べる対象・その他） */
  muted?: boolean
}

/**
 * 散布図（2 つの量の関係）。size を渡すとバブル（面積が size に比例）。目盛りは 0 から、fit で値のある範囲に合わせる。
 * xLabel・yLabel は軸の名前（必ず書く）。点は半透明の 1 色で、重なりを濃さで見せる
 */
export function ScatterChart({ points, xLabel, yLabel, sizeLabel = '大きさ', xUnit = '', yUnit = '', sizeUnit = '', fit = false, height = 260 }: {
  points: ScatterPoint[]; xLabel: string; yLabel: string; sizeLabel?: string; xUnit?: string; yUnit?: string; sizeUnit?: string; fit?: boolean; height?: number
}) {
  const [ref, W] = useWidth()
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const xt = axisTicks(fit ? Math.min(...xs) : Math.min(0, ...xs), Math.max(fit ? -Infinity : 0, ...xs), 4)
  const yt = axisTicks(fit ? Math.min(...ys) : Math.min(0, ...ys), Math.max(fit ? -Infinity : 0, ...ys), 4)
  const bubble = points.some((p) => p.size != null)
  const maxSize = Math.max(1e-9, ...points.map((p) => p.size ?? 0))
  const H = height, L = 40, R = 16, T = 22, B = 36
  // 点が軸の名前・枠の端に重ならないよう、いちばん大きい点の半径だけ内側で描く
  const pad = bubble ? 20 : 6
  const x = (v: number) => L + pad + ((v - xt[0]) / (xt.at(-1)! - xt[0])) * (W - L - R - pad * 2)
  const y = (v: number) => T + pad + (1 - (v - yt[0]) / (yt.at(-1)! - yt[0])) * (H - T - B - pad * 2)
  const r = (p: ScatterPoint) => (bubble ? 3 + 17 * Math.sqrt(Math.max(0, p.size ?? 0) / maxSize) : 5)
  const tip = (p: ScatterPoint) => [p.label, `${xLabel} ${clean(p.x)}${xUnit}`, `${yLabel} ${clean(p.y)}${yUnit}`, ...(bubble ? [`${sizeLabel} ${valueText(p.size, sizeUnit)}`] : [])].filter(Boolean).join('　')
  // 大きい点を先に描き、小さい点が隠れないようにする
  const order = points.map((p, i) => ({ p, i })).sort((a, b) => r(b.p) - r(a.p))
  return (
    <ChartTooltip>
    <div className="plot" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${xLabel}と${yLabel}、${points.length}点`}>
        <YGrid ticks={yt} y={y} L={L} R={R} W={W} />
        {xt.map((v) => <text key={v} className="line-ax" x={x(v)} y={H - 20} textAnchor="middle">{tick(v)}</text>)}
        <text className="line-ax plot-axis-t" x={L - 6} y={11} textAnchor="start">{yLabel}{yUnit && `（${yUnit}）`}</text>
        <text className="line-ax plot-axis-t" x={W - R} y={H - 3} textAnchor="end">{xLabel}{xUnit && `（${xUnit}）`}</text>
      </svg>
      <div className="xy-pts">
        {order.map(({ p, i }) => <i key={i} className={`xy-pt${p.muted ? ' muted' : ''}${bubble ? ' bubble' : ''}`} style={{ left: x(p.x), top: y(p.y), '--d': `${r(p) * 2}px` } as CSSProperties} {...chartTip(tip(p))} />)}
      </div>
      <SrTable head={['名前', xLabel, yLabel, ...(bubble ? [sizeLabel] : [])]} rows={points.map((p, i) => [p.label ?? String(i + 1), `${clean(p.x)}${xUnit}`, `${clean(p.y)}${yUnit}`, ...(bubble ? [valueText(p.size, sizeUnit)] : [])])} />
    </div>
    </ChartTooltip>
  )
}

// ---- レーダー ----

export interface RadarSeries {
  label: string
  values: number[]
  /** 淡い線（比べる対象。前の期・平均など） */
  soft?: boolean
}

/** レーダー（項目ごとの数の釣り合い）。中心が 0、外周が max（省略時は最大値を切り上げた目盛り）。主な系列は --chart-1 の面、soft は淡い線 */
export function RadarChart({ axes, series, max, unit = '', height = 260 }: { axes: string[]; series: RadarSeries[]; max?: number; unit?: string; height?: number }) {
  const [ref, W] = useWidth()
  const top = max ?? axisTicks(0, Math.max(0, ...series.flatMap((s) => s.values)), 4).at(-1)!
  const H = height, cx = W / 2, cy = H / 2, R = Math.max(20, Math.min(W / 2 - 64, H / 2 - 24))
  const n = Math.max(3, axes.length)
  const at = (i: number, v: number) => {
    const a = (i / n) * Math.PI * 2, d = (Math.max(0, Math.min(v, top)) / top) * R
    return [cx + d * Math.sin(a), cy - d * Math.cos(a)] as const
  }
  const poly = (vs: number[]) => axes.map((_, i) => at(i, vs[i] ?? 0).map((c) => c.toFixed(1)).join(',')).join(' ')
  const ordered = [...series.filter((s) => s.soft), ...series.filter((s) => !s.soft)]
  return (
    <ChartTooltip>
    <div className="plot" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => `${s.label} ${axes.map((a, i) => `${a} ${valueText(s.values[i], unit)}`).join('・')}`).join('、')}>
        {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} className="line-grid plot-ring" points={poly(axes.map(() => top * f))} />)}
        {axes.map((_, i) => <line key={i} className="line-grid" x1={cx} y1={cy} x2={at(i, top)[0]} y2={at(i, top)[1]} />)}
        <text className="line-ax" x={cx + 5} y={cy - R + 14}>{tick(top)}</text>
        {ordered.map((s) => <polygon key={s.label} className={`plot-radar${s.soft ? ' soft' : ''}`} points={poly(s.values)} />)}
        {ordered.filter((s) => !s.soft).map((s) => axes.map((_, i) => <circle key={`${s.label}-${i}`} className="line-dot" cx={at(i, s.values[i] ?? 0)[0]} cy={at(i, s.values[i] ?? 0)[1]} r={3} />))}
        {/* 点の近くでも、項目名と同じ内訳を確認できる（キー操作は下の項目名から）。 */}
        <g aria-hidden="true">
          {series.map((s, k) => axes.map((a, i) => <circle key={`${k}-${i}`} className="radar-hit" cx={at(i, s.values[i] ?? 0)[0]} cy={at(i, s.values[i] ?? 0)[1]} r={10} data-chart-tip={[a, ...series.map((x) => `${series.length > 1 ? `${x.label} ` : ''}${valueText(x.values[i], unit)}`)].join('　')} />))}
        </g>
      </svg>
      <div className="radar-axes">
        {axes.map((a, i) => {
          const ang = (i / n) * Math.PI * 2, s = Math.sin(ang), c = Math.cos(ang)
          const side = Math.abs(s) < 0.2 ? 'mid' : s > 0 ? 'right' : 'left'
          return (
            <span key={i} className={`radar-l ${side}`} style={{ left: cx + (R + 10) * s, top: cy - (R + 10) * c - (c < -0.2 ? -8 : c > 0.2 ? 8 : 0) }} {...chartTip([a, ...series.map((x) => `${series.length > 1 ? `${x.label} ` : ''}${valueText(x.values[i], unit)}`)].join('　'))}>{a}</span>
          )
        })}
      </div>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, tone: s.soft ? 'soft' : '', kind: 'line' }))} />}
      <SrTable head={['項目', ...series.map((s) => s.label)]} rows={axes.map((a, i) => [a, ...series.map((s) => valueText(s.values[i], unit))])} />
    </div>
    </ChartTooltip>
  )
}

// ---- ヒートマップ ----

/**
 * 行と列の表の濃淡（曜日×時間帯の件数、週×曜日の活動など）。濃さは min〜max（省略時は値の範囲）で --chart-5 から --chart-1 へ。
 * null は値なし（薄い地）。values は行ごとの配列。showValues でセルに数を書く。square は正方形のセル（カレンダーの形）。
 * colEvery は列の名前を何列ごとに出すか。列が多ければ枠の中だけを横にスクロールする。corner は読み上げの表の左上の見出し（行の名前の列）
 */
export function HeatMap({ rows, cols, values, unit = '', min, max, scale, showValues = false, square = false, colEvery = 1, corner = '項目' }: {
  rows: string[]; cols: string[]; values: (number | null)[][]; unit?: string; min?: number; max?: number; scale?: [string, string]; showValues?: boolean; square?: boolean; colEvery?: number; corner?: string
}) {
  const nums = values.flat().filter((v): v is number => v != null && Number.isFinite(v))
  const lo = min ?? Math.min(0, ...nums), hi = max ?? Math.max(lo + 1e-9, ...nums)
  const ratio = (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)))
  return (
    <ChartTooltip>
    <div className="heatmap">
      <div className="hm-scroll">
        <div className={`hm-grid${square ? ' square' : ''}`} style={{ gridTemplateColumns: `max-content repeat(${cols.length}, ${square ? 'minmax(14px, 24px)' : 'minmax(28px, 1fr)'})` }}>
          <span />
          {cols.map((c, j) => <span key={j} className="hm-col">{j % colEvery === 0 ? c : ''}</span>)}
          {rows.map((r, i) => (
            <div className="hm-row" key={i}>
              <span className="hm-rl">{r}</span>
              {cols.map((c, j) => {
                const v = values[i]?.[j]
                const none = v == null || !Number.isFinite(v)
                return (
                  <span key={j} className={`hm-c${none ? ' none' : ''}${!none && ratio(v) > 0.55 ? ' dark' : ''}`} style={{ '--r': none ? 0 : ratio(v) } as CSSProperties} {...chartTip(`${r} ${c}　${valueText(v, unit)}`)}>
                    {showValues && !none && <span className="num">{clean(v)}</span>}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {scale && <div className="tm-scale"><span className="num">{scale[0]}</span><i /><span className="num">{scale[1]}</span></div>}
      <SrTable head={[corner, ...cols]} rows={rows.map((r, i) => [r, ...cols.map((_, j) => valueText(values[i]?.[j], unit))])} />
    </div>
    </ChartTooltip>
  )
}

// ---- 円 ----

export interface PieItem {
  label: string
  value: number
  /** 灰色で描く（「なし」「その他」など） */
  muted?: boolean
}

/** 円の区分（4 つまでを --chart-1〜4 で塗り、5 つ目からは rest の名前の灰色にまとめる）。share は全体に対する割合（0〜1） */
export function pieSlices(items: PieItem[], rest = 'その他') {
  const shown = items.filter((it) => it.value > 0)
  const colored = shown.filter((it) => !it.muted)
  const keep = colored.slice(0, 4)
  const folded = colored.slice(4).reduce((a, it) => a + it.value, 0)
  const list = [...keep.map((it, k) => ({ label: it.label, value: it.value, tone: `${k + 1}` })), ...shown.filter((it) => it.muted).map((it) => ({ label: it.label, value: it.value, tone: 'm' }))]
  if (folded) list.push({ label: rest, value: folded, tone: 'm' })
  const total = list.reduce((a, s) => a + s.value, 0)
  return list.map((s) => ({ ...s, share: total ? s.value / total : 0 }))
}

/** 扇形（角度は上から時計回りのラジアン。r0 > 0 でドーナツの輪）。1 周ぶんは半分ずつ描く（円弧は始点と終点が同じだと描けないため） */
function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) return arcPath(cx, cy, r0, r1, a0, a0 + Math.PI) + arcPath(cx, cy, r0, r1, a0 + Math.PI, a1)
  const p = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}` + (r0 > 0 ? `L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z` : `L${cx} ${cy}Z`)
}

/**
 * 円グラフ（全体に対する内訳）。donut は中央に合計（center で差し替え）を出す輪。区分は大きい順に渡す。
 * 4 区分までを主要色の濃淡で塗り、残りは「その他」の灰色にまとめる。横に名前・数・割合の凡例を並べ（読み上げもこれを読む）、
 * 区分か凡例にポインタを載せると、その区分を強調する
 */
export function PieChart({ items, donut = false, unit = '', center, centerLabel = '合計', rest = 'その他', size = 160 }: {
  items: PieItem[]; donut?: boolean; unit?: string; center?: ReactNode; centerLabel?: string; rest?: string; size?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const restoreFocus = () => {
    const legends = ref.current?.querySelectorAll('.pie-legend li')
    const i = legends ? [...legends].indexOf(document.activeElement!) : -1
    setOn(i < 0 ? null : i)
  }
  const [on, setOn] = useState<number | null>(null)
  const slices = pieSlices(items, rest)
  const total = slices.reduce((a, s) => a + s.value, 0)
  const c = size / 2, r1 = c - 2, r0 = donut ? r1 * 0.62 : 0
  let a = 0
  const pct = (s: number) => `${clean(Math.round(s * 1000) / 10)}%`
  return (
    <ChartTooltip>
    <div ref={ref} className={`pie${on !== null ? ' focus' : ''}`} onMouseLeave={restoreFocus} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOn(null) }}>
      <div className="pie-fig" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          {!total && <circle className="pie-empty" cx={c} cy={c} r={r1 - (r1 - r0) / 2} strokeWidth={donut ? r1 - r0 : r1} />}
          {slices.map((s, i) => {
            const a0 = a
            a += s.share * Math.PI * 2
            return <path key={i} className={`pie-s chart-f${s.tone}${on === i ? ' on' : ''}`} d={arcPath(c, c, r0, r1, a0, a)} data-chart-tip={`${s.label}　${clean(s.value)}${unit}　${pct(s.share)}`} onMouseEnter={() => setOn(i)} onMouseLeave={restoreFocus} />
          })}
        </svg>
        {donut && <span className="pie-c"><span className="num">{center ?? `${clean(total)}${unit}`}</span><small>{centerLabel}</small></span>}
      </div>
      <ul className="pie-legend">
        {slices.map((s, i) => (
          <li key={i} className={on === i ? 'on' : ''} {...chartTip(`${s.label}　${clean(s.value)}${unit}　${pct(s.share)}`)} role="listitem" onFocus={() => setOn(i)} onMouseEnter={() => setOn(i)} onMouseLeave={restoreFocus}>
            <i className={`sc-key ${s.tone === 'm' ? 'chart-muted' : `chart-c${s.tone}`}`} />
            <span className="pie-l">{s.label}</span>
            <span className="pie-v num">{clean(s.value)}{unit}</span>
            <span className="pie-p num">{pct(s.share)}</span>
          </li>
        ))}
      </ul>
    </div>
    </ChartTooltip>
  )
}

// ---- ゲージ ----

/**
 * 半円のゲージ（目標・上限に対する今の値。達成率・使用量など）。min〜max の弧を値まで --chart-1 で塗り、中央に値、
 * target は目標の目盛り。読み上げには meter として値・範囲を渡す。value が null は「—」
 */
export function Gauge({ value, label, min = 0, max = 100, unit = '', target, decimals = 0, size = 200 }: { value: number | null; label: string; min?: number; max?: number; unit?: string; target?: number; decimals?: number; size?: number }) {
  const W = size, sw = Math.max(10, size * 0.08), r = W / 2 - sw / 2 - 1, cx = W / 2, cy = r + sw / 2 + 1
  const H = cy + 2
  const f = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min || 1)))
  const pt = (t: number, rr: number) => [cx - rr * Math.cos(Math.PI * t), cy - rr * Math.sin(Math.PI * t)] as const
  const d = `M${pt(0, r).join(' ')}A${r} ${r} 0 0 1 ${pt(1, r).join(' ')}`
  const text = value === null ? '—' : value.toFixed(decimals)
  return (
    <ChartTooltip>
    {/* 値がないときは meter にしない（meter は今の値が必須のため）。「値なし」と読ませる */}
    <div className="gauge" {...chartTip(`${label}　${value === null ? '値なし' : `${text}${unit}`}　範囲 ${clean(min)}〜${clean(max)}${unit}${target != null ? `　目標 ${clean(target)}${unit}` : ''}`)} {...(value === null ? { role: 'img', 'aria-label': `${label} 値なし` } : { role: 'meter', 'aria-label': label, 'aria-valuemin': min, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-valuetext': `${text}${unit}${target != null ? `（目標 ${clean(target)}${unit}）` : ''}` })} style={{ width: W }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path className="gauge-track" d={d} strokeWidth={sw} />
        {value !== null && f(value) > 0 && <path className="gauge-fill" d={d} strokeWidth={sw} pathLength={100} strokeDasharray={`${f(value) * 100} 100`} />}
        {target != null && <line className="gauge-target" x1={pt(f(target), r - sw / 2 - 3)[0]} y1={pt(f(target), r - sw / 2 - 3)[1]} x2={pt(f(target), r + sw / 2 + 3)[0]} y2={pt(f(target), r + sw / 2 + 3)[1]} />}
      </svg>
      <span className="gauge-v num" aria-hidden="true">{text}{value !== null && unit && <small>{unit}</small>}</span>
      <span className="gauge-ends num" aria-hidden="true"><span>{clean(min)}</span><span>{clean(max)}</span></span>
    </div>
    </ChartTooltip>
  )
}
