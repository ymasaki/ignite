// 文書の検査（scripts/docs.mjs）が、決まりから外れた文書を一つずつ見つけ、整った文書を通すことを確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { anchors, buildIndex, checkDocs, report, writeIndex, LIMITS } from './docs.mjs'

const head = (when, date = '2026-01-01') => `<!-- 読むとき: ${when} -->\n<!-- 見直した日: ${date} -->\n`
/** 整った最小の文書一式を作り、overrides で 1 か所だけ崩す */
function project(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-docs-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const files = {
    '.gitignore': 'node_modules/\ngenerated/\n',
    'AGENTS.md': `# 作業\n\n${head('毎回')}\n## 文書を保つ\n\n[索引](docs/README.md)\n`,
    'DESIGN.md': `# 決まり\n\n${head('UI を作る前')}\n## 0. 層\n\n## 2. 色\n\n- [色](docs/design/color.md)\n`,
    'docs/design/color.md': `# 色\n\n${head('色を決めるとき')}\n## 2. 色\n\n### コントラスト\n\n[0 章](../../DESIGN.md#0-層) と \`src/value.ts\` と \`generated/out.json\`\n`,
    'CHANGELOG.md': '# 変更履歴\n\n<!-- 読むとき: 版の変更 -->\n',
    'docs/README.md': `# 索引\n\n<!-- 見直した日: 2026-01-01 -->\n\n<!-- 索引: -->\n<!-- /索引 -->\n`,
    'src/value.ts': '// DESIGN.md 2 章「コントラスト」\n',
    'templates/agent/rules.md': '`src/app-only.ts` はアプリのパス\n',
    ...overrides,
  }
  for (const [f, text] of Object.entries(files)) {
    if (text == null) continue
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.writeFileSync(path.join(root, f), text)
  }
  if (files['docs/README.md']?.includes('<!-- 索引: -->')) writeIndex(root)
  return root
}
const messages = (root) => checkDocs(root, { today: '2026-11-20' }).map((p) => `${p.file}:${p.line} ${p.message}`)
const fails = (t, overrides, pattern) => {
  const found = messages(project(t, overrides))
  assert.ok(found.some((m) => pattern.test(m)), `${pattern} が見つからない: ${JSON.stringify(found)}`)
}

test('整った文書は通る（テンプレートの採用アプリのパス・.gitignore の場所は見ない）', (t) => {
  assert.deepEqual(messages(project(t)), [])
})

test('大きさ・1 行の長さの上限を超えると止める。追記だけの記録は大きさを見ない', (t) => {
  fails(t, { 'docs/design/color.md': `# 色\n\n${head('色')}\n## 2. 色\n\n### コントラスト\n\n${'あ。\n'.repeat(LIMITS.default / 2)}` }, /color\.md:1 \d+ 字。上限 20000 字/)
  fails(t, { 'AGENTS.md': `# 作業\n\n${head('毎回')}\n${'い\n'.repeat(4100)}` }, /AGENTS\.md:1 \d+ 字。上限 8000 字/)
  fails(t, { 'docs/design/color.md': `# 色\n\n${head('色')}\n## 2. 色\n\n### コントラスト\n\n${'う'.repeat(LIMITS.line + 1)}\n` }, /color\.md:10 1 行が 1001 字/)
  assert.deepEqual(messages(project(t, { 'CHANGELOG.md': `# 変更履歴\n\n<!-- 読むとき: 版 -->\n${'え\n'.repeat(15000)}` })), [])
})

test('読むとき・見直した日がない、未来の日付なら止める', (t) => {
  fails(t, { 'docs/design/color.md': '# 色\n\n<!-- 見直した日: 2026-01-01 -->\n## 2. 色\n\n### コントラスト\n' }, /color\.md:1 冒頭に <!-- 読むとき/)
  fails(t, { 'docs/design/color.md': '# 色\n\n<!-- 読むとき: 色 -->\n## 2. 色\n\n### コントラスト\n' }, /color\.md:1 <!-- 見直した日/)
  fails(t, { 'docs/design/color.md': `# 色\n\n${head('色', '2026-12-01')}\n## 2. 色\n\n### コントラスト\n` }, /未来の日付/)
})

test('索引が文書の「読むとき」と合わなければ止める', (t) => {
  const root = project(t)
  fs.writeFileSync(path.join(root, 'docs/new.md'), `# 新しい文書\n\n${head('新しいとき')}`)
  assert.ok(messages(root).some((m) => /docs\/README\.md:1 索引が/.test(m)))
  writeIndex(root)
  assert.deepEqual(messages(root), [])
  assert.match(buildIndex(root), /\| \[docs\/new\.md\]\(new\.md\) \| 新しいとき \|/)
})

test('切れたリンク・ない節・ないパスを止める', (t) => {
  fails(t, { 'AGENTS.md': `# 作業\n\n${head('毎回')}\n[消えた](docs/gone.md)\n` }, /AGENTS\.md:6 リンク先 docs\/gone\.md がない/)
  fails(t, { 'AGENTS.md': `# 作業\n\n${head('毎回')}\n[節](DESIGN.md#9-文言)\n` }, /リンク先 DESIGN\.md#9-文言 の節がない/)
  fails(t, { 'AGENTS.md': `# 作業\n\n${head('毎回')}\n[節](https://github.com/ymasaki/ignite/blob/main/DESIGN.md#消えた節)\n` }, /の節がない/)
  fails(t, { 'AGENTS.md': `# 作業\n\n${head('毎回')}\n\`src/gone.ts\` を見る\n` }, /`src\/gone\.ts` がリポジトリにない/)
  // コードの囲みの中は見ない。パスの基準を宣言した文書はその場所からも探す
  assert.deepEqual(messages(project(t, { 'AGENTS.md': `# 作業\n\n${head('毎回')}\n\`\`\`\n[x](gone.md) \`src/gone.ts\`\n\`\`\`\n` })), [])
  assert.deepEqual(messages(project(t, { 'AGENTS.md': `# 作業\n\n${head('毎回')}<!-- パスの基準: templates/agent -->\n\`rules.md\` \`src/value.ts\`\n` })), [])
})

test('コードと文書からの「DESIGN.md N 章「節」」が実在しなければ止める', (t) => {
  fails(t, { 'src/value.ts': '// DESIGN.md 7 章\n' }, /src\/value\.ts:1 DESIGN\.md に 7 章がない/)
  fails(t, { 'src/value.ts': '// DESIGN.md 2 章「消えた節」\n' }, /DESIGN\.md 2 章に「消えた節」がない/)
})

test('見出しの錨は GitHub と同じ形で、重なれば番号を付ける', () => {
  assert.deepEqual([...anchors('# 0. 層とカスケード\n## `ignite check`（検査）\n## A b\n## A b\n```\n# 囲みの中\n```')], ['0-層とカスケード', 'ignite-check検査', 'a-b', 'a-b-1'])
})

test('見直しの一覧は見直した日の古い順で、記録は上限比を出さない', (t) => {
  const root = project(t, { 'DESIGN.md': `# 決まり\n\n${head('UI', '2025-01-01')}\n## 0. 層\n\n## 2. 色\n\n- [色](docs/design/color.md)\n` })
  const rows = report(root)
  assert.equal(rows[0].reviewed, null) // CHANGELOG（見直した日なし）
  assert.equal(rows[0].ratio, null)
  assert.equal(rows.find((r) => r.reviewed)?.file, 'DESIGN.md')
})
