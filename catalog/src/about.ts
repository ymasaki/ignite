// 設定の画面の「このアプリについて」「開発者」「オープンソース ライセンス」に出す中身。
// バージョン履歴は CHANGELOG.md から作る（正本を 1 つにする）。見出しの区分は ReleasePanel の区分に寄せる
import type { Release, ReleaseCategory } from '@ymasaki/ignite'
import changelog from '../../CHANGELOG.md?raw'

const CATEGORY: Record<string, ReleaseCategory> = { 追加: 'added', 変更: 'improved', 破壊的変更: 'improved', 修正: 'fixed' }

/** 画面では書式を使わないので、コードの印とリンクの記法を外して文だけにする */
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').trim()

/** CHANGELOG.md の「## 版（日付）」「### 区分」「- 項目」を新しい順の履歴にする */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = []
  let category: ReleaseCategory | null = null
  let prefix = ''
  for (const line of md.split('\n')) {
    const version = line.match(/^## (\S+)（(\d{4}-\d{2}-\d{2})）\s*$/)
    if (version) {
      releases.push({ version: version[1], date: version[2], items: [] })
      category = null
      continue
    }
    const heading = line.match(/^### (.+?)\s*$/)
    if (heading) {
      category = CATEGORY[heading[1]] ?? null
      prefix = heading[1] === '破壊的変更' ? '破壊的変更: ' : ''
      continue
    }
    const current = releases[releases.length - 1]
    if (!current || !category) continue
    if (line.startsWith('- ')) current.items.push({ category, text: prefix + plain(line.slice(2)) })
    else if (/^\s+\S/.test(line) && current.items.length) current.items[current.items.length - 1].text += ` ${plain(line)}`
  }
  return releases
}

export const RELEASES = parseChangelog(changelog)
export const VERSION = RELEASES[0]?.version ?? ''

/** 開発者（クレジット） */
export const DEVELOPER = { name: 'Masaki Yamamoto', initial: 'M', github: 'ymasaki' }

// カタログの画面に組み込んで配っているオープンソースのライブラリ（peerDependencies のうち画面に入るもの）。
// 開発・ビルド・監査にだけ使うもの（Vite・TypeScript・Playwright など）は配っていないので載せない。
// 著作権の表記と本文は各パッケージの LICENSE と同じ（tests/about.test.ts が node_modules と突き合わせる）

export interface OssLicense {
  key: string
  name: string
  /** 何に使っているか */
  use: string
  license: 'MIT'
  copyright: string
  url: string
  /** node_modules の中のパッケージ名（react-dom に付いてくる scheduler も組み込まれる） */
  packages: string[]
}

export const OSS_LICENSES: OssLicense[] = [
  { key: 'react', name: 'React', use: '画面の描画', license: 'MIT', copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.', url: 'https://github.com/facebook/react', packages: ['react', 'react-dom', 'scheduler'] },
  { key: 'tabler-icons', name: 'Tabler Icons', use: 'アイコン', license: 'MIT', copyright: 'Copyright (c) 2020-2026 Paweł Kuna', url: 'https://github.com/tabler/tabler-icons', packages: ['@tabler/icons-react'] },
]

/** MIT License の本文（著作権の表記の後ろ） */
const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/** 画面に出す全文（ライセンスの名前・著作権の表記・本文）。段落の中の改行は空白にして、パネルの幅で折り返す */
export const licenseText = (l: OssLicense) => `MIT License\n\n${l.copyright}\n\n${MIT_TEXT.replace(/(?<!\n)\n(?!\n)/g, ' ')}`

/** 詳細パネルの id（URL の open）。バージョン履歴とライセンスを、一覧の詳細（p1 など）と分ける */
export const RELEASES_DETAIL = 'releases'
export const licenseDetail = (key: string) => `license-${key}`
