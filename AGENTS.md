# Ignite

アプリ共通のデザインシステム。決まりの正本は `DESIGN.md`、採用は `docs/adopting.md`、版と公開は `docs/releasing.md`。

## 構成

- `src/`: 部品・トークン・CSS。業務の語やアプリのデータの形を持たない
- `cli/`: `ignite` の命令（検査・同期・更新）
- `audit/`: 描いた画面の監査（`@ymasaki/ignite/audit`）
- `templates/`: 採用アプリに置くファイル（AI エージェント向けの決まり・ひな形）
- `catalog/`: 全部品のカタログ。監査の対象でもある。配布しない
- `scripts/smoke.mjs`: 実際のパッケージで配布から更新までを確かめる

## 決まり

- 応答・文書・コメントは日本語で書く。
- 外部の UI ライブラリ・CSS フレームワークを入れない。
- 部品を足す・変えるときは `DESIGN.md` の表、`src/index.ts`、カタログを一緒に直す。
- 測れる決まりを足したら、`cli/check.ts` か `audit/` にも足し、テストで違反を検出できることを確かめる。
- 利用者に影響する変更は `CHANGELOG.md` に書き、`docs/releasing.md` の基準で版を決める。
- 配布物だけに起きる不具合があるので、部品の土台を変えたら `npm run smoke` を通す。

## 確認

`bash scripts/test.sh`（型・単体テスト・ビルド・`ignite check`・カタログの監査・配布から更新までの通し確認）。
