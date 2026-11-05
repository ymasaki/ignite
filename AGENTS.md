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
- 「プロダクションへ」は同じ版を別の中身で出さない。公開済みの版のあとの変更が配布物外のパス（`scripts/release.mjs` の `OUTSIDE_PACKAGE`: `devboard.json`・`AGENTS.md`・`CLAUDE.md`・`.github/`・公開スクリプト）だけなら版を据え置けるが、`docs/` を含むそれ以外を変えたら版を上げる。

## 確認

`bash scripts/test.sh`（型・単体テスト・ビルド・`ignite check`・カタログの監査・配布から更新までの通し確認）。

## カタログの運用

- #20 のオーナー指定により、カタログはWebDockを使わずスタンドアロンで起動する。
- URL: `http://localhost:5199/`。main取り込み後に `bash scripts/build-catalog.sh` で反映する。
- 起動: `bash scripts/start-catalog.sh`（停止まで動く。DevBoardのstaging.startから起動）。停止は起動元で行う。
- 確認: `curl --fail http://localhost:5199/`。専用ポートを固定し、競合時には停止する。
- worktreeの一時検証は別ポートを使い、終了後に必ず止める。
- 公開用のカタログは `https://ymasaki.github.io/ignite/`。GitHubのmainが更新されると `.github/workflows/pages.yml` が配信する（`docs/releasing.md` の「カタログの公開」）。
