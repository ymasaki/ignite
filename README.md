<img src="docs/logo/ignite-icon.svg" alt="Ignite のロゴ" width="72" height="72">

# Ignite

Web アプリで同じ見た目・使い勝手・UX をそろえるデザインシステムです。デザインの決まり、React の UI 部品、決まりどおりかを確かめる監査を 1 つのパッケージで配ります。デスクトップアプリへの展開は次の段階です。

| 入っているもの | 場所 |
|---|---|
| デザインの決まり（原則・色・文字・余白・動き・文言・アクセシビリティ） | [DESIGN.md](DESIGN.md) |
| トークンと CSS（3 色のスキン、ライト／ダーク、表示の補助） | `@ymasaki/ignite/styles.css` |
| React の部品（アプリの枠、一覧、ダッシュボード、設定、グラフなど） | `@ymasaki/ignite` |
| ソースの検査 | `npx ignite check` |
| 描いた画面の監査（余白・文字・ホバー・コントラスト・axe-core） | `@ymasaki/ignite/audit` |
| AI エージェント向けの決まりと監査スキル | `npx ignite sync` |
| 更新の取り込み | `npx ignite upgrade ./vendor/次の版.tgz` |

## 使い始める

[docs/adopting.md](docs/adopting.md) を見てください。Node.js 22.12.0 以上を用意し、GitHub Release の固定版アーカイブを取得して、SHA256 と元コミットを確認します。相対 `vendor/` からの導入・初期化は採用手順に沿って進めてください。

更新時も [固定版の更新手順](docs/adopting.md#更新を取り込む)で次版のアーカイブを指定します。規約だけの同期は `npm run ignite:sync` です。

## 文書の案内

| 知りたいこと | 正本 |
|---|---|
| デザインの規約・部品と画面の型 | [DESIGN.md](DESIGN.md) |
| Ignite 自身の構成・変更箇所・確認の対応 | [ARCHITECTURE.md](https://github.com/ymasaki/ignite/blob/main/ARCHITECTURE.md)（開発リポジトリ） |
| 開発エージェントの作業ルール | [AGENTS.md](https://github.com/ymasaki/ignite/blob/main/AGENTS.md)（開発リポジトリ） |
| アプリへの導入・更新・監査の設定 | [採用手順](docs/adopting.md) |
| アプリ固有のテーマ・部品・監査の所有範囲 | [拡張ガイド](docs/extensions.md) |
| 版・配布・カタログの運用 | [公開手順](docs/releasing.md) |
| Ignite 開発時のカタログ監査・ロックの扱い | [カタログ監査](docs/catalog-audit.md) |
| 外部システムとの比較記録・残りの候補 | [比較](docs/coverage.md) |
| 版ごとの変更点と移行方法 | [CHANGELOG.md](CHANGELOG.md) |

## 開発

```sh
npm ci
npm run catalog -- --port 15222 --strictPort # worktree 用。空いているポートを選び、終了後に止める
bash scripts/test.sh   # 型・単体テスト・検査・監査・配布から更新までの通し確認
```

常用カタログの専用ポートは 5199 です。開発の確認方法は [構成と確認の対応](https://github.com/ymasaki/ignite/blob/main/ARCHITECTURE.md#変更と確認の対応)、監査の実行方法は [カタログ監査](docs/catalog-audit.md) を参照してください。

## DevBoard のコード品質

`devboard.json` の `health` に登録した次の命令は、対話なしで `DEVBOARD_HEALTH_OUTPUT` に JSON を出します。実行場所の `node_modules` が古い・欠けていても結果が変わらないよう、管理下のファイルを一時ディレクトリへ写し、`package-lock.json` どおりの固定版の道具を `npm ci --prefer-offline` で入れてから測ります（npm のキャッシュに無い版だけ取得します）。管理下のファイルと実行場所の `node_modules` は変更せず、途中の報告・キャッシュ・ビルドは一時ディレクトリで作って削除します。結果が出力されないときは失敗として終わります。

```sh
DEVBOARD_HEALTH_OUTPUT=/tmp/ignite-analysis.json npm run health:analysis
DEVBOARD_HEALTH_OUTPUT=/tmp/ignite-coverage.json npm run health:coverage
DEVBOARD_HEALTH_OUTPUT=/tmp/ignite-benchmarks.json npm run health:benchmarks
```

解析とカバレッジの対象は `git ls-files` にある `src/`・`cli/`・`audit/` の TypeScript / TSX です。宣言ファイル・テスト・fixture・生成物を除きます。CSS・カタログ・テンプレート・開発用スクリプトは集計しません。

- 解析：ESLint・TypeScript パーサー・SonarJS の認知的複雑度を使い、分岐のない関数も 0 として載せます。トークンからコメントと空行を除いた行数を数え、jscpd のコメントを除くモードで 10 行以上のコピーを両側へ載せます。検査を無効にするコメントは記録しますが、複雑度の測定は無効にしません。
- カバレッジ：Vitest と V8 で `tests/` の単体テストを実行し、行カバレッジを集計します。未 import の本体も母数へ含め、テストが失敗したときは計測も失敗します。ブラウザの E2E 監査は含みません。
- 速さ：`ignite-v1` は検索キー生成と絞り込み 10,000 件、タイル配置 2,000 件、コード表示の字句分け 2,000 行を測ります。項目数や表示内容の増加で待ち時間が伸びる処理を選びました。入力生成とビルドを計測から外し、3 回のウォームアップ後、9 回の中央値を出します。処理やデータ量・反復条件を変えるときは `suite` も変えます。ブラウザ描画全体の速度ではありません。
