# Ignite

アプリ共通のデザインシステム。決まりの正本は `DESIGN.md`、採用は `docs/adopting.md`、版と公開は `docs/releasing.md`、主要なデザインシステムとの比較と残りの候補は `docs/coverage.md`。

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
- 部品を足す・変えるときは `DESIGN.md` の表、`src/index.ts`、カタログを一緒に直す（`tests/coverage.test.ts` が載せ漏れを止める）。キー操作やフォーカスの動きがある部品は `catalog/e2e/parts.e2e.ts` にも足す。
- 測れる決まりを足したら、`cli/check.ts` か `audit/` にも足し、テストで違反を検出できることを確かめる。
- 利用者に影響する変更は `CHANGELOG.md` に書き、`docs/releasing.md` の基準で版を決める。
- 配布物だけに起きる不具合があるので、部品の土台を変えたら `npm run smoke` を通す。

## 確認

`bash scripts/test.sh`（型・単体テスト・ビルド・`ignite check`・カタログの監査・配布から更新までの通し確認）。

## カタログの運用

- WebDock登録名: `ignite-catalog`。通常登録はmainの作業場所を使う。
- URL: `http://ignite-catalog.localhost:18480/`
- 取り込み後の反映: `bash scripts/start-catalog.sh`（登録・再起動・HTTP確認）。
- 停止後の再開: `webdock start ignite-catalog`。停止: `webdock stop ignite-catalog`。
- 確認: `curl --fail --resolve ignite-catalog.localhost:18480:127.0.0.1 http://ignite-catalog.localhost:18480/`。
- worktreeの検証はmanifestの登録名を別名にした検証コピーで行い、通常登録を差し替えない。
