// 文書の検査（エージェントが読み切れる大きさ・切れていないリンク・索引の漏れ・見直した日）。
// node scripts/docs.mjs            検査（問題があれば終了値 1）
// node scripts/docs.mjs --write    docs/README.md の索引を各文書の「読むとき」から作り直す
// node scripts/docs.mjs --report   大きさの上限比・最近 30 日の更新回数・見直した日の一覧
// --root <dir> で検査する場所を変える（コミット時はステージした内容の一時コピーを渡す）
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const LIMITS = { default: 20000, line: 1000, 'AGENTS.md': 8000, 'CLAUDE.md': 8000, 'ARCHITECTURE.md': 12000 }
/** 追記だけの記録。大きさの上限と見直した日を求めない */
export const RECORDS = new Set(['CHANGELOG.md'])
export const INDEX = 'docs/README.md'
/** 配布物に入らない文書（package.json の files の外） */
const DEV_ONLY = new Set(['AGENTS.md', 'ARCHITECTURE.md'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'catalog-dist', 'coverage', '.claude'])
/** 採用アプリへ同期する文書。中のパスは採用アプリのもので、Ignite の索引には載せない */
const isTemplate = (f) => f.startsWith('templates/')
/** コードのコメントから「DESIGN.md N 章」を拾う場所 */
const CODE_DIRS = ['src', 'cli', 'audit', 'catalog', 'scripts', 'templates', 'tests']
const CODE_EXT = /\.(ts|tsx|mjs|js|css|html|md)$/
const REPO_URL = 'https://github.com/ymasaki/ignite/blob/main/'
/** 文中の `パス` のうち、このリポジトリのファイルとして実在を確かめるもの */
const REPO_PATH = /^(?:src|cli|audit|scripts|docs|templates|catalog|tests)\/[\w./-]*[\w/]$/

/** .gitignore に「名前/」で書いた、実行時にできる場所（監査の結果など） */
function ignoredDirs(root) {
  const file = path.join(root, '.gitignore')
  return new Set(fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').flatMap((l) => l.match(/^([\w.-]+)\/$/)?.[1] ?? []) : [])
}

/** 管理下の文書とコードだけを集める（.gitignore の場所の生成物は読まない） */
function walk(root, dir = '', out = [], skip = new Set([...SKIP_DIRS, ...ignoredDirs(root)])) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name
    if (e.isDirectory()) { if (!skip.has(e.name)) walk(root, rel, out, skip) } else out.push(rel)
  }
  return out
}

