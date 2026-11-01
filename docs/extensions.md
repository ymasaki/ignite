# アプリの拡張を保つ

テーマ、アプリ固有の部品、固有の監査は採用アプリが所有します。[DESIGN.md の0章](../DESIGN.md#0-層とカスケード)の上に差分を重ね、Igniteの共通実装をコピーしません。アプリから使うのは `@ymasaki/ignite`、CSS、`@ymasaki/ignite/audit` の公開入口です。`src/` や `dist/` 内部への直接importはしません。

| 所有するもの | Ignite | 採用アプリ |
|---|---|---|
| 規約・共通部品・CSS | 正本と公開実装 | 公開入口から使う |
| テーマ | 公開トークン、skin/modeの動作 | 追加トークンと必要な値の上書き |
| アダプタ部品 | 素の値を受け取る汎用部品 | データから値を渡す薄い部品と入口 |
| 監査 | 共通規則・測定・集計 | URL・状態・操作・固有測定・例外根拠 |
| 更新時の同期 | 規約の管理節と監査skill | コピー後の例・設定・業務の検査を保守 |

## テーマ・部品・検査の配置

配布物の `templates/extensions/` は3つを一緒に使う最小例です。業務データは持たず、`name`・`initial`・`ready`だけを受け取ります。アプリ側の実際の型や業務の判定は、アプリの層へ置きます。

| 例のファイル | 役割 |
|---|---|
| `src/styles/theme.css` | `--appx-state-*` を公開トークンとmode属性から定義 |
| `src/ui/extensions.css` | 自分の `.appx-state` だけに見た目を定義 |
| `src/ui/SampleRow.tsx` | データを公開 `EntityRow`・`Avatar` へ渡すアダプタ |
| `src/ui/index.ts` | Igniteの再exportと自分の部品をまとめるアプリの入口 |
| `src/app/App.tsx` | アプリの入口から部品を使う画面の例 |
| `e2e/extensions.ts` | 状態フラグと表示の対応を測り、公開 `AuditFinding[]` を返す |
| `e2e/ignite.audit.ts` | `defineIgniteAudit` に固有測定を接続する設定 |

CSSは基本ひな形の `src/main.tsx` が **Igniteのstyles.css → アプリのapp.css** の順で読みます。例のapp.cssが **theme.css → ui/extensions.css** の順にimportします。`ignite.config.json` の `themes` は静的検査の振り分けであり、CSSを読み込む機能ではありません。themeでは色トークン等を許可しますが、既存部品のセレクタ上書きと区切り内の余白変更は許可しません。

固有測定は `layout: { replace: [], measure: measureSampleState }` で追加します。この例では共通測定を一切省略しません。特殊な座標の置換やaxe前後処理が必要な場合だけ、[採用手順の監査拡張](adopting.md)の公開設定を使い、置換する規則と代替測定の対応をアプリの規約へ書きます。業務操作、スクロール等の固有検査もアプリに残します。

## 新規の例用フォルダで実行する

このコピー手順は**新規の例用フォルダだけ**で実行します。既存アプリへ丸ごと重ねると、そのアプリが所有する同名ファイルを置き換えます。既存アプリでは上の配置を自分の構成へ対応づけ、必要な差分だけを取り込みます。既存アプリへのサンプルコピーや `init` 再実行は採用の必須条件ではありません。

Node.js 22.12.0以上を用意し、[取得手順](adopting.md)で固定版tgzとSHA256を受け取ります。以下の `/取得先/ymasaki-ignite-1.2.2.tgz` は、その実ファイルへ置き換えます。

```sh
mkdir ignite-extension-example
cd ignite-extension-example
npm init -y
npm pkg set type=module
npm pkg set private=true --json
mkdir vendor
cp /取得先/ymasaki-ignite-1.2.2.tgz vendor/
npm install --save-exact ./vendor/ymasaki-ignite-1.2.2.tgz react react-dom @tabler/icons-react --ignore-scripts --no-audit --no-fund
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @playwright/test @axe-core/playwright --ignore-scripts --no-audit --no-fund
npx ignite init --app
node --input-type=module -e "import fs from 'node:fs'; fs.cpSync('node_modules/@ymasaki/ignite/templates/extensions', '.', {recursive:true})"
npx playwright install chromium
npx tsc --noEmit
npx vite build
npx ignite check
npm run ignite:audit
```

監査は専用の一時サーバーを起動し、終了時に停止します。5317が使用中なら、別アプリを測らないよう失敗させます。画面は監査レポートのスクリーンショットで確認できます。例を常用サーバーとして起動する設定はここでは追加しません。

固有違反を試すには、コピーした `SampleRow.tsx` の `ready` 側の表示だけを「準備済み」から「未設定」へ変え、もう一度監査します。「アプリの状態表示」がレポートに載り監査が失敗します。元へ戻すと成功します。共通の見た目の規則は引き続きIgniteが検査します。

## 独自の名前と衝突の扱い

新規拡張のCSSクラスとトークンには、アプリを区別できる接頭辞を付けます。例の `appx-` は自分のアプリ名に合わせて置き換えるための名前です。`.dash` のような短い一般名は将来のIgniteと衝突しやすいため、新規の独自部品では避けます。`data-*`、部品名、監査の規則名も、自分の所有範囲が分かるようにします。

既存のクラス・トークンを一括改名する必要はありません。衝突した箇所だけを局所的に改名し、参照する画面・CSS・監査セレクタを一緒に直して検証します。Igniteのセレクタをアプリから上書きする方法では解消しません。

## 更新で残すもの・確認するもの

コピー後のテーマ、部品、入口、監査設定・固有測定はアプリ所有です。`init` は既存ファイルを上書きせず、`sync` は規約管理節と監査skillを更新します。`templates/extensions` の新版を更新時に自動コピーしません。新版の例との差分が必要なら、変更履歴と公開APIを見て採用側が取り込みます。

1. アプリの作業をコミットし、[固定版の更新手順](adopting.md#更新を取り込む)で依存とlockfileを更新する。相対vendorでは次版を別ファイルで置く。
2. `npx ignite sync` と `npx ignite sync --check` を実行し、アプリ所有ファイルの差分が意図したものだけかを確認する。
3. 空環境の `npm ci --include=dev --ignore-scripts --no-audit --no-fund`、型・ビルド・共通check/audit・固有検査を実行する。測定の置換は既存の画面・幅・状態との対応を確認する。
4. 新しい共有部品やトークンと独自名が衝突していないかを確認し、依存・lockfile・同期した規約と採用差分を一緒にコミットする。

Ignite自身の `npm run smoke` は、配布物のこの例をコピーしてカスタマイズし、init・sync・模擬次版への更新で所有ファイルが変わらないこと、型・ビルド・静的検査・監査と固有違反検出が更新後にも動くことを確認します。模擬次版は同じ配布物へ試験用変更を加えたものです。更新経路と所有の境界を確認する試験であり、将来の任意の版との互換性を保証するものではありません。実際の更新版では採用側の検証も必要です。
