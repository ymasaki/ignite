import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { root, sourceFiles, outputPath, writeOutput, temporary } from './common.mjs'

export async function measureCoverage(cwd = root) {
  return temporary(async (dir) => {
    const config = path.join(dir, 'vitest.config.mjs')
    // include は Git 管理下の全本体ファイル。未 import のファイルも未実行として母数に含む。
    fs.writeFileSync(config, `export default ${JSON.stringify({
      root: cwd, cacheDir: path.join(dir, 'cache'),
      test: {
        include: ['tests/**/*.test.{ts,tsx}'], watch: false, maxWorkers: 2,
        coverage: { enabled: true, provider: 'v8', include: sourceFiles(cwd),
          reporter: ['json-summary'], reportsDirectory: path.join(dir, 'coverage') },
      },
    })}\n`)
    const run = spawnSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config],
      { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } })
    if (run.error) throw run.error
    if (run.status !== 0) throw new Error(`カバレッジのテストが失敗しました (${run.status ?? run.signal})`)
    const summary = JSON.parse(fs.readFileSync(path.join(dir, 'coverage/coverage-summary.json'), 'utf8'))
    const { covered, total } = summary.total.lines
    if (!Number.isInteger(covered) || !Number.isInteger(total) || total <= 0 || covered < 0 || covered > total) {
      throw new Error('行カバレッジの値が不正です')
    }
    return { result: { coveredLines: covered, executableLines: total }, summary }
  })
}

async function main() {
  const output = outputPath()
  const { result } = await measureCoverage()
  writeOutput(output, result)
  console.log(`行カバレッジ: ${result.coveredLines} / ${result.executableLines}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
