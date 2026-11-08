// 監査のテストごとの記録。worker をまたいで集計できるよう、Playwright の outputDir の下にファイルで残す。
// outputDir は Playwright が実行の開始時に空にするので、前回の実行の記録は混ざらない。
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export type Finding = { rule: string; where: string; expected: string; actual: string }
export interface AuditRecord {
  findings: { key: string; screen: string; finding: Finding }[]
  shots: string[]
  hovered: [string, string][]
}
export interface AuditSummary {
  findings: (Finding & { count: number; screens: Set<string> })[]
  shots: string[]
  hovered: Map<string, string>
}

const READY = 'ready'
const VERDICT = 'verdict'
const id = (index: number) => String(index).padStart(5, '0')

export function recordsDir(outputDir: string): string {
  return path.join(outputDir, '.ignite-audit')
}

/**
 * 実行ごとに一度だけ、前回の画像とレポートを outDir から消す。最初に記録の置き場を作った worker が片付け、
 * ほかの worker は片付けが終わるまで待つ（並列でも、片付けの前に書いた画像を消さない）。
 */
export async function startRun(outDir: string, dir: string, timeout = 60000): Promise<void> {
  fs.mkdirSync(path.dirname(dir), { recursive: true })
  let claimed = false
  try {
    fs.mkdirSync(dir)
    claimed = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  const ready = path.join(dir, READY)
  if (claimed) {
    for (const name of fs.existsSync(outDir) ? fs.readdirSync(outDir) : []) {
      const file = path.join(outDir, name)
      // 記録の置き場（Playwright の outputDir を outDir の中に置いた場合も）は残す
      if (dir === file || dir.startsWith(file + path.sep)) continue
      fs.rmSync(file, { recursive: true, force: true })
    }
    fs.writeFileSync(ready, '')
    return
  }
  const deadline = Date.now() + timeout
  while (!fs.existsSync(ready)) {
    if (Date.now() >= deadline) throw new Error(`監査の前回の結果の片付けが ${timeout / 1000} 秒で終わりません: ${dir}`)
    await delay(50)
  }
}

/** 測定の開始を残す。判定は、終わっていない測定があれば集計しない */
export function markRunning(dir: string, index: number): void {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${id(index)}.running`), '')
}

export function writeRecord(dir: string, index: number, record: AuditRecord): void {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${id(index)}.json`)
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(record))
  fs.renameSync(`${file}.tmp`, file)
  fs.rmSync(path.join(dir, `${id(index)}.running`), { force: true })
}

/** 終わっていない測定の番号 */
export function runningRecords(dir: string): number[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((name) => name.endsWith('.running')).map((name) => Number(name.slice(0, -'.running'.length))).sort((a, b) => a - b)
}

/** テストを定義した順に集計する。worker の数や終わった順に関係なく、同じ記録から同じ結果を作る */
export function summarize(dir: string): AuditSummary {
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /^\d+\.json$/.test(name)).sort() : []
  const findings = new Map<string, Finding & { count: number; screens: Set<string> }>()
  const shots: string[] = []
  const hovered = new Map<string, string>()
  for (const name of names) {
    const record = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as AuditRecord
    for (const { key, screen, finding } of record.findings) {
      const cur = findings.get(key) ?? { ...finding, count: 0, screens: new Set<string>() }
      cur.count++
      cur.screens.add(screen)
      findings.set(key, cur)
    }
    shots.push(...record.shots)
    for (const [where, label] of record.hovered) hovered.set(where, hovered.get(where) || label)
  }
  return { findings: [...findings.values()], shots, hovered }
}

/** 判定が済んだ実行では、あとから終わった worker がレポートを書き直さない */
export function markVerdict(dir: string): void {
  fs.writeFileSync(path.join(dir, VERDICT), '')
}
export function hasVerdict(dir: string): boolean {
  return fs.existsSync(path.join(dir, VERDICT))
}

/** 書きかけのレポートを読まれないよう、置き換えで書く */
export function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, file)
}
