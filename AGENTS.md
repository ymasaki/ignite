# Ignite

アプリ共通のデザインシステム。決まりの正本は `DESIGN.md`、採用は `docs/adopting.md`、版と公開は `docs/releasing.md`、主要なデザインシステムとの比較と残りの候補は `docs/coverage.md`。

## 必要なときに読む文書

- 構成・公開入口・変更と確認の対応: [ARCHITECTURE.md](ARCHITECTURE.md)
- カタログの起動・配布・版の判断: [docs/releasing.md](docs/releasing.md)
- カタログ監査の入口・共通ロックの扱い: [docs/catalog-audit.md](docs/catalog-audit.md)
- 文書全体の案内: [README.md](README.md#文書の案内)

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

- 検査は全件を基本とし、同じ保存済み入力・環境で成功したカタログ監査だけ24時間まで再利用する（条件は `docs/catalog-audit.md`）。`IGNITE_AUDIT_FRESH=1 bash scripts/test.sh` で必ず測り直す。工程別の秒数・終了値と監査のロック待ち秒数を出す。単体テストは最大2 workerとし、並列タスク間の負荷を抑える。
- 検査中は同じworktreeを編集せず、同じworktreeで検査を重ねない。別の作業は別タスクのworktreeで行う。
- 認識していない変更には触れない。ステージするのは変更したファイルの明示指定だけとし、`git add .` / `git add -A` は使わない。stashはworktree間で共有されるため、名前のないstash / popはしない。

## 文書を保つ

- 構成・公開入口・ビルドの流れを変えたら `ARCHITECTURE.md` も更新する。文書の役割や置き場所を変えたら README の案内も直す。
- 同じ規則や手順を書き写さず正本へリンクする。Ignite 自身の作業ルールはこの文書、採用アプリへ同期する規則は `templates/agent/` に置く。
- `CLAUDE.md` はこの文書を参照する入口として保つ。
