# Ignite の構成

Ignite 自身を変更するときの案内。デザインの規約は [DESIGN.md](DESIGN.md)、作業ルールは [AGENTS.md](AGENTS.md)、アプリへの組み込みは [採用手順](docs/adopting.md) を正本とする。プロジェクト概要と文書索引は [README.md](README.md) に置き、同じ内容の `PROJECT.md` は設けない。

## 責務と依存の向き

| 場所 | 持つもの | 境界 |
|---|---|---|
| `src/ui/`・`src/format/` | React の部品・配置計算・日付や検索の処理 | 業務の語・採用アプリのデータ型やコードを持たない |
| `src/styles/` | トークン・スキン・モード・部品の CSS | 読み順は `index.css`、層の規約は DESIGN 0 章 |
| `src/skin.ts`・`src/assist.ts`・`src/contrast.ts` | テーマ・表示の補助・コントラストの測定規則 | 部品と監査で共通の定義を使う |
| `cli/` | `init`・`check`・`sync`・`upgrade`・`version` | 採用アプリのソースや設定を扱う Node.js 用の入口 |
| `audit/` | Playwright・axe による描画の測定と集計 | 共通の定義を `src/` から読み、アプリは公開設定で測定を接続する |
| `templates/` | アプリのひな形・規約節・監査スキル・拡張例 | コピー後にアプリが持つものと、同期で更新するものを分ける |
| `catalog/` | 全部品の実例・操作テスト・共通監査の対象 | Vite の alias で `src/` を直接読む。パッケージには配布しない |
| `tests/`・`scripts/` | 単体テスト・ビルド・監査実行・配布検証 | 採用側の業務テストを持ち込まない |

採用アプリは Ignite の公開入口を使い、その上にテーマと固有部品・画面を重ねる。Ignite から採用アプリへは依存しない。詳細は [DESIGN 0 章](DESIGN.md#0-層とカスケード)、拡張の所有範囲は [拡張ガイド](docs/extensions.md) を参照する。

## 公開入口とビルド

公開入口と配布対象の定義は `package.json` の `exports`・`bin`・`files`。

| 使う入口 | 元ソース | 配布物 |
|---|---|---|
| `@ymasaki/ignite` | `src/index.ts` | `dist/index.js`・`dist/src/index.d.ts` |
| `@ymasaki/ignite/styles.css` | `src/styles/index.css` | import 順に展開した `dist/styles.css` |
| `@ymasaki/ignite/tokens.css` | `src/styles/tokens.css` | `dist/tokens.css` |
| `@ymasaki/ignite/audit` | `audit/index.ts` | `dist/audit.js`・`dist/audit/index.d.ts` |
| `ignite` | `cli/index.ts` | `dist/cli.js` |
| `@ymasaki/ignite/DESIGN.md`・`@ymasaki/ignite/package.json` | 同名ファイル | 規約と版・入口の定義 |

`npm run build` は `scripts/build.mjs` を実行する。JavaScript は esbuild、型定義は `tsconfig.build.json` による TypeScript、CSS は import の順を保った展開で作る。React・アイコン、監査の Playwright・axe は外部依存として残す。`prepack` も同じビルドを行う。

`dist/` とともに `DESIGN.md`・`CHANGELOG.md`・`docs/`・`templates/` を配る。README は npm が同梱する。AGENTS・CLAUDE・この文書は開発リポジトリ用で、配布対象に加えない。生成した `dist/`・`catalog-dist/`・検査結果・`releases/` は Git に追加しない。

## 同期するものとアプリが保つもの

- `init` はまだないひな形・設定を置く。既存のひな形・設定とスクリプト定義を保持し、規約の管理節・スキルは同期する。
- `sync` の正本は `templates/agent/`。`cli/sync.ts` が AGENTS（CLAUDE があればそれも）の管理節と、`.claude/skills/ignite-audit`・`.agents/skills/ignite-audit` を更新する。管理節の外は保つ。
- コピー後のアプリ・テーマ・監査設定・拡張例は採用側が保つ。更新の際にひな形全体をコピーし直さない。
- `upgrade` は依存更新後、新版の CLI に変更履歴の表示・同期・静的検査を渡す。vendor 運用ではアーカイブのパスを明示する。失敗時の扱いは [採用手順](docs/adopting.md#更新を確定する) を参照する。

## 変更と確認の対応

開発には Node.js 22.12.0 以上と `npm ci` を使う。必須の一括確認は `bash scripts/test.sh`（`devboard.json` の `workflow.test` と同じ）。途中の確認には次の対応を使い、一括確認の代わりにはしない。

| 変更 | 関連する確認 |
|---|---|
| 部品・トークン・公開 API | `npm run typecheck`、`npm test -- --maxWorkers=2`。`tests/coverage.test.ts` が DESIGN・公開入口・カタログの載せ漏れを検査する |
| キー操作・フォーカス・描画 | `catalog/e2e/parts.e2e.ts` とカタログ監査。例: `npm run audit:design -- --grep DatePicker` |
| 静的検査 | `tests/check.test.ts`・`tests/staged.test.ts` と、ビルド後の `npm run check:design` |
| 初期化・同期・更新 | `tests/cli.test.ts` と `npm run smoke` |
| 画面の測定・前後処理 | `tests/audit.test.ts`、`catalog/e2e/audit-extension.e2e.ts`、カタログ監査 |
| 監査の実行・配信・公開処理 | `node --test scripts/test-entry.test.mjs scripts/health.test.mjs scripts/audit-cache.test.mjs scripts/audit-runner.test.mjs scripts/serve-catalog.test.mjs scripts/release.test.mjs` |
| コード品質の計測 | `scripts/health/` の各コマンドが解析・行カバレッジ・計算の速さを測る。対象と実行方法は [README のコード品質](README.md#devboard-のコード品質)を正本とし、`scripts/health.test.mjs` で出力と失敗時の扱いを確認する |
| パッケージ・ひな形・ビルド | `npm run smoke`。実際に pack して、空環境への導入・同期・模擬次版への更新を確かめる |

一括確認は、スクリプトのテスト → 型 → 単体テスト → ビルド → 静的検査 → Chromium の準備 → カタログ監査 → smoke の順に実行する。単体テストは最大2 workerで実行し、各工程の時間・終了値と監査のロック待ち時間を出す。カタログ監査だけは同じ保存済み入力・環境での成功を24時間まで再利用できる。条件と強制再測定は [カタログ監査](docs/catalog-audit.md#同じ成功結果の再利用)を参照する。単体・型・ビルド・smoke は毎回実行する。カタログだけではパッケージのビルドや配布後の動作は確かめられない。

監査の実行入口・共通ロック・復旧時の確認は [カタログ監査](docs/catalog-audit.md)、開発用と常用カタログのポート・ビルド・起動は [公開手順](docs/releasing.md#ステージングとプロダクション) にまとめる。版の判断と配布方式も同文書を正本とする。
