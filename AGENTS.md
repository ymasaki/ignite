# Ignite

<!-- 読むとき: Ignite で作業を始めるとき必ず（作業ルール・確認の手順・文書の決まり） -->
<!-- 見直した日: 2026-11-20 -->

アプリ共通のデザインシステム。決まりの正本は `DESIGN.md`（入口。章の本文は `docs/design/`）、採用は `docs/adopting.md`、版と公開は `docs/releasing.md`、主要なデザインシステムとの比較と残りの候補は `docs/coverage.md`。

## 必要なときに読む文書

- 構成・公開入口・変更と確認の対応: [ARCHITECTURE.md](ARCHITECTURE.md)
- カタログの起動・配布・版の判断: [docs/releasing.md](docs/releasing.md)
- カタログ監査の入口・共通ロックの扱い: [docs/catalog-audit.md](docs/catalog-audit.md)
- どの文書をいつ読むか: [docs/README.md](docs/README.md)

## 決まり

- 応答・文書・コメントは日本語で書く。
- 外部の UI ライブラリ・CSS フレームワークを入れない。
- 部品を足す・変えるときは `docs/design/parts-*.md` の部品の表、`src/index.ts`、カタログを一緒に直す（`tests/coverage.test.ts` が載せ漏れを止める）。キー操作やフォーカスの動きがある部品は `catalog/e2e/parts.e2e.ts` にも足す。
- 測れる決まりを足したら、`cli/check.ts` か `audit/` にも足し、テストで違反を検出できることを確かめる。
- 利用者に影響する変更は `CHANGELOG.md` に書き、`docs/releasing.md` の基準で版を決める。
- 配布物だけに起きる不具合があるので、部品の土台を変えたら `npm run smoke` を通す。
- 本番の公開では同じ版を別の中身で出さない。公開済みの版のあとの変更が配布物外のパス（`scripts/release.mjs` の `OUTSIDE_PACKAGE`: 開発環境の設定・`AGENTS.md`・`CLAUDE.md`・`.github/`・公開スクリプト）だけなら版を据え置けるが、`docs/` を含むそれ以外を変えたら版を上げる。

## 確認

`bash scripts/setup.sh` で依存と共通の pre-commit を導入する（既存の別hook・`core.hooksPath` は上書きせず停止する）。コミット時は `bash scripts/test.sh --commit` でステージした内容の空白・型だけを一時コピーで検査し、取り込み時には全件を確認する。導入前の版のworktreeには新しい検査を強制しない。

`bash scripts/test.sh`（型・単体テスト・ビルド・`ignite check`・カタログの監査・配布から更新までの通し確認）。

- 検査は全件を基本とし、同じ保存済み入力・環境で成功したカタログ監査だけ24時間まで再利用する（条件は `docs/catalog-audit.md`）。`IGNITE_AUDIT_FRESH=1 bash scripts/test.sh` で必ず測り直す。工程別の秒数・終了値と監査のロック待ち秒数を出す。単体テストは最大2 workerとし、並列タスク間の負荷を抑える。
- 検査中は同じworktreeを編集せず、同じworktreeで検査を重ねない。別の作業は別タスクのworktreeで行う。
- 認識していない変更には触れない。ステージするのは変更したファイルの明示指定だけとし、`git add .` / `git add -A` は使わない。stashはworktree間で共有されるため、名前のないstash / popはしない。

## 文書を保つ

- 構成・公開入口・ビルドの流れを変えたら `ARCHITECTURE.md` も更新する。文書の役割や置き場所を変えたら README の案内も直す。
- 同じ規則や手順を書き写さず正本へリンクする。Ignite 自身の作業ルールはこの文書、採用アプリへ同期する規則は `templates/agent/` に置く。
- `CLAUDE.md` はこの文書を参照する入口として保つ。
- 文書は 1 回で読める大きさに保つ。上限は 1 文書 20000 字（この文書と `CLAUDE.md` は 8000 字、`ARCHITECTURE.md` は 12000 字）、1 行 1000 字。超えるなら領域で分ける。追記だけの記録（`CHANGELOG.md`）は大きさの対象外。
- 正本は今の仕組みを書き換えて保ち、経緯は `CHANGELOG.md` とコミットに残す。型・関数・ファイルは検索できる正確な名前で書き、行番号は書かない。
- 文書を足すときは冒頭に `<!-- 読むとき: … -->` と `<!-- 見直した日: YYYY-MM-DD -->` を書き、`node scripts/docs.mjs --write` で索引（`docs/README.md`）を作り直す。今のコードと照合して直したら見直した日を更新する。見直す順は `node scripts/docs.mjs --report`（見直した日の古い順・上限比・30 日の更新回数）で決める。
- `node scripts/docs.mjs` が大きさ・行の長さ・索引の漏れ・切れたリンクと節・実在しないパス・`DESIGN.md N 章「節」` の参照・見直した日を検査する（コミット時と `scripts/test.sh`）。
