# Ignite を採用する

Node.js 22.12.0 以上を使います。以下の `npx ignite` は、導入済みの Ignite の CLI を実行します。

## 1. 取得の設定

Ignite は GitHub Packages の Private パッケージとして配ります。アプリのリポジトリの `.npmrc` に次を書き、パッケージへのアクセス権と `read:packages` の権限を持つ Personal access token (classic)を環境変数 `GITHUB_TOKEN` に入れます（トークンをコミットしない）。

```
@ymasaki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## 2. 入れる

```sh
npm install @ymasaki/ignite react react-dom @tabler/icons-react
npm install -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

`init --app` のひな形を起動・ビルドする場合は、開発依存も入れます。

```sh
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

新しいアプリは `npx ignite init --app`、既存のアプリは `npx ignite init` を実行します。どちらも、置いてあるファイルは上書きしません。

| 置かれるもの | 役割 |
|---|---|
| `ignite.config.json` | ソースの検査の設定 |
| `e2e/ignite.audit.ts` | 監査する画面の一覧 |
| `playwright.ignite.config.ts` | 監査の実行の設定。ポート 5317 を使う |
| `AGENTS.md` の Ignite の節（`CLAUDE.md` があればそこにも） | AI エージェント向けの決まり |
| `.claude/skills/ignite-audit`・`.agents/skills/ignite-audit` | 監査のスキル |
| `package.json` の `ignite:check`・`ignite:audit`・`ignite:sync`・`ignite:upgrade` | 実行の入口 |

## 3. アプリに組み込む（既存のアプリ）

1. 入口で `import '@ymasaki/ignite/styles.css'` を読み、その後にアプリのテーマと CSS を読みます。
2. 起動時に `startTheme(URL のパラメータ)` と `startAssist()` を呼びます。
3. `index.html` の `<body>` の先頭に、最初の描画からテーマを当てるスクリプトを置きます（`node_modules/@ymasaki/ignite/templates/app/index.html` からコピー）。
4. 画面を `AppShell` で組み、内容は `Board`（一覧は中に `ListScreen`）、`DashboardScreen`、`SettingsScreen` に置きます。設定の画面には `ThemeSettings` と `AssistSettings` を置きます。

組み方の見本は `node_modules/@ymasaki/ignite/templates/app/src/app/App.tsx` です。

## 4. アプリの構成に合わせる

`ignite.config.json`（パスはファイルかフォルダ）:

| 項目 | 意味 |
|---|---|
| `source` | 検査するフォルダ |
| `screens` | 画面。素の要素・インラインの style・長い文言を止める |
| `parts` | アプリの部品。長い文言を止める |
| `styles` / `themes` | CSS / トークンの定義（色を書いてよい） |
| `ignore` | ダミーデータなど検査しないもの |
| `forbiddenWords` | 画面に直書きしない語（`pattern`・`message`・`allow`）。会社に依存する語など |
| `maxText` | 文言の上限（既定 32） |

`e2e/ignite.audit.ts` には画面を足していきます。

```ts
defineIgniteAudit({
  screens: [{ name: '一覧', path: '/' }, { name: '詳細', path: '/?open=1', act: async (page) => { /* 操作 */ } }],
  states: [],        // 操作の前後で箱がずれないことを測る
  reveals: [],       // 重ねた詳細の中の操作の結果が見えることを測る
  rows: [], overflow: [], bars: [], frames: [],  // アプリの部品の分の測定対象
  contrastRules: [], // アプリのトークンの組
  exceptions: [],    // 文書に書いた例外
})
```

監査の画面は `?skin=` と `?mode=` を URL で受けられるようにします（`startTheme` に URL のパラメータを渡せば受けられます）。`nav` などの画面の状態も URL で開けるようにすると、監査に載せやすくなります。

## 5. 確かめる

```sh
npx ignite check        # ソースの検査。pre-commit では --staged
npm run ignite:audit    # 描いた画面の監査。結果は test-results-audit/report.md
```

## 更新を取り込む

```sh
npm run ignite:upgrade       # 最新へ。major の更新も含む
# npm run ignite:upgrade -- 1.2.0 で版を指定できる
npm run ignite:audit         # 見た目の確認
```

`ignite upgrade` は次を行います。

1. パッケージを更新する（部品・トークン・`DESIGN.md`・検査・監査がまとめて新しくなる）
2. 取り込んだ版の変更点を表示する。破壊的変更があれば手順とともに知らせる
3. AI エージェント向けの決まりと監査のスキルを新しい版にそろえる（節の外は変えない）
4. `ignite check` を実行する

`npx ignite sync --check` は、決まりが入っている版とそろっていないと失敗します。CI に入れておくと、パッケージだけ更新して決まりが古いままの状態を防げます。

アプリの `package.json` の版の指定は `^1.0.0` のようにします。破壊的変更のない更新を `npm update` でも受け取れます。

## 守ること

- CSS のクラス名とトークン名は Ignite の公開の約束です。ただし、部品の見た目をアプリの CSS で上書きしないでください（更新で壊れます）。必要なものは Ignite に修飾を足します。
- Ignite 以外のアプリのコードを Ignite に書きません。アプリの層の決まりは `DESIGN.md` 0 章にあります。

## 更新を確定する

更新前に作業をコミットし、更新後は `package.json` とロックファイル、同期された規約・スキルを一緒にコミットします。CI や別の端末では `npm ci` で同じ版を再現します（取得の認証設定も必要です）。

`ignite upgrade` の検査が失敗しても、パッケージと規約は更新済みです。表示された変更履歴に沿ってアプリを修正し、`npm run ignite:check` と `npm run ignite:audit` を通します。自動では元に戻りません。

古い採用アプリで `ignite:upgrade` がまだない場合は、まず旧版にもある `npx ignite upgrade` で 1.1.1 以降へ更新し、その後 `npx ignite init` を実行すると追加されます。既存のスクリプトは保持されます。

## レジストリ公開前に試す

Ignite 側で `npm pack --pack-destination /tmp` を実行して作った `.tgz` を、採用アプリ側で `npm install /絶対パス/ymasaki-ignite-1.1.1.tgz` として導入できます。その後の `init` は同じです。更新も `npx ignite upgrade /絶対パス/次の版.tgz` で試せます。

`.tgz` のローカルパスを記録したロックファイルは、別の端末でそのまま使えません。継続利用では非公開レジストリへ配布した版に切り替えてください。