/** コードの囲みを空行にした本文（行の数は保つ） */
function prose(text) {
  let inFence = false
  return text.split('\n').map((l) => {
    if (/^\s*(```|~~~)/.test(l)) { inFence = !inFence; return '' }
    return inFence ? '' : l
  })
}

/** GitHub と同じ見出しの錨（小文字・記号を除く・空白は -、重なれば -1, -2） */
export function anchors(text) {
  const seen = new Map()
  const out = new Set()
  for (const l of prose(text)) {
    const m = l.match(/^#{1,6}\s+(.*?)\s*#*\s*$/)
    if (!m) continue
    const base = m[1].replace(/`/g, '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-')
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.add(n ? `${base}-${n}` : base)
  }
  return out
}

const meta = (text, key) => text.match(new RegExp(`^<!-- ${key}: (.+?) -->$`, 'm'))?.[1]
const headings = (text) => prose(text).flatMap((l) => l.match(/^#{1,6}\s+(.*)$/)?.[1] ?? [])

export function listDocs(root) {
  return walk(root).filter((f) => f.endsWith('.md')).sort()
}
/** 索引に載せる文書（入口の CLAUDE.md・索引そのもの・テンプレートを除く） */
const indexed = (f) => !isTemplate(f) && f !== 'CLAUDE.md' && f !== INDEX

export function buildIndex(root) {
  const rows = listDocs(root).filter(indexed).map((f) => {
    const when = meta(fs.readFileSync(path.join(root, f), 'utf8'), '読むとき') ?? '（読むときが未記入）'
    // 配布物に入らない文書は、配布物の中でも辿れるよう開発リポジトリの URL にする
    const href = DEV_ONLY.has(f) ? REPO_URL + f : path.posix.relative('docs', f)
    return `| [${f}](${href})${DEV_ONLY.has(f) ? '（開発リポジトリ）' : ''} | ${when} |`
  })
  return ['<!-- 索引: node scripts/docs.mjs --write で各文書の「読むとき」から作る。手で直さない -->', '| 文書 | 読むとき |', '|---|---|', ...rows, '<!-- /索引 -->'].join('\n')
}
const INDEX_BLOCK = /<!-- 索引:[^\n]*-->\n[\s\S]*?<!-- \/索引 -->/

export function writeIndex(root) {
  const file = path.join(root, INDEX)
  const text = fs.readFileSync(file, 'utf8')
  if (!INDEX_BLOCK.test(text)) throw new Error(`${INDEX} に索引の印（<!-- 索引: … --> と <!-- /索引 -->）がない`)
  fs.writeFileSync(file, text.replace(INDEX_BLOCK, buildIndex(root)))
}

/** DESIGN.md の章ごとの文書（「## N.」の見出しを持つ文書）と本文 */
function chapters(root, texts) {
  const map = new Map()
  for (const [f, text] of texts) {
    if (f !== 'DESIGN.md' && !f.startsWith('docs/design/')) continue
    for (const h of headings(text)) {
      const n = h.match(/^(\d+)\.\s/)?.[1]
      if (n) map.set(n, (map.get(n) ?? '') + '\n' + text)
    }
  }
  return map
}

/** 端末の地域での今日（UTC では日本の朝が前日になる） */
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function checkDocs(root, { today = localDate() } = {}) {
  const problems = []
  const add = (file, line, message) => problems.push({ file, line, message })
  const docs = listDocs(root)
  const texts = new Map(docs.map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]))
  const ignored = ignoredDirs(root)
  const anchorCache = new Map()
  const anchorsOf = (f) => {
    if (!anchorCache.has(f)) anchorCache.set(f, anchors(texts.get(f) ?? fs.readFileSync(path.join(root, f), 'utf8')))
    return anchorCache.get(f)
  }

  for (const [f, text] of texts) {
    // 大きさと 1 行の長さ（1 回の読み取りに収める）
    const limit = LIMITS[f] ?? LIMITS.default
    if (!RECORDS.has(f) && text.length > limit) add(f, 1, `${text.length} 字。上限 ${limit} 字を超えている。領域で分ける`)
    text.split('\n').forEach((l, i) => { if (l.length > LIMITS.line) add(f, i + 1, `1 行が ${l.length} 字。上限 ${LIMITS.line} 字を超えている`) })

    // 読むときと見直した日
    if (indexed(f)) {
      if (!meta(text, '読むとき')) add(f, 1, '冒頭に <!-- 読むとき: … --> がない（索引に載らない）')
      if (!RECORDS.has(f)) {
        const date = meta(text, '見直した日')
        if (!date) add(f, 1, '<!-- 見直した日: YYYY-MM-DD --> がない')
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date > today) add(f, 1, `見直した日「${date}」が日付として読めないか、未来の日付`)
      }
    }

    // リンク（相対パスと開発リポジトリの URL）。ファイルと節が実在する
    const bases = (meta(text, 'パスの基準') ?? '').split(/\s+/).filter(Boolean)
    prose(text).forEach((l, i) => {
      for (const m of l.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        let target = m[1]
        let base = path.posix.dirname(f)
        if (target.startsWith(REPO_URL)) { target = target.slice(REPO_URL.length); base = '' } else if (/^[a-z][a-z+.-]*:/i.test(target)) continue
        const [file, hash] = target.split('#')
        const resolved = file ? path.posix.normalize(path.posix.join(base, decodeURIComponent(file))) : f
        if (resolved.startsWith('..') || !fs.existsSync(path.join(root, resolved))) { add(f, i + 1, `リンク先 ${m[1]} がない`); continue }
        if (hash && resolved.endsWith('.md') && !anchorsOf(resolved).has(decodeURIComponent(hash).toLowerCase())) add(f, i + 1, `リンク先 ${m[1]} の節がない`)
      }
      // 文中に書いたリポジトリのパスが実在する（採用アプリのパスを書くテンプレートは除く）。
      // <!-- パスの基準: templates/app … --> を書いた文書は、その場所からのパスとしても探す。実行時にできる場所（.gitignore）は見ない
      if (!isTemplate(f)) for (const m of l.matchAll(/`([^`\s]+)`/g)) {
        const p = m[1].replace(/[:#].*$/, '')
        if (!REPO_PATH.test(p) || p.includes('*') || p.split('/').some((s) => ignored.has(s))) continue
        if (!['', ...bases].some((b) => fs.existsSync(path.join(root, b, p)))) add(f, i + 1, `\`${m[1]}\` がリポジトリにない`)
      }
    })
  }

  // 索引の漏れ（生成結果と同じか）
  if (texts.has(INDEX)) {
    const block = texts.get(INDEX).match(INDEX_BLOCK)?.[0]
    if (block !== buildIndex(root)) add(INDEX, 1, '索引が各文書の「読むとき」と合わない。node scripts/docs.mjs --write で作り直す')
  } else add(INDEX, 1, '索引がない')

  // コードと文書からの「DESIGN.md N 章「節」」の参照が実在する
  const chap = chapters(root, texts)
  // 自己テストはわざと実在しない章・節を書くので除く
  const sources = walk(root).filter((f) => CODE_DIRS.some((d) => f.startsWith(`${d}/`)) && CODE_EXT.test(f) && f !== 'scripts/docs.test.mjs').concat(docs.filter((f) => !CODE_DIRS.some((d) => f.startsWith(`${d}/`))))
  for (const f of sources) {
    const text = texts.get(f) ?? fs.readFileSync(path.join(root, f), 'utf8')
    text.split('\n').forEach((l, i) => {
      for (const m of l.matchAll(/DESIGN\.md\s*の?\s*(\d+)\s*章(?:「([^」]+)」)?/g)) {
        const body = chap.get(m[1])
        if (!body) add(f, i + 1, `DESIGN.md に ${m[1]} 章がない`)
        else if (m[2] && !body.includes(m[2])) add(f, i + 1, `DESIGN.md ${m[1]} 章に「${m[2]}」がない`)
      }
    })
  }
  return problems
}

