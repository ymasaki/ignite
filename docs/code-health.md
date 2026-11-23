# コード品質の計測

<!-- 読むとき: 本体のコードの解析・行カバレッジ・計算の速さを測る・計測の仕組みを直すとき -->
<!-- 見直した日: 2026-11-23 -->

次の命令は、対話なしで `IGNITE_HEALTH_OUTPUT` に JSON を出します。実行場所の `node_modules` が古い・欠けていても結果が変わらないよう、管理下のファイルを一時ディレクトリへ写し、`package-lock.json` どおりの固定版の道具を `npm ci --prefer-offline` で入れてから測ります（npm のキャッシュに無い版だけ取得します）。管理下のファイルと実行場所の `node_modules` は変更せず、途中の報告・キャッシュ・ビルドは一時ディレクトリで作って削除します。結果が出力されないときは失敗として終わります。

```sh
IGNITE_HEALTH_OUTPUT=/tmp/ignite-analysis.json npm run health:analysis
IGNITE_HEALTH_OUTPUT=/tmp/ignite-coverage.json npm run health:coverage
IGNITE_HEALTH_OUTPUT=/tmp/ignite-benchmarks.json npm run health:benchmarks
```

解析とカバレッジの対象は `git ls-files` にある `src/`・`cli/`・`audit/` の TypeScript / TSX です。宣言ファイル・テスト・fixture・生成物を除きます。CSS・カタログ・テンプレート・開発用スクリプトは集計しません。

- 解析：ESLint・TypeScript パーサー・SonarJS の認知的複雑度を使い、分岐のない関数も 0 として載せます。トークンからコメントと空行を除いた行数を数え、jscpd のコメントを除くモードで 10 行以上のコピーを両側へ載せます。検査を無効にするコメントは記録しますが、複雑度の測定は無効にしません。
- カバレッジ：Vitest と V8 で `tests/` の単体テストを実行し、行カバレッジを集計します。未 import の本体も母数へ含め、テストが失敗したときは計測も失敗します。ブラウザの E2E 監査は含みません。
- 速さ：`ignite-v2` は検索キー生成と絞り込み 10,000 件、10,000 件すべてに当たる入力の候補選び、タイル配置 2,000 件、コード表示の字句分け 2,000 行を測ります。項目数や表示内容の増加で待ち時間が伸びる処理を選びました。入力生成とビルドを計測から外し、3 回のウォームアップ後、9 回の中央値を出します。処理やデータ量・反復条件を変えるときは `suite` も変えます。ブラウザ描画全体の速度ではありません。
