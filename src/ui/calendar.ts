// カレンダーの計算。日付は「2026-09-27」の文字列のまま扱う（端末の時間帯で日付がずれないように、UTC で数える）。

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const toIso = (d: Date) => d.toISOString().slice(0, 10)

/** n 日後 */
export const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * 86400000))

/** n か月後の同じ日（月末は丸める。1/31 の 1 か月後は 2/28） */
export function addMonths(iso: string, n: number): string {
  const d = toDate(iso)
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d.getUTCDate(), last))
  return toIso(first)
}

/** 曜日（0 が日曜） */
export const weekday = (iso: string) => toDate(iso).getUTCDay()

/** 月（「2026-09」）を含む 6 週 42 日。段の数を変えない（送るたびにカレンダーの高さが変わらないように）。weekStart は週の始まり（0 が日曜） */
export function monthGrid(ym: string, weekStart = 0): string[] {
  const first = `${ym}-01`
  const start = addDays(first, -((weekday(first) - weekStart + 7) % 7))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
