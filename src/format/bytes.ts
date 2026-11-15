// ファイルの大きさの表記（DESIGN.md 9 章）。1024 で割り、1000 以上になったら次の単位へ上げる（「1017KB」でなく「1MB」）。
// 10 未満は小数 1 桁（.0 は付けない）、10 以上は整数にする。
// 単位は数字に続けて書く（「3.4MB」。FileDrop の hint「10MB まで」と同じ書き方）

const UNITS = ['KB', 'MB', 'GB', 'TB']

/** バイト数を「820B」「12KB」「3.4MB」にする。負の数・数でない値は「—」 */
export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1000) return `${Math.round(bytes)}B`
  let v = bytes / 1024
  let u = 0
  // 丸めた結果が 1000 以上になるときも次の単位へ上げる（「1000KB」と書かない）
  while (u < UNITS.length - 1 && (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) >= 1000) {
    v /= 1024
    u += 1
  }
  const n = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10
  return `${n}${UNITS[u]}`
}
