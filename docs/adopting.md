# Ignite を採用する

テーマ・アプリ固有部品・固有監査を組み合わせる場合は [拡張ガイドと実行例](extensions.md) を参照してください。

Node.js 22.12.0 以上を使います。以下の `npx ignite` は、導入済みの Ignite の CLI を実行します。

## 1. 固定版を取得する

現在の配布手順は GitHub Release のアーカイブを取得し、採用アプリの `vendor/` に置く方式です。配布担当から採用する版と元コミットを受け取り、その版の3添付（tgz・`SHA256SUMS`・`COMMIT`）を取得します。以下の `1.7.6` はコマンド例で、最新の公開済み版を意味しません。採用する版に置き換えてください。

```sh
gh release download v1.7.6 --repo github.com/ymasaki/ignite --dir ./ignite-download
(cd ignite-download && shasum -a 256 -c SHA256SUMS)
cat ignite-download/COMMIT
mkdir -p vendor
cp ignite-download/ymasaki-ignite-1.7.6.tgz vendor/
```

`COMMIT` が配布担当の示した元コミットと一致することを確認します。照合が失敗したら導入を止めます。取得先は版ごとに空のディレクトリを使い、既存のファイルを上書きしません。[公開手順](releasing.md#ステージングとプロダクション)の設定では Release は Public です。GitHub Packages の認証はこの取得経路では使いません。通常の npm 依存の取得にはネットワークが必要です。

## 2. 入れる

```sh
npm install --save-exact ./vendor/ymasaki-ignite-1.7.6.tgz --ignore-scripts --no-audit --no-fund
npm install react react-dom @tabler/icons-react
npm install -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

依存は相対 `file:vendor/…` になります。tgz・`package.json`・ロックファイルを一緒にコミットします。`*.tgz` が無視されている場合は、そのファイルだけ例外にします。絶対パスや別チェックアウトを参照しません。別端末での再現も [相対アーカイブの運用](#相対アーカイブで継続利用する)に従います。

`init --app` のひな形を起動・ビルドする場合は、開発依存も入れます。

```sh
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

新しいアプリは `npx ignite init --app`、既存のアプリは `npx ignite init` を実行します。どちらも、置いてあるファイルは上書きしません。

| 置かれるもの | 役割 |
|---|---|
| `ignite.config.json` | ソースの検査の設定 |
| `e2e/ignite.audit.ts` | 監査する画面の一覧 |
| `playwright.ignite.config.ts` | 監査の実行の設定。実行のたびに空いているポートを選ぶ |
| `AGENTS.md` の Ignite の節（`CLAUDE.md` があればそこにも） | AI エージェント向けの決まり |
| `.claude/skills/ignite-audit`・`.agents/skills/ignite-audit` | 監査のスキル |
| `package.json` の `ignite:check`・`ignite:audit`・`ignite:sync`・`ignite:upgrade` | 実行の入口 |

## 3. アプリに組み込む（既存のアプリ）

1. 入口で `import '@ymasaki/ignite/styles.css'` を読み、その後にアプリのテーマと CSS を読みます。
2. 起動時に `startTheme(URL のパラメータ)` と `startAssist()` を呼びます。
3. `index.html` の `<body>` の先頭に、最初の描画からテーマを当てるスクリプトを置きます（`node_modules/@ymasaki/ignite/templates/app/index.html` からコピー）。
4. `index.html` の `<head>` に、書体を読む `<link>` を置きます（同じファイルからコピー）。Content Security Policy を設定しているアプリは `style-src` に `https://fonts.googleapis.com`、`font-src` に `https://fonts.gstatic.com` を足します。読めないときは端末の書体で描くので、オフラインでも動きます。
5. 画面を `AppShell` で組み、内容は `Board`（一覧は中に `ListScreen`）、`DashboardScreen`、`SettingsScreen` に置きます。設定の画面には `ThemeSettings` と `AssistSettings` を置きます。

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

`themes` は色トークン等の定義を許可する指定です。区切り内の余白変更と既存部品の見た目の上書きは、1.2.1以降はテーマCSSでも通常・stagedともに検査します。

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

### 特殊な画面の測定を接続する（1.2.0以降）

共通規則と監査実装はIgniteが管理し、採用側は画面URL・操作・測定対象と固有の測定を管理します。アプリ固有のスクロールや業務操作のテストは採用側に残します。

`screens` の各画面に次の任意設定を渡せます。設定なしなら従来の監査です。

- `axe: { prepare, restore }`: `(page: Page) => Promise<unknown>` の組。通常測定の後、axe測定中だけ前処理を適用し、`finally`で復元を待ちます。前処理の途中やaxeが失敗しても復元を試み、復元失敗も監査失敗にします。採用側は途中準備からでも復元できる処理を実装してください。
- `layout: { replace, measure }`: `replace` は公開型 `LayoutMeasurement` の配列。`rows`（ヘッダーから先頭の段と段間）、`boardLeft`・`boardRight`・`boardBottom`（内容枠の各辺）だけを指定できます。`measure` は `(page: Page) => Promise<AuditFinding[]>` で、置換した全測定を採用側で引き継ぎます。ヘッダー左端、文字、角丸、横溢れ、操作の重なり等は共通測定のままです。

`AuditFinding` は `{ rule: string; where: string; expected: string; actual: string }`。両公開型は `@ymasaki/ignite/audit` から読みます。追加結果も共通の例外処理・レポートに入り、callbackの失敗は監査失敗になります。追加測定は通常測定後・axe前処理前に実行します。

置換は誤検知を隠すために使わず、対象となる規則と代替測定の対応をアプリの規約に記録してください。callbackが存在するだけでは検査範囲の同等性は保証されません。既存画面・幅・状態の測定対応表と違反を入れた試験で採用側でも確認します。監査設定・固有テストは `sync` で上書きせず、Ignite管理の規約節とskillだけを同期します。

### パン・ズームする描画領域の横クリップ

`panRegions` は、横方向の意図した切り抜きだけを受理する省略可能な設定です。指定しない場合は従来どおりです。

```ts
panRegions: [{ viewport: '.diagram-viewport', content: '.diagram-viewport > .diagram-content' }],
```

両セレクタはdocumentから解決します。contentはviewport自身ではなくその子孫で、ドラッグ・ズーム・キーボード等により枠外の内容へ到達できる描画面だけを指定します。パン操作そのものは共通監査では検証しないため、採用アプリの操作テストで確かめてください。複数の枠も指定できます。

実際のviewportの`overflow-x`が`hidden`か`clip`のときだけ、その枠による描画内容の横クリップを受理します。内容内部の別の枠による切れ、viewport自体の外側の枠・窓による切れ、内容外の兄弟操作、対象自身からviewportまでの間に`position:fixed/sticky`がある操作は受理しません。固定ツールバーやMiniMapはcontentの外に置きます。absolute配置でもcontent外なら通常の検出対象です。枠の検査は子が窓外へパンされていても行います。

文字・コントラスト・操作の重なり等の他の測定や、開いたpopoverの縦横クリップ検査は変わりません。横方向の共通クリップ測定は従来の対象タグと可視性の範囲で行い、任意の文字ノードの内部切れや縦方向全般を保証する設定ではありません。`exceptions`の広い正規表現で描画要素をまとめて除外しないでください。

OrgNavi TreeViewでは`{ viewport: '.vp', content: '.vp > .stage' }`を指定します。`.vp`直下で`.stage`の兄弟のMiniMap、board直下のtoolbar、共通headerは含めません。DraftCanvas等の別画面へ例外を広げません。

## 更新を取り込む

「1. 固定版を取得する」と同じ手順で次版の3添付を取得・照合し、別名の tgz を `vendor/` に置きます。更新前に作業をコミットし、次のパスを実際のファイルに置き換えて実行します。

```sh
npx ignite upgrade ./vendor/ymasaki-ignite-次の版.tgz
npx ignite sync --check
npm run ignite:audit
```

引数なしの `ignite upgrade`（`npm run ignite:upgrade` も同じ）はレジストリの latest を取得するため、vendor 運用では使いません。`upgrade` は次をまとめて行います。

1. パッケージを更新する（部品・トークン・`DESIGN.md`・検査・監査がまとめて新しくなる）
2. 取り込んだ版の変更点を表示する。破壊的変更があれば手順とともに知らせる
3. AI エージェント向けの決まりと監査のスキルを新しい版にそろえる（節の外は変えない）
4. `ignite check` を実行する

`npx ignite sync --check` は、決まりが入っている版とそろっていないと失敗します。CI に入れておくと、パッケージだけ更新して決まりが古いままの状態を防げます。

更新する版は変更履歴を見て明示的に選び、同じ版のアーカイブを別の内容で置き換えません。

## 守ること

- CSS のクラス名とトークン名は Ignite の公開の約束です。ただし、部品の見た目をアプリの CSS で上書きしないでください（更新で壊れます）。必要なものは Ignite に修飾を足します。
- Ignite 以外のアプリのコードを Ignite に書きません。アプリの層の決まりは `DESIGN.md` 0 章にあります。

## 更新を確定する

更新前に作業をコミットします。更新後は採用アプリの既存の型検査・本番ビルド・`npm run ignite:check`・`npm run ignite:audit` をすべて通してから、`package.json` とロックファイル、同期された規約・スキルを一緒にコミットして確定します。`ignite upgrade` は型検査と本番ビルドを実行しません。CI や別の端末では `npm ci` で同じ版を再現します（取得の認証設定も必要です）。

`ignite upgrade` の検査が失敗しても、パッケージと規約は更新済みです。表示された変更履歴に沿ってアプリを修正し、`npm run ignite:check` と `npm run ignite:audit` を通します。自動では元に戻りません。

古い採用アプリで `ignite:upgrade` がまだない場合も、`npx ignite upgrade ./vendor/次の版.tgz` を使えます。更新後 `npx ignite init` を実行すると入口のスクリプトを追加できます。既存のスクリプトは保持されます。

## 相対アーカイブで継続利用する

アーカイブ、package.json、package-lock.json を同じリポジトリで管理します。初回の取得・導入は上の1・2節、更新は「更新を取り込む」に従います。別端末では採用リポジトリへの読取権限が必要ですが、Ignite 用の Packages トークンは不要です。

初回導入時は「2. 入れる」の `npx ignite init`（新規ひな形は `--app`）で初期化してから確認します。

```sh
npm ci --include=dev --ignore-scripts --no-audit --no-fund
node node_modules/@ymasaki/ignite/dist/cli.js sync --check
```

### 初回固定版の記録（2026-11-01）

OrgNavi 向けに承認された初回固定版は `ymasaki-ignite-1.1.1.tgz`、元ソースは `a6b5c00f56f001512baa384f604c93a28db53e86` です。SHA256 は `e0effb5025a6bbb188e3bdbf8aaee420811600a9a2e33cabca991c33813a8642`。この記録は初回の同一物を照合するために保持し、現在の導入推奨版を表しません。監査拡張には1.2.0以降を使います。同じ名前のファイルを後から作り直して代用しません。

### GitHub Packagesへ切り替える条件

以下はレジストリ配布へ切り替える場合だけの条件です。2026-11-01 の確認では既存認証に `read:packages` がなく HTTP 403 でした。本棚卸しでは現在の発行・取得状態を再確認していません。設定を置いただけでは切り替えたとみなしません。

アプリのリポジトリの `.npmrc` は次の形です。トークンはコミットしません。

```
@ymasaki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

人がPrivateのまま固定版を発行し、利用者ごとにパッケージのReadアクセスを付けます。classic PATは取得用に `read:packages` が必要です。トークンは端末の秘密管理またはCIのsecretから環境変数へ渡し、値をチャット・Git・コマンド引数へ書きません。GitHub Actionsの `GITHUB_TOKEN` はローカル端末のPATとは別で、採用リポジトリへのPackages読取許可が必要です。

各端末でこの節の `.npmrc` と環境変数を用意し、`npm view @ymasaki/ignite@1.1.1 version --registry=https://npm.pkg.github.com` の成功を確認します。401/403は認証・権限、404は未発行または不可視の可能性があり、404だけで未発行と判断しません。

1.1.1をそのまま移す場合、人は承認済みtgzそのものを発行します（[発行手順](releasing.md#承認済みアーカイブをそのまま発行する)）。取得側でも空フォルダ・空キャッシュで `npm pack @ymasaki/ignite@1.1.1 --ignore-scripts --registry=https://npm.pkg.github.com --cache ./empty-cache` を実行し、取得tgzのSHA256が上記の承認済みハッシュと一致することを確認します。不一致なら切替を止めます。文書を含め内容が変わる場合はpatch版を上げ、変更履歴・新ハッシュを確認して別版への更新として扱います。

その後 `npm install --save-exact @ymasaki/ignite@1.1.1 --ignore-scripts --no-audit --no-fund` で依存とlockfileを更新します。既存node_modules・distのない別コピーと空の `--cache` で上記ci、公開入口、型チェック、ビルドを確認してから切替を確定します。成功前にvendorを削除しません。

認証・権限の正本: [GitHub npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)、[Packages permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)。
