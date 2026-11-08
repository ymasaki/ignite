// 計測の入口。実行場所の node_modules の状態（古い・壊れている）に左右されないよう、
// 管理下のファイルを一時ディレクトリへ写して依存を入れ直し、そこで計測する。
// この入口は Node 標準機能だけで動かす（依存が欠けていても起動できるように）。
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { root, trackedFiles, outputPath, temporary } from './common.mjs'

export const KINDS = ['analysis', 'coverage', 'benchmarks']

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args[0]} が失敗しました (${result.status ?? result.signal})`)
}

// 作業ツリーにある管理下のファイルを写す。未追跡のファイルと node_modules は写さない。
export function copyTracked(from, to) {
  for (const file of trackedFiles(from)) {
    const source = path.join(from, file)
    const stat = fs.lstatSync(source, { throwIfNoEntry: false })
    if (!stat) continue
    const target = path.join(to, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (stat.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(source), target)
    else fs.copyFileSync(source, target)
  }
  // 計測は Git の管理下一覧を対象にするので、写した先でも同じ一覧を作る。
  run('git', ['init', '-q'], { cwd: to })
  run('git', ['add', '-A'], { cwd: to })
}

export async function measure(kind, cwd = root) {
  if (!KINDS.includes(kind)) throw new Error(`計測の種類が不明です: ${kind}`)
  // 出力先が管理下のファイルでないことを、写す前の元の場所で確かめる。
  const output = outputPath()
  await temporary(async (temp) => {
    // 一時ディレクトリは macOS ではリンク経由になる。実体のパスで動かさないと、
    // 各計測の「直接起動されたときだけ動く」判定が外れて何も測らずに終わる。
    const dir = fs.realpathSync(temp)
    const work = path.join(dir, 'repo')
    const result = path.join(dir, 'result.json')
    copyTracked(cwd, work)
    // lock どおりに入れ直す。npm のキャッシュを優先し、無いものだけ取得する。
    run('npm', ['ci', '--include=dev', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'],
      { cwd: work, env: { ...process.env, npm_config_update_notifier: 'false' } })
    run(process.execPath, [path.join(work, `scripts/health/${kind}.mjs`)],
      { cwd: work, env: { ...process.env, DEVBOARD_HEALTH_OUTPUT: result } })
    // 結果が書かれていないまま成功扱いにしない。
    if (!fs.existsSync(result)) throw new Error(`${kind} の計測結果が出力されませんでした`)
    JSON.parse(fs.readFileSync(result, 'utf8'))
    fs.copyFileSync(result, output)
  })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await measure(process.argv[2])
