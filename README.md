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
| 更新の取り込み | `npx ignite upgrade` |

## 使い始める

[docs/adopting.md](docs/adopting.md) を見てください。Node.js 22.12.0 以上と、非公開の GitHub Packages を取得する認証設定が必要です。設定後、次のコマンドで部品とひな形を取り込めます。

```sh
npm install @ymasaki/ignite react react-dom @tabler/icons-react
npx ignite init --app
```

起動・監査に必要な開発依存の導入も含め、[採用手順](docs/adopting.md)に沿って進めてください。更新は `npm run ignite:upgrade`、規約だけの同期は `npm run ignite:sync` です。

## 開発

```sh
npm ci
npm run catalog        # 全部品を見るカタログ
bash scripts/test.sh   # 型・単体テスト・検査・監査・配布から更新までの通し確認
```

版の付け方と公開の手順は [docs/releasing.md](docs/releasing.md) にあります。

## DevBoard のコード品質

開発依存を含む `npm ci` で、固定版の計測用の道具も入ります。`devboard.json` の `health` に登録した次の命令は、ネット接続や対話なしで `DEVBOARD_HEALTH_OUTPUT` に JSON を出します。管理下のファイルは変更せず、途中の報告・キャッシュ・ビルドは一時ディレクトリで作って削除します。

```sh
DEVBOARD_HEALTH_OUTPUT=/tmp/ignite-analysis.json npm run health:analysis
DEVBOARD_HEALTH_OUTPUT=/tmp/ignite-coverage.json npm run health:coverage
DEVBOARD_HEALTH_OUTPUT=/tmp/ignite-benchmarks.json npm run health:benchmarks
```

解析とカバレッジの対象は `git ls-files` にある `src/`・`cli/`・`audit/` の TypeScript / TSX です。宣言ファイル・テスト・fixture・生成物を除きます。CSS・カタログ・テンプレート・開発用スクリプトは集計しません。

- 解析：ESLint・TypeScript パーサー・SonarJS の認知的複雑度を使い、分岐のない関数も 0 として載せます。トークンからコメントと空行を除いた行数を数え、jscpd のコメントを除くモードで 10 行以上のコピーを両側へ載せます。検査を無効にするコメントは記録しますが、複雑度の測定は無効にしません。
- カバレッジ：Vitest と V8 で `tests/` の単体テストを実行し、行カバレッジを集計します。未 import の本体も母数へ含め、テストが失敗したときは計測も失敗します。ブラウザの E2E 監査は含みません。
- 速さ：`ignite-v1` は検索キー生成と絞り込み 10,000 件、タイル配置 2,000 件、コード表示の字句分け 2,000 行を測ります。項目数や表示内容の増加で待ち時間が伸びる処理を選びました。入力生成とビルドを計測から外し、3 回のウォームアップ後、9 回の中央値を出します。処理やデータ量・反復条件を変えるときは `suite` も変えます。ブラウザ描画全体の速度ではありません。
