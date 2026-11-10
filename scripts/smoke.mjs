// 配布から更新までを、実際のパッケージで確かめる。
// npm pack した今の版を新しいアプリに入れ → 検査と監査を通し → わざと違反を入れて止まることを確かめ → 次の版へ ignite upgrade して部品と決まりが届くことを確かめる。
// 引数 --skip-audit で、ブラウザを使う監査を省く。
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '..')
const skipAudit = process.argv.includes('--skip-audit')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-smoke-'))
let app = path.join(tmp, 'app')
const name = '@ymasaki/ignite'
const MARK = 'ignite-smoke-marker'

// macOS では npm・npx が起動直後のプロセス名の設定（LaunchServices）でまれに abort し、何も出さずに SIGABRT で止まる。
// コマンドの中身の失敗ではないので、出力なしの SIGABRT に限って 1 回だけやり直す。終了コードのある失敗はやり直さない。
const abortedSilently = (result) => result.signal === 'SIGABRT' && !result.stdout && !result.stderr
function spawnOnceMore(cmd, args, options) {
  const result = spawnSync(cmd, args, options)
  if (!abortedSilently(result)) return result
  console.log(`  （${cmd} ${args.join(' ')} が出力なしの SIGABRT で止まったため、1 回だけやり直します）`)
  return spawnSync(cmd, args, options)
}
function run(cmd, args, cwd = app) {
  const result = spawnOnceMore(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw Object.assign(new Error(`Command failed: ${cmd} ${args.join(' ')}（終了コード ${result.status}・シグナル ${result.signal}）\n${result.stderr}${result.stdout}`), { status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr })
  }
  return result.stdout
}
const attempt = (cmd, args, cwd = app) => spawnOnceMore(cmd, args, { cwd, encoding: 'utf8' })
const ok = (label) => console.log(`  ok: ${label}`)
function assert(cond, label, detail = '') {
  if (!cond) throw new Error(`NG: ${label}\n${detail}`)
  ok(label)
}
const read = (f) => fs.readFileSync(path.join(app, f), 'utf8')
const ignite = (...args) => attempt('npx', ['ignite', ...args])

function verifySampleAudit(label) {
  const file = path.join(app, 'src/ui/SampleRow.tsx')
  const original = read('src/ui/SampleRow.tsx')
  const broken = original.replace("? '準備済み'", "? '未設定'")
  assert(broken !== original, `${label}: 例の違反を作れる`)
  const args = ['run', 'ignite:audit', '--', '--grep', 'ホーム（PC）|決まりから外れたところがない']
  try {
    fs.writeFileSync(file, broken)
    const result = attempt('npm', args)
    const report = read('test-results-audit/report.md')
    assert(result.status === 1 && report.includes('| アプリの状態表示 | `.appx-state` | 準備済み | 未設定 |'), `${label}: サンプル固有の違反で失敗しレポートに載る`, result.stdout + result.stderr + report)
  } finally {
    fs.writeFileSync(file, original)
  }
  const corrected = attempt('npm', args)
  assert(corrected.status === 0 && !read('test-results-audit/report.md').includes('| アプリの状態表示 |'), `${label}: 正しい拡張に戻すと成功する`, corrected.stdout + corrected.stderr)
}

