# Ignite を採用する

Node.js 22.12.0 以上を使います。以下の `npx ignite` は、導入済みの Ignite の CLI を実行します。

## 1. 取得の設定

2026-11-01現在、OrgNavi向けの固定版は **1.1.1の相対vendorアーカイブ**です。GitHub Packagesは正式配布の第一候補ですが、現認証は`read:packages`不足（HTTP 403）で、公開済みか・取得できるかは未確認です。レジストリの設定だけでは取得成立としません。現時点の導入は末尾の「相対アーカイブで継続利用する」に従ってください。


GitHub Packagesが利用可能になった場合はPrivateパッケージとして取得します。アプリのリポジトリの `.npmrc` に次を書き、パッケージへのアクセス権と `read:packages` の権限を持つ Personal access token (classic)を環境変数 `GITHUB_TOKEN` に入れます（トークンをコミットしない）。

```
@ymasaki:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## 2. 入れる

```sh
npm install --save-exact @ymasaki/ignite@1.1.1
npm install react react-dom @tabler/icons-react
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

以下の引数なし更新はレジストリ配布の利用開始後に使います。相対アーカイブ利用中は末尾の手順で次版tgzを指定してください。

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

再現性が必要な採用では `1.1.1` のように版を固定し、lockfileを一緒にコミットします。更新する版は変更履歴を見て明示的に選びます。

## 守ること

- CSS のクラス名とトークン名は Ignite の公開の約束です。ただし、部品の見た目をアプリの CSS で上書きしないでください（更新で壊れます）。必要なものは Ignite に修飾を足します。
- Ignite 以外のアプリのコードを Ignite に書きません。アプリの層の決まりは `DESIGN.md` 0 章にあります。

## 更新を確定する

更新前に作業をコミットし、更新後は `package.json` とロックファイル、同期された規約・スキルを一緒にコミットします。CI や別の端末では `npm ci` で同じ版を再現します（取得の認証設定も必要です）。

`ignite upgrade` の検査が失敗しても、パッケージと規約は更新済みです。表示された変更履歴に沿ってアプリを修正し、`npm run ignite:check` と `npm run ignite:audit` を通します。自動では元に戻りません。

古い採用アプリで `ignite:upgrade` がまだない場合は、まず旧版にもある `npx ignite upgrade` で 1.1.1 以降へ更新し、その後 `npx ignite init` を実行すると追加されます。既存のスクリプトは保持されます。

## 相対アーカイブで継続利用する

OrgNavi向けの配布物は `ymasaki-ignite-1.1.1.tgz`、元ソースは `a6b5c00f56f001512baa384f604c93a28db53e86` です。
SHA256は `e0effb5025a6bbb188e3bdbf8aaee420811600a9a2e33cabca991c33813a8642`。版番号だけでなくこのハッシュで同一物を確認します。後から同名ファイルを上書きしません。

1. 配布担当から非公開経路で取得し、`shasum -a 256 ymasaki-ignite-1.1.1.tgz` を照合する。
2. 採用リポジトリの `vendor/` にコピーする。
3. 採用アプリのpackage.jsonのある場所で次を実行する。

```sh
npm install --save-exact ./vendor/ymasaki-ignite-1.1.1.tgz --ignore-scripts --no-audit --no-fund
```

依存は `file:vendor/ymasaki-ignite-1.1.1.tgz` になります。アーカイブ、package.json、package-lock.jsonを一緒にコミットします。`*.tgz` が無視されている場合はこのファイルだけ例外にします。絶対パスや別チェックアウトへの参照は使いません。別端末では非公開リポジトリへの読取権限が必要ですが、Ignite用のPackagesトークンは不要です。通常のnpm依存の取得にはネットワークが必要です。

```sh
npm ci --include=dev --ignore-scripts --no-audit --no-fund
node node_modules/@ymasaki/ignite/dist/cli.js sync --check
```

更新時は次版を別名でvendorへ置き、ハッシュを照合後 `npx ignite upgrade ./vendor/次の版.tgz` を実行します。lockfileと同期された規約・スキルもコミットし、アプリの型・ビルド・監査を通します。引数なしのupgradeはレジストリのlatestを取得するため、この経路では使いません。

### GitHub Packagesへ切り替える条件

人がPrivateのまま固定版を発行し、利用者ごとにパッケージのReadアクセスを付けます。classic PATは取得用に `read:packages` が必要です。トークンは端末の秘密管理またはCIのsecretから環境変数へ渡し、値をチャット・Git・コマンド引数へ書きません。GitHub Actionsの `GITHUB_TOKEN` はローカル端末のPATとは別で、採用リポジトリへのPackages読取許可が必要です。

各端末で冒頭の `.npmrc` と環境変数を用意し、`npm view @ymasaki/ignite@1.1.1 version --registry=https://npm.pkg.github.com` の成功を確認します。401/403は認証・権限、404は未発行または不可視の可能性があり、404だけで未発行と判断しません。

その後 `npm install --save-exact @ymasaki/ignite@1.1.1 --ignore-scripts --no-audit --no-fund` で依存とlockfileを更新します。既存node_modules・distのない別コピーと空の `--cache` で上記ci、公開入口、型チェック、ビルドを確認してから切替を確定します。成功前にvendorを削除しません。

認証・権限の正本: [GitHub npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)、[Packages permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)。
