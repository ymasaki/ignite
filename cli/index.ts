import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { entriesBetween } from './changelog'
import { main as check } from './check'
import { sync, type Pkg } from './sync'

const NAME = '@ymasaki/ignite'
const root = process.cwd()
const self: Pkg = (() => {
  const dir = path.resolve(import.meta.dirname, '..')
  return { dir, version: (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version: string }).version }
})()
const HELP = `ignite <command>

  init [--app]          採用に要るファイルを置く（--app は新しいアプリのひな形も置く）
  check [--staged]      ソースが DESIGN.md の決まりに沿っているかを検査する
  sync [--check]        AI エージェント向けの決まりを、入っている版にそろえる
  upgrade [版|パス]     Ignite を更新し、変更点を見せて、決まりをそろえ、検査する
  version               入っている版を出す`

const installed = (): string | null => {
  const f = path.join(root, 'node_modules', NAME, 'package.json')
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { version: string }).version : null
}

/** 置いていないファイルだけを置く（直したものを上書きしない） */
function place(fromDir: string, toDir: string, placed: string[]) {
  for (const e of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const from = path.join(fromDir, e.name), to = path.join(toDir, e.name)
    if (e.isDirectory()) place(from, to, placed)
    else if (!fs.existsSync(to)) {
      fs.mkdirSync(toDir, { recursive: true })
      fs.copyFileSync(from, to)
      placed.push(path.relative(root, to))
    }
  }
}

function init(args: string[]): number {
  const app = path.join(self.dir, 'templates/app')
  const placed: string[] = []
  if (args.includes('--app')) place(app, root, placed)
  else {
    place(path.join(app, 'e2e'), path.join(root, 'e2e'), placed)
    if (!fs.existsSync(path.join(root, 'playwright.ignite.config.ts'))) {
      fs.copyFileSync(path.join(app, 'playwright.ignite.config.ts'), path.join(root, 'playwright.ignite.config.ts'))
      placed.push('playwright.ignite.config.ts')
    }
  }
  const config = path.join(root, 'ignite.config.json')
  if (!fs.existsSync(config)) {
    fs.writeFileSync(config, `${JSON.stringify({ source: ['src'], screens: ['src/app'], parts: ['src/ui'], styles: ['src/styles'], themes: ['src/styles/theme.css'], forbiddenWords: [] }, null, 2)}\n`)
    placed.push('ignite.config.json')
  }
  const pj = path.join(root, 'package.json')
  if (fs.existsSync(pj)) {
    const pkg = JSON.parse(fs.readFileSync(pj, 'utf8')) as { scripts?: Record<string, string> }
    pkg.scripts = { 'ignite:sync': 'ignite sync', 'ignite:upgrade': 'ignite upgrade', 'ignite:check': 'ignite check', 'ignite:audit': 'playwright test -c playwright.ignite.config.ts', ...pkg.scripts }
    fs.writeFileSync(pj, `${JSON.stringify(pkg, null, 2)}\n`)
  }
  const synced = sync(root, self)
  for (const f of [...placed, ...synced]) console.log(`[ignite] 置いた: ${f}`)
  return 0
}

/** 更新の前の版が入っているまま動くので、新しい版の CLI に後の処理を渡す */
function upgrade(args: string[]): number {
  const from = installed()
  if (!from) {
    console.error(`[ignite] ${NAME} が入っていない。先に npm install ${NAME} を実行する`)
    return 1
  }
  const given = args.find((a) => !a.startsWith('--'))
  const spec = !given ? `${NAME}@latest` : /[/.]tgz$|^(github:|git\+|\.|\/)/.test(given) ? given : `${NAME}@${given}`
  const pm = fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ? ['pnpm', 'add'] : fs.existsSync(path.join(root, 'yarn.lock')) ? ['yarn', 'add'] : ['npm', 'install']
  console.log(`[ignite] ${from} を更新する: ${pm.join(' ')} ${spec}`)
  const r = spawnSync(pm[0], [pm[1], spec], { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) return r.status ?? 1
  return spawnSync(process.execPath, [path.join(root, 'node_modules', NAME, 'dist/cli.js'), 'after-upgrade', from], { cwd: root, stdio: 'inherit' }).status ?? 1
}

function afterUpgrade(from: string): number {
  const to = self.version
  const changelog = fs.readFileSync(path.join(self.dir, 'CHANGELOG.md'), 'utf8')
  const entries = entriesBetween(changelog, from, to)
  console.log(`\n[ignite] ${from} → ${to}\n`)
  for (const e of entries) console.log(`${e.body}\n`)
  const breaking = entries.filter((e) => e.breaking).map((e) => e.version)
  if (breaking.length) console.log(`[ignite] 破壊的変更あり: ${breaking.join('・')}。上の手順でアプリを直す\n`)
  for (const f of sync(root, self)) console.log(`[ignite] 更新した: ${f}`)
  const result = check(root, [])
  console.log('\n[ignite] 見た目の確認: npm run ignite:audit')
  return result
}

function syncCommand(args: string[]): number {
  const checking = args.includes('--check')
  const files = sync(root, self, checking)
  for (const f of files) console.log(`[ignite] ${checking ? '古い' : '更新した'}: ${f}`)
  if (checking && files.length) console.log('[ignite] npx ignite sync でそろえる')
  else if (!files.length) console.log(`[ignite] 決まりは ${self.version} にそろっている`)
  return checking && files.length ? 1 : 0
}

const [cmd, ...args] = process.argv.slice(2)
const commands: Record<string, () => number> = {
  init: () => init(args),
  check: () => check(root, args),
  sync: () => syncCommand(args),
  upgrade: () => upgrade(args),
  'after-upgrade': () => afterUpgrade(args[0]),
  version: () => (console.log(self.version), 0),
}
if (!cmd) console.log(HELP)
else if (commands[cmd]) process.exit(commands[cmd]())
else {
  console.error(HELP)
  process.exit(1)
}
