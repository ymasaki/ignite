// カタログの設定の画面に出す「このアプリについて」の中身が、正本（CHANGELOG.md・package.json・各パッケージの LICENSE）と合っていることを確かめる
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { licenseText, OSS_LICENSES, parseChangelog, RELEASES, VERSION } from '../catalog/src/about'

const root = path.resolve(import.meta.dirname, '..')
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8')
const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
const pkg = JSON.parse(read('package.json'))

describe('バージョン履歴（CHANGELOG.md から作る）', () => {
  const md = read('CHANGELOG.md')
  it('いまの版は package.json の版', () => expect(VERSION).toBe(pkg.version))
  it('すべての版を新しい順に載せる', () => {
    expect(RELEASES.map((r) => r.version)).toEqual([...md.matchAll(/^## (\S+)（/gm)].map((m) => m[1]))
  })
  it('すべての項目を載せ、空の版がない', () => {
    expect(RELEASES.flatMap((r) => r.items)).toHaveLength([...md.matchAll(/^- /gm)].length - [...md.slice(0, md.indexOf('\n## ')).matchAll(/^- /gm)].length)
    expect(RELEASES.filter((r) => r.items.length === 0)).toEqual([])
  })
  it('区分を読み替え、書式の記法を外す', () => {
    const r = parseChangelog('## 2.0.0（2026-12-01）\n\n### 追加\n\n- `Foo` を足した。[説明](docs/a.md)\n  続きの行\n\n### 破壊的変更\n\n- 名前を変えた\n\n### 修正\n\n- 直した\n')
    expect(r).toEqual([{ version: '2.0.0', date: '2026-12-01', items: [
      { category: 'added', text: 'Foo を足した。説明 続きの行' },
      { category: 'improved', text: '破壊的変更: 名前を変えた' },
      { category: 'fixed', text: '直した' },
    ] }])
  })
})

describe('オープンソースのライセンスの表記', () => {
  it('載せている全文が、各パッケージの LICENSE と同じ', () => {
    for (const l of OSS_LICENSES) for (const p of l.packages) {
      expect(squash(read(`node_modules/${p}/LICENSE`)), p).toBe(squash(licenseText(l)))
    }
  })
  it('画面に組み込む依存（必須の peerDependencies）をすべて載せている', () => {
    const optional = Object.keys(pkg.peerDependenciesMeta ?? {}).filter((d) => pkg.peerDependenciesMeta[d].optional)
    const deps = Object.keys(pkg.peerDependencies).filter((d) => !optional.includes(d))
    const listed = OSS_LICENSES.flatMap((l) => l.packages)
    expect(deps.filter((d) => !listed.includes(d))).toEqual([])
  })
})
