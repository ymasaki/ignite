// 配布から更新までを、実際のパッケージで確かめる。
// npm pack した今の版を新しいアプリに入れ → 検査と監査を通し → わざと違反を入れて止まることを確かめ → 次の版へ ignite upgrade して部品と決まりが届くことを確かめる。
// 引数 --skip-audit で、ブラウザを使う監査を省く。
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '..')
const skipAudit = process.argv.includes('--skip-audit')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-smoke-'))
let app = path.join(tmp, 'app')
const name = '@ymasaki/ignite'
const MARK = 'ignite-smoke-marker'

const run = (cmd, args, cwd = app) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const attempt = (cmd, args, cwd = app) => spawnSync(cmd, args, { cwd, encoding: 'utf8' })
const ok = (label) => console.log(`  ok: ${label}`)
function assert(cond, label, detail = '') {
  if (!cond) throw new Error(`NG: ${label}\n${detail}`)
  ok(label)
}
const read = (f) => fs.readFileSync(path.join(app, f), 'utf8')
const ignite = (...args) => attempt('npx', ['ignite', ...args])

try {
  console.log('1. パッケージを作る')
  const pack = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', tmp, '--ignore-scripts'], repo))[0]
  const v1 = path.join(tmp, pack.filename)
  const files = pack.files.map((f) => f.path)
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
  const init = ignite('init', '--app')
  assert(init.status === 0, 'ignite init --app が通る', init.stdout + init.stderr)
  assert(read('AGENTS.md').includes('アプリ固有の決まり') && read('AGENTS.md').includes(`ignite:begin ${pack.version}`), 'AGENTS.md に Ignite の節が足され、元の文は残る')
  assert(fs.existsSync(path.join(app, '.claude/skills/ignite-audit/SKILL.md')), '監査のスキルが置かれる')
  const scripts = JSON.parse(read('package.json')).scripts
  assert(scripts['ignite:upgrade'] === 'ignite upgrade' && scripts['ignite:sync'] === 'ignite sync', '更新と同期の npm スクリプトが置かれる')
  scripts['ignite:upgrade'] = 'echo custom-upgrade'
  const custom = JSON.parse(read('package.json'))
  custom.scripts = scripts
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify(custom))
  assert(ignite('init', '--app').status === 0, 'init を再実行できる')
  assert(JSON.parse(read('package.json')).scripts['ignite:upgrade'] === 'echo custom-upgrade', '既存の更新スクリプトを保持する')

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
    const css = path.join(app, 'src/styles/app.css')
    const clean = fs.readFileSync(css, 'utf8')
    fs.writeFileSync(css, `${clean}.lscreen-n{font-size:15px}\n.board{border-radius:7px}\n`)
    const failed = attempt('npm', ['run', 'ignite:audit'])
    const report = read('test-results-audit/report.md')
    assert(failed.status !== 0 && report.includes('文字の大きさ') && report.includes('15px') && report.includes('角丸'), '描いた画面のずれを監査が見つける', report.slice(0, 1500))
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
  console.log('\nsmoke: すべて通過')
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