export function report(root, { now = Date.now() } = {}) {
  const since = new Date(now - 30 * 86400e3).toISOString().slice(0, 10)
  let counts = new Map()
  try {
    const log = execFileSync('git', ['log', `--since=${since}`, '--name-only', '--format='], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    for (const f of log.split('\n').filter(Boolean)) counts.set(f, (counts.get(f) ?? 0) + 1)
  } catch { counts = null }
  return listDocs(root).filter((f) => !isTemplate(f)).map((f) => {
    const text = fs.readFileSync(path.join(root, f), 'utf8')
    const limit = LIMITS[f] ?? LIMITS.default
    return { file: f, chars: text.length, ratio: RECORDS.has(f) ? null : text.length / limit, changes30d: counts ? counts.get(f) ?? 0 : null, reviewed: meta(text, '見直した日') ?? null }
  }).sort((a, b) => (a.reviewed ?? '').localeCompare(b.reviewed ?? '') || (b.ratio ?? 0) - (a.ratio ?? 0))
}

// 直接実行されたときだけ動く。シンボリックリンクを含むパス（macOS の /var など）でも同じ実体として比べる
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--root')
  const root = path.resolve(at >= 0 ? args[at + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
  if (args.includes('--write')) writeIndex(root)
  if (args.includes('--report')) {
    console.log('文書\t字数\t上限比\t30日の更新\t見直した日')
    for (const r of report(root)) console.log([r.file, r.chars, r.ratio == null ? '対象外' : `${Math.round(r.ratio * 100)}%`, r.changes30d ?? '不明', r.reviewed ?? 'なし'].join('\t'))
  } else {
    const problems = checkDocs(root)
    for (const p of problems) console.error(`${p.file}:${p.line} ${p.message}`)
    if (problems.length) {
      console.error(`[ignite-docs] ${problems.length} 件。決まりは AGENTS.md「文書を保つ」`)
      process.exitCode = 1
    } else console.log('[ignite-docs] 文書の検査を通過')
  }
}
