// 日付・時刻の表記（DESIGN.md 9 章「日付と時刻」）。画面に出す日付はすべてここを通す。
// 日本時間で表し、ゼロ埋めしない。今年の日付は年を省く。

const TZ = 'Asia/Tokyo'

type Parts = { y: number; m: number; d: number; h: number; min: number }

// 書式は作るのが重い（1 回で数十 µs）ので 1 つだけ作って使い回す（一覧で数百件の日付を出すため）
let fmt: Intl.DateTimeFormat | undefined

// 直前に分けた時刻（分の単位）。「今」は描くたびに new Date() で渡ってくるので、同じ分の間は分け直さない
let last: { min: number; p: Parts } | undefined

/** ISO 文字列（または Date）を日本時間の年・月・日・時・分に分ける。読めなければ null */
function parts(v: string | Date): Parts | null {
  const date = typeof v === 'string' ? new Date(v) : v
  // 日付だけの「2026-09-27」は UTC の 0 時（日本時間の 9 時）なので、日本時間でも UTC と同じ日付。書式を通さずに分ける
  // （「2026-02-30」のようにあふれた日付も Date が繰り上げた日付になる。書式を通したときと同じ）
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && date.getUTCFullYear() >= 1)
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), h: 9, min: 0 }
  const t = date.getTime()
  if (Number.isNaN(t)) return null
  // 日本時間は UTC との差が時間の単位なので、同じ分の中なら年・月・日・時・分は同じ
  const min = Math.floor(t / 60000)
  if (last?.min === min) return last.p
  fmt ??= new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
  const o = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const p = { y: Number(o.year), m: Number(o.month), d: Number(o.day), h: Number(o.hour), min: Number(o.minute) }
  last = { min, p }
  return p
}

/** 日付: 今年なら「9/27」、それ以外は「2025/9/27」 */
export function fmtDate(v: string | Date, now: Date = new Date()): string {
  const p = parts(v)
  if (!p) return ''
  const thisYear = parts(now)?.y
  return `${p.y === thisYear ? '' : `${p.y}/`}${p.m}/${p.d}`
}

/** 日時: 今年なら「9/27 8:03」、それ以外は「2025/9/27 8:03」 */
export function fmtDateTime(v: string | Date, now: Date = new Date()): string {
  const p = parts(v)
  if (!p) return ''
  return `${fmtDate(v, now)} ${p.h}:${String(p.min).padStart(2, '0')}`
}

/** 月（「2026-09」）: 「2026年9月」。月は並べて選ぶことが多いので、年はいつも付ける */
export function fmtMonth(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{1,2})$/)
  return m ? `${m[1]}年${Number(m[2])}月` : ym
}

/** その時点の状態を表すラベル: 「9/27時点」 */
export const fmtAsOf = (v: string | Date, now: Date = new Date()) => `${fmtDate(v, now)}時点`

/** 日本時間の日付（「2026-09-27」）。同期した時刻（UTC の ISO 文字列）から日付を作るときに使う（先頭 10 文字は UTC の日付で、日本時間の 0〜9 時は前の日になる）。読めなければ空 */
export function jstDate(v: string | Date): string {
  const p = parts(v)
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : ''
}

/** 日本時間の今月（「2026-09」） */
export function thisMonth(now: Date = new Date()): string {
  const p = parts(now)!
  return `${p.y}-${String(p.m).padStart(2, '0')}`
}