try {
  console.log('1. パッケージを作る')
  const pack = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', tmp, '--ignore-scripts'], repo))[0]
  const v1 = path.join(tmp, pack.filename)
  const files = pack.files.map((f) => f.path)
  const sampleFiles = files.filter((f) => f.startsWith('templates/extensions/')).map((f) => f.slice('templates/extensions/'.length))
  assert(sampleFiles.includes('src/ui/SampleRow.tsx') && sampleFiles.includes('e2e/extensions.ts') && files.includes('docs/extensions.md'), '拡張ガイドと実行例が配布される')
  for (const f of ['dist/index.js', 'dist/styles.css', 'dist/cli.js', 'dist/audit.js', 'dist/src/index.d.ts', 'DESIGN.md', 'CHANGELOG.md', 'templates/agent/rules.md', 'templates/app/src/app/App.tsx']) assert(files.includes(f), `${f} が入っている`)
  const manifest = JSON.parse(run('tar', ['xOf', v1, 'package/package.json'], tmp))
  const entries = (value) => typeof value === 'string' ? [value] : Object.values(value).flatMap(entries)
  for (const entry of entries({ exports: manifest.exports, main: manifest.main, types: manifest.types, bin: manifest.bin })) {
    assert(files.includes(entry.replace(/^\.\//, '')), `公開入口 ${entry} の実体が入っている`)
  }
  assert(!files.some((f) => f.startsWith('catalog/') || f.startsWith('src/') || f.startsWith('tests/')), 'カタログとテストが入っていない')

  console.log('2. 新しいアプリに入れる')
  fs.mkdirSync(app)
  fs.mkdirSync(path.join(app, 'vendor'))
  fs.copyFileSync(v1, path.join(app, 'vendor', pack.filename))
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'smoke-app', private: true, type: 'module' }))
  fs.writeFileSync(path.join(app, 'AGENTS.md'), '# アプリの決まり\n\nアプリ固有の決まり\n')
  run('npm', ['install', '--no-audit', '--no-fund', `./vendor/${pack.filename}`, 'react', 'react-dom', '@tabler/icons-react', 'vite', '@vitejs/plugin-react', 'typescript', '@types/react', '@types/react-dom', '@playwright/test', '@axe-core/playwright'])
  // 採用の手順（docs/adopting.md）どおり、入れた Playwright の版に合うブラウザを入れる。新しい版が出ても端末のブラウザとずれない
  if (!skipAudit) run('npx', ['playwright', 'install', 'chromium'])
  const init = ignite('init', '--app')
  assert(init.status === 0, 'ignite init --app が通る', init.stdout + init.stderr)
  fs.cpSync(path.join(app, 'node_modules', name, 'templates/extensions'), app, { recursive: true })
  const owned = new Map()
  for (const f of sampleFiles) {
    fs.appendFileSync(path.join(app, f), '\n/* アプリでカスタマイズした拡張。更新時に保持する */\n')
    owned.set(f, read(f))
  }
  const assertOwned = (label) => assert(sampleFiles.every((f) => read(f) === owned.get(f)), label)
  assert(read('AGENTS.md').includes('アプリ固有の決まり') && read('AGENTS.md').includes(`ignite:begin ${pack.version}`), 'AGENTS.md に Ignite の節が足され、元の文は残る')
  assert(fs.existsSync(path.join(app, '.claude/skills/ignite-audit/SKILL.md')), '監査のスキルが置かれる')
  const scripts = JSON.parse(read('package.json')).scripts
  assert(scripts['ignite:upgrade'] === 'ignite upgrade' && scripts['ignite:sync'] === 'ignite sync', '更新と同期の npm スクリプトが置かれる')
  scripts['ignite:upgrade'] = 'echo custom-upgrade'
  const custom = JSON.parse(read('package.json'))
  custom.scripts = scripts
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify(custom))
  assert(ignite('init', '--app').status === 0, 'init を再実行できる')
  assertOwned('init はコピー後にカスタマイズした拡張を上書きしない')
  assert(JSON.parse(read('package.json')).scripts['ignite:upgrade'] === 'echo custom-upgrade', '既存の更新スクリプトを保持する')

  // 配布された公開型と実行経路の両方を使って、採用側の拡張を接続する。
  const auditFile = path.join(app, 'e2e/ignite.audit.ts')
  fs.writeFileSync(auditFile, fs.readFileSync(auditFile, 'utf8').replace('defineIgniteAudit({', `
const extension: import('@ymasaki/ignite/audit').AuditScreen = {
  name: '拡張', path: '/',
  axe: {
    prepare: async (page) => { await page.evaluate(() => { document.body.dataset.axePrepared = 'yes' }) },
    restore: async (page) => {
      if (await page.locator('body').getAttribute('data-axe-prepared') !== 'yes') throw new Error('prepare did not run')
      await page.evaluate(() => { delete document.body.dataset.axePrepared })
    },
  },
  layout: { replace: [], measure: async (page) => {
    if (await page.locator('body').getAttribute('data-axe-prepared')) throw new Error('axe preparation leaked into layout')
    const enabled = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--smoke-extra-finding').trim() === 'yes')
    const findings: import('@ymasaki/ignite/audit').AuditFinding[] = enabled
      ? [{ rule: 'smoke-extra-rule', where: 'smoke-target', expected: '0', actual: '1' }]
      : []
    return findings
  } },
}
const panRegions: import('@ymasaki/ignite/audit').AuditPanRegion[] = [{ viewport: '.diagram-viewport', content: '.diagram-viewport > .diagram-content' }]
defineIgniteAudit({`).replace("panRegions: [{ viewport: '.diagram-viewport', content: '.diagram-viewport > .diagram-content' }]", 'panRegions').replace('screens: [', 'screens: [extension,'))
  owned.set('e2e/ignite.audit.ts', read('e2e/ignite.audit.ts'))

  // 別端末を模し、生成物・node_modules・npm キャッシュを引き継がず lockfile だけで復元する。
  const clean = path.join(tmp, 'clean-app')
  fs.cpSync(app, clean, { recursive: true, filter: (source) => !['node_modules', 'dist'].includes(path.basename(source)) })
  app = clean
  run('npm', ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(tmp, 'empty-cache')])
  ok('別ディレクトリ・空キャッシュからスクリプト無効で復元できる')
  run('node', ['--input-type=module', '-e', `
    import fs from 'node:fs';
    for (const entry of ['@ymasaki/ignite', '@ymasaki/ignite/audit', '@ymasaki/ignite/styles.css', '@ymasaki/ignite/tokens.css']) {
      if (!fs.existsSync(new URL(import.meta.resolve(entry)))) throw new Error(entry);
    }
    await import('@ymasaki/ignite');
    await import('@ymasaki/ignite/audit');
  `])
  ok('JS・監査・CSS の公開入口を解決し JS を読み込める')

  run('npx', ['tsc', '--noEmit'])
  ok('型が通る')
  run('npx', ['vite', 'build'])
  ok('ビルドできる')
  assert(ignite('check').status === 0, 'ignite check が通る')

  console.log('3. わざと違反を入れると検査が止める')
  const bad = path.join(app, 'src/app/Bad.tsx')
  const badCss = path.join(app, 'src/styles/bad.css')
  fs.writeFileSync(bad, 'export const Bad = () => <button style={{ color: "red" }}>押す</button>\n')
  fs.writeFileSync(badCss, '.x{color:#123456;font-size:15px;border-radius:7px}\n.btn{padding:0}\n.side{width:10px}\n@media (max-width:1000px){.y{padding:3px}}\n')
  const r = ignite('check')
  assert(r.status === 1, '違反で失敗する', r.stdout)
  for (const word of ['<button>', 'インラインの style', '色を直接書かない', '文字の大きさ', '角丸', '上書きしない', '枠の部品', '区切り']) assert(r.stdout.includes(word), `検出: ${word}`, r.stdout)
  fs.rmSync(bad)
  fs.rmSync(badCss)

  if (!skipAudit) {
    console.log('4. 描いた画面の監査')
    const audit = attempt('npm', ['run', 'ignite:audit'])
    assert(audit.status === 0, '監査が通る', audit.stdout.slice(-3000))
    if (process.env.IGNITE_SMOKE_ARTIFACTS) {
      fs.mkdirSync(process.env.IGNITE_SMOKE_ARTIFACTS, { recursive: true })
      const shot = fs.readdirSync(path.join(app, 'test-results-audit')).find((f) => /ホーム-PC\.png$/.test(f))
      assert(shot, '例の画面画像がある')
      fs.copyFileSync(path.join(app, 'test-results-audit', shot), path.join(process.env.IGNITE_SMOKE_ARTIFACTS, 'extension-sample.png'))
    }
    verifySampleAudit('更新前')
    const css = path.join(app, 'src/styles/app.css')
    const clean = fs.readFileSync(css, 'utf8')
    fs.writeFileSync(css, `${clean}.lscreen-n{font-size:15px}\n.board{border-radius:7px}\n`)
    const failed = attempt('npm', ['run', 'ignite:audit'])
    const report = read('test-results-audit/report.md')
    assert(failed.status !== 0 && report.includes('文字の大きさ') && report.includes('15px') && report.includes('角丸'), '描いた画面のずれを監査が見つける', report.slice(0, 1500))
    fs.writeFileSync(css, `${clean}\n:root{--smoke-extra-finding:yes}\n`)
    // 画面の測定と、記録した指摘で失敗させる集計テストを一緒に実行する。
    const extraArgs = ['run', 'ignite:audit', '--', '--grep', '拡張（PC）|決まりから外れたところがない']
    const extraFailed = attempt('npm', extraArgs)
    const extraReport = read('test-results-audit/report.md')
    assert(extraFailed.status === 1 && extraReport.includes('| smoke-extra-rule | `smoke-target` | 0 | 1 |'), '追加測定の違反で監査が失敗し、共通レポートに載る', extraFailed.stdout + extraFailed.stderr + extraReport)
    const originalAudit = read('e2e/ignite.audit.ts')
    fs.writeFileSync(path.join(app, 'e2e/ignite.audit.ts'), originalAudit.replace('defineIgniteAudit({', `defineIgniteAudit({
  exceptions: [{ match: /^smoke-extra-rule smoke-target 0 1$/, why: 'smokeで追加測定の例外処理を確かめる' }],`))
    const excepted = attempt('npm', extraArgs)
    const exceptedReport = read('test-results-audit/report.md')
    assert(excepted.status === 0 && !exceptedReport.includes('smoke-extra-rule'), '対応する例外で追加測定の指摘が除外され、監査が通る', excepted.stdout + excepted.stderr + exceptedReport)
    fs.writeFileSync(path.join(app, 'e2e/ignite.audit.ts'), originalAudit)
    fs.writeFileSync(css, clean)
  }

  const next = pack.version.replace(/^(\d+)\.(\d+)\..*$/, (_, a, b) => `${a}.${Number(b) + 1}.0`)
  console.log(`5. ${next} を作って ignite upgrade で取り込む`)
  const x = path.join(tmp, 'x')
  fs.mkdirSync(x)
  run('tar', ['xzf', v1, '-C', x], tmp)
  const p = path.join(x, 'package')
  const edit = (f, fn) => fs.writeFileSync(path.join(p, f), fn(fs.readFileSync(path.join(p, f), 'utf8')))
  edit('package.json', (s) => s.replace(`"version": "${pack.version}"`, `"version": "${next}"`))
  edit('dist/index.js', (s) => `${s}\nexport const smokeMarker = "${MARK}"\n`)
  edit('dist/src/index.d.ts', (s) => `${s}\nexport declare const smokeMarker: string;\n`)
  edit('dist/styles.css', (s) => `${s}\n:root{--${MARK}:1}\n`)
  edit('DESIGN.md', (s) => `${s}\n${MARK}\n`)
  edit('templates/agent/rules.md', (s) => `${s}- ${MARK}\n`)
  edit('CHANGELOG.md', (s) => s.replace(`## ${pack.version}`, `## ${next}（2026-11-01）\n\n### 追加\n\n- ${MARK} の変更\n\n## ${pack.version}`))
  const nextFile = `ignite-${next}.tgz`
  const v2 = path.join(app, 'vendor', nextFile)
  run('tar', ['czf', v2, '-C', x, 'package'], tmp)
  const up = ignite('upgrade', `./vendor/${nextFile}`)
  assert(up.status === 0, 'ignite upgrade が通る', up.stdout + up.stderr)
  assert(up.stdout.includes(`${pack.version} → ${next}`) && up.stdout.includes(`${MARK} の変更`), '入った変更が表示される', up.stdout)
  assert(JSON.parse(read(`node_modules/${name}/package.json`)).version === next, `部品が ${next} になる`)
  assert(read(`node_modules/${name}/DESIGN.md`).includes(MARK), 'デザインの定義が更新される')
  assert(read('AGENTS.md').includes(`ignite:begin ${next}`) && read('AGENTS.md').includes(MARK) && read('AGENTS.md').includes('アプリ固有の決まり'), 'AI の決まりが更新され、アプリの文は残る')
  assert(!read('AGENTS.md').includes(`ignite:begin ${pack.version}`), '古い節が残らない')
  assert(ignite('sync', '--check').status === 0, 'ignite sync --check が通る')
  assertOwned('upgrade と sync はカスタマイズしたテーマ・部品・固有監査を保持する')
  fs.writeFileSync(path.join(app, 'src/app/marker.ts'), `import { smokeMarker } from '${name}'\nconsole.log(smokeMarker)\n`)
  fs.appendFileSync(path.join(app, 'src/main.tsx'), "import './app/marker'\n")
  const updated = path.join(tmp, 'updated-app')
  fs.cpSync(app, updated, { recursive: true, filter: (source) => !['node_modules', 'dist'].includes(path.basename(source)) })
  app = updated
  run('npm', ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(tmp, 'updated-empty-cache')])
  run('npx', ['tsc', '--noEmit'])
  assert(ignite('sync', '--check').status === 0, '更新後も別ディレクトリ・空キャッシュで規約が一致する')
  run('npx', ['vite', 'build'])
  ok('相対vendorで更新したlockfileから空環境復元・型・ビルドが通る')
  const built = fs.readdirSync(path.join(app, 'dist/assets')).map((f) => fs.readFileSync(path.join(app, 'dist/assets', f), 'utf8')).join('')
  assert(built.includes(MARK), '更新した部品がビルドに入る')
  assert(ignite('check').status === 0, '更新後のサンプルも静的検査が通る')
  assertOwned('空環境で復元してもアプリ所有の拡張は同一')
  if (!skipAudit) verifySampleAudit('更新後')
  console.log('\nsmoke: すべて通過')
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
