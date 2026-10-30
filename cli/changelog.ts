// CHANGELOG.md から、更新で入った版の変更を取り出す
export interface Entry {
  version: string
  body: string
  breaking: boolean
}

const parts = (v: string) => v.split('.').map(Number)
export function compare(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

/** from より新しく to まで（新しい順）。見出しは「## 1.2.3（日付）」 */
export function entriesBetween(changelog: string, from: string, to: string): Entry[] {
  const out: Entry[] = []
  for (const sec of changelog.split(/^(?=## \d)/m).slice(1)) {
    const version = sec.match(/^## (\d+\.\d+\.\d+)/)?.[1]
    if (version && compare(version, from) > 0 && compare(version, to) <= 0) out.push({ version, body: sec.trim(), breaking: /^### 破壊的変更/m.test(sec) })
  }
  return out.sort((a, b) => compare(b.version, a.version))
}
