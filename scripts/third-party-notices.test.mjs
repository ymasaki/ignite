// 同梱したモジュールから権利表記を作り、表記だけでは足りない依存でビルドを止めることを、一時フォルダの仮パッケージで確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { packageOf, collectNotices, renderNotices, NOTICES_FILE } from './third-party-notices.mjs'

function fixture(t, packages) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-notices-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const [name, { license, files = {} }] of Object.entries(packages)) {
    const dir = path.join(root, 'node_modules', name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', license }))
    for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), text)
  }
  return { root, id: (name, file = 'index.js') => path.join(root, 'node_modules', name, file) }
}

test('出どころのパッケージを割り出す', () => {
  const root = '/repo'
  assert.equal(packageOf('/repo/src/ui/Button.tsx', root), null)
  assert.deepEqual(packageOf('/repo/node_modules/@tabler/icons-react/dist/esm/icons/IconX.mjs', root), { name: '@tabler/icons-react', dir: '/repo/node_modules/@tabler/icons-react' })
  // 入れ子の node_modules は内側のパッケージを指す
  assert.equal(packageOf('/repo/node_modules/a/node_modules/b/index.js', root).name, 'b')
  assert.deepEqual(packageOf('\0vite/modulepreload-polyfill.js', root), { name: 'vite', dir: path.join(root, 'node_modules', 'vite') })
  assert.equal(packageOf('\0rolldown/runtime.js', root).name, 'rolldown')
  assert.throws(() => packageOf('\0unknown-helper', root), /出どころの分からない仮想モジュール/)
})

test('ライセンス文と NOTICE を原文のまま名前順に載せる', t => {
  const { root, id } = fixture(t, {
    zeta: { license: 'MIT', files: { LICENSE: 'MIT License\nCopyright (c) Zeta' } },
    '@scope/alpha': { license: 'Apache-2.0', files: { 'LICENSE.txt': 'Apache License 2.0', NOTICE: 'Alpha NOTICE' } },
  })
  const entries = collectNotices([id('zeta'), id('zeta', 'other.js'), id('@scope/alpha'), path.join(root, 'src/own.ts')], root)
  assert.deepEqual(entries.map(entry => entry.name), ['@scope/alpha', 'zeta'])
  const text = renderNotices(entries, 'テスト')
  assert.match(text, /^テスト は次の外部パッケージを同梱しています/)
  assert.match(text, /@scope\/alpha@1\.0\.0（Apache-2\.0）[\s\S]*--- LICENSE\.txt ---\nApache License 2\.0[\s\S]*--- NOTICE ---\nAlpha NOTICE/)
  assert.match(text, /zeta@1\.0\.0（MIT）[\s\S]*Copyright \(c\) Zeta/)
  assert.equal(NOTICES_FILE, 'THIRD_PARTY_LICENSES.txt')
})

test('表記の同梱だけでは使えない依存とライセンス文のない依存でビルドを止める', t => {
  const { root, id } = fixture(t, {
    gpl: { license: 'GPL-3.0-only', files: { LICENSE: 'GPL' } },
    lgpl: { license: 'LGPL-3.0', files: { 'LICENSE.md': 'LGPL' } },
    bare: { license: 'MIT' },
    'notice-only': { license: 'Apache-2.0', files: { NOTICE: 'notice' } },
    ok: { license: 'ISC', files: { LICENSE: 'ISC' } },
  })
  assert.throws(() => collectNotices(['gpl', 'lgpl', 'bare', 'notice-only', 'ok'].map(name => id(name)), root), error => {
    assert.match(error.message, /gpl@1\.0\.0: GPL-3\.0-only は表記の同梱だけでは使えません/)
    assert.match(error.message, /lgpl@1\.0\.0: LGPL-3\.0/)
    assert.match(error.message, /bare@1\.0\.0: ライセンス文のファイルがありません/)
    assert.match(error.message, /notice-only@1\.0\.0: ライセンス文のファイルがありません/)
    assert.doesNotMatch(error.message, /ok@/)
    return true
  })
})
