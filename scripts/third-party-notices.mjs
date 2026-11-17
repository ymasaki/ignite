// 配布物に同梱した外部パッケージの権利表記（THIRD_PARTY_LICENSES.txt）を作る。
// パッケージ（scripts/build.mjs）とカタログ（catalog/vite.config.ts）のビルドが、同梱したモジュールから毎回作り直す。
// 表記の同梱だけで義務を満たせるライセンス以外や、ライセンス文のない依存が混ざったらビルドを止める（判断は docs/releasing.md）。
import fs from 'node:fs'
import path from 'node:path'

export const NOTICES_FILE = 'THIRD_PARTY_LICENSES.txt'

// 著作権表示・ライセンス文・NOTICE を同梱すれば足りるもの。copyleft（GPL・LGPL・MPL など）は入れない。
const ALLOWED = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0', 'Zlib', 'BlueOak-1.0.0', 'CC0-1.0'])
// ビルド道具が差し込む補助コードは、node_modules の外の仮想モジュール（\0vite/... など）になる。
const VIRTUAL = { vite: 'vite', rolldown: 'rolldown' }

/** モジュールのIDから出どころのパッケージを返す。自前のソースは null。 */
export function packageOf(id, root) {
  const file = id.replaceAll('\\', '/')
  const found = [...file.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)].at(-1)
  if (found) return { name: found[1], dir: file.slice(0, found.index + found[0].length) }
  if (file.startsWith('\0')) {
    const name = VIRTUAL[file.slice(1).split('/')[0]]
    if (!name) throw new Error(`出どころの分からない仮想モジュールを同梱しています: ${JSON.stringify(id)}（scripts/third-party-notices.mjs の VIRTUAL に足してください）`)
    return { name, dir: path.join(root, 'node_modules', name) }
  }
  return null
}

/** 同梱したモジュールのID一覧から、パッケージごとの表記を集める。 */
export function collectNotices(ids, root) {
  const packages = new Map()
  for (const id of ids) {
    const found = packageOf(id, root)
    if (found && !packages.has(found.name)) packages.set(found.name, found.dir)
  }
  const problems = []
  const entries = [...packages].sort(([a], [b]) => a.localeCompare(b)).map(([name, dir]) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    const license = typeof manifest.license === 'string' ? manifest.license : manifest.license?.type ?? '(記載なし)'
    const files = fs.readdirSync(dir).filter(file => /^(licen[cs]e|copying|notice)([.-].*)?$/i.test(file)).sort()
    const texts = files.map(file => ({ file, text: fs.readFileSync(path.join(dir, file), 'utf8').trim() }))
    if (!ALLOWED.has(license)) problems.push(`${name}@${manifest.version}: ${license} は表記の同梱だけでは使えません`)
    if (!texts.some(({ file }) => !/^notice/i.test(file))) problems.push(`${name}@${manifest.version}: ライセンス文のファイルがありません`)
    return { name, version: manifest.version, license, texts }
  })
  if (problems.length) throw new Error(`配布物に同梱する外部パッケージの条件を確かめてください（docs/releasing.md の「外部パッケージの権利表記」）\n${problems.join('\n')}`)
  return entries
}

/** 集めた表記を1つの文書にする。 */
export function renderNotices(entries, product) {
  const head = `${product} は次の外部パッケージを同梱しています。各パッケージの著作権表示・ライセンス文・NOTICE を原文のまま載せます。\n`
  return [head, ...entries.map(entry => [
    '='.repeat(72),
    `${entry.name}@${entry.version}（${entry.license}）`,
    '='.repeat(72),
    ...entry.texts.map(({ file, text }) => `--- ${file} ---\n${text}\n`),
  ].join('\n'))].join('\n') + '\n'
}

/** カタログ（Vite）のビルドで THIRD_PARTY_LICENSES.txt を出し、HTML から rel="license" で指す。 */
export function thirdPartyNotices({ root, product }) {
  let base = '/'
  return {
    name: 'ignite-third-party-notices',
    apply: 'build',
    configResolved(config) { base = config.base },
    transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'license', href: `${base}${NOTICES_FILE}` }, injectTo: 'head' }],
    generateBundle(_, bundle) {
      const ids = Object.values(bundle).flatMap(item => item.type === 'chunk' ? Object.keys(item.modules) : [])
      this.emitFile({ type: 'asset', fileName: NOTICES_FILE, source: renderNotices(collectNotices(ids, root), product) })
    },
  }
}
