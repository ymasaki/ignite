// 3 種類の計測で、本体の範囲と出力先をそろえる。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

export const root = path.resolve(import.meta.dirname, '../..')

export function trackedFiles(cwd = root) {
  return execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean)
}

export function isSource(file) {
  return /^(src|cli|audit)\/.+\.tsx?$/.test(file)
    && !/\.d\.ts$|\.(test|spec)\.tsx?$|(^|\/)(__tests__|fixtures|generated)\//.test(file)
}

export function sourceFiles(cwd = root) {
  const files = trackedFiles(cwd).filter(isSource).sort()
  if (!files.length) throw new Error('計測する本体コードがありません')
  return files
}

export function outputPath() {
  const file = process.env.DEVBOARD_HEALTH_OUTPUT
  if (!file) throw new Error('DEVBOARD_HEALTH_OUTPUT を指定してください')
  const output = path.resolve(file)
  const realOutput = fs.existsSync(output) ? fs.realpathSync(output) : output
  if (trackedFiles().some((name) => path.resolve(root, name) === realOutput)) {
    throw new Error('管理下のファイルは出力先にできません')
  }
  return output
}

export function writeOutput(file, result) {
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
}

export async function temporary(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-health-'))
  try { return await run(dir) }
  finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
