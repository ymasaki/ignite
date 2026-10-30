// 採用アプリの AI エージェント向けの決まり（AGENTS.md の Ignite の節と監査のスキル）を、入っている版の内容にそろえる（ignite sync）。
import fs from 'node:fs'
import path from 'node:path'

const BEGIN = /<!-- ignite:begin [^>]*-->[\s\S]*?<!-- ignite:end -->\n?/
const SKILL_DIRS = ['.claude/skills/ignite-audit', '.agents/skills/ignite-audit']

export interface Pkg {
  /** Ignite のパッケージの場所 */
  dir: string
  version: string
}

const block = (pkg: Pkg) => `<!-- ignite:begin ${pkg.version} -->\n${fs.readFileSync(path.join(pkg.dir, 'templates/agent/rules.md'), 'utf8').trimEnd()}\n<!-- ignite:end -->\n`

/** 書き換え後の中身。節が無ければ末尾に足す。節の外は変えない */
export function withBlock(text: string, section: string): string {
  if (BEGIN.test(text)) return text.replace(BEGIN, section)
  return text ? `${text.trimEnd()}\n\n${section}` : section
}

/** 直す先と、あるべき中身 */
function targets(root: string, pkg: Pkg): [string, string][] {
  const section = block(pkg)
  const read = (f: string) => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : '')
  const docs = ['AGENTS.md', ...(fs.existsSync(path.join(root, 'CLAUDE.md')) ? ['CLAUDE.md'] : [])]
  const skill = fs.readFileSync(path.join(pkg.dir, 'templates/agent/skills/ignite-audit/SKILL.md'), 'utf8')
  return [...docs.map((f): [string, string] => [f, withBlock(read(f), section)]), ...SKILL_DIRS.map((d): [string, string] => [`${d}/SKILL.md`, skill])]
}

/** check が true なら書かず、古いファイルを返す */
export function sync(root: string, pkg: Pkg, check = false): string[] {
  const stale = targets(root, pkg).filter(([f, want]) => !fs.existsSync(path.join(root, f)) || fs.readFileSync(path.join(root, f), 'utf8') !== want)
  if (!check) {
    for (const [f, want] of stale) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
      fs.writeFileSync(path.join(root, f), want)
    }
  }
  return stale.map(([f]) => f)
}
