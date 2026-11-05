# Ignite の版と公開

## 版の付け方

採用アプリは固定版とlockfileで再現し、更新版を明示的に選びます。次の基準で版を決めます。

| 版 | 変更 | 例 |
|---|---|---|
| major | アプリの構成や主要な公開APIなどを抜本的に変える | 全体の移行が必要になる設計刷新、主要API体系の置き換え |
| minor | 部品や機能の追加、局所的な見た目・規約・監査の更新 | 部品・修飾・トークン・スキンの追加、配置や内部HTMLの改善、監査の測定の追加 |
| patch | 決まりどおりでなかったものを直す | 不具合修正、文書の修正 |

局所的な調整が必要という理由だけではmajorにしません。minorでも採用側に調整が必要なら、変更履歴の `### 破壊的変更` に影響と直し方を書きます。版番号だけで互換性を判断せず、更新時にはこの節も確認します。

公開の約束に含まれるのは `src/index.ts` の出力、CSS のクラス名とトークン名、`DESIGN.md` の決まり、`ignite` の命令、`defineIgniteAudit` の設定です。

## 変更履歴

`CHANGELOG.md` に版ごとの節を足します。`ignite upgrade` はこの節を採用アプリの開発者と AI エージェントに見せます。

```md
## 1.2.0（2026-11-15）

### 追加

- ...

### 破壊的変更

- 何が変わったか。アプリの何をどう直すか
```

見出しの形（`## 版`、`### 破壊的変更`）は `ignite upgrade` が読むので変えません。破壊的変更には、直し方を必ず書きます。

## ステージングとプロダクション

ステージングは、検査済みの変更を main に取り込み、そのソースを読むカタログへ反映する段階です。部品変更時はカタログも更新します。DevBoard の取り込み後の処理で `bash scripts/build-catalog.sh` を実行し、未コミット変更と対象コミットを照合したうえで、その固定コピーから配信用カタログを `catalog-dist/` へビルドします。URL は `http://localhost:5199/` です。URLを開くと `staging.start` が専用サーバーを起動します。WebDockは使いません。手動起動も `bash scripts/start-catalog.sh` で行えます（停止まで動きます）。既に起動中なら、取り込み後にブラウザを再読み込みすると更新済みの配信用ファイルを表示します。ポート競合時は別ポートへ逃げずに失敗します。ビルド済みカタログはNode.js標準機能で配信し、通常起動にVite・Rolldownや依存の再インストールは不要です。初回ビルドには従来どおり開発依存とネイティブライブラリが必要です。worktreeの一時検証には `bash scripts/start-catalog.sh 15222` のように別ポートを指定し、検証後に停止します。

プロダクションは、人が DevBoard の「プロダクションへ」を押して、GitHub Releaseへパッケージを配布する段階です。リポジトリ `ymasaki/ignite` はPublicで、Releaseの添付は認証なしでも取得できます。`production.command` は `node scripts/release.mjs` を実行します。`gh` に `ymasaki` アカウントでログインしておきます。ghの有効アカウントが別のアカウント（例: 会社用）に切り替わっていても、`release.mjs` は `gh auth token --user ymasaki` で取り出したトークンだけを `gh` とGitの送信（`gh auth git-credential`）に渡します。`ymasaki` の認証がなければGitHubへ触らずに停止します。GitHubへの読み取りが通信の失敗（接続のタイムアウトなど、HTTPの応答がないもの）で止まったときは、少し待って2回まで再試行します。Releaseの作成・公開・添付・pushは二重にしないよう再試行せず、失敗したら停止し、次の実行で状態を読み直して続けます。GitHubの `main` が対象コミットより遅れていれば、対象コミットを `main` へ早送りだけで送ります。同じか既に含まれていれば送りません。分岐していて早送りできない場合は、強制上書きせずに停止します。DevBoardのGitHub同期はDevBoard自身専用のため、Igniteでは使いません。送信後もコミットが見つからない、未コミット変更や対象コミットとの不一致がある場合は停止します。`main` 以外のブランチの送信や可視性の変更は行いません。

固定コミットの一時コピーで `npm ci --include=dev`・一括検査・`npm pack` を実行します。成功したtgz、`SHA256SUMS`、由来のコミットを記した `COMMIT` とローカル限定の `VERIFIED.json` を、一時保存先から `releases/<版>/` へまとめて移します。版単位のロックで並行実行を止めます。同版の保存先がある場合は、検証記録・コミット・全ファイルのハッシュが一致するときだけ再利用し、作り直しません。検証記録がない過去の配布物や内容が違う版は上書きせず停止します。内容を変える場合は版を上げます。

同じ版のタグが既に公開済みで、そのタグのコミットが対象コミットの祖先であり、その後の変更が配布物にもビルド・検査にも入らないパス（`devboard.json`・`AGENTS.md`・`CLAUDE.md`・`.github/`・`scripts/release.mjs` とそのテスト）だけなら、版を上げずに成功します。この場合は `main` を対象コミットへ早送りしたうえで、公開済みのコミットを由来として既存のReleaseとタグ・3添付を照合し、書き換えません。それ以外のパス（`docs/`・`package.json` など）が変わっていれば、版を上げるよう求めて停止します。

GitHubでは `v<版>` のdraftを作り、不足する3添付（tgz・`SHA256SUMS`・`COMMIT`）だけを追加します。既存添付をダウンロードして照合し、不一致・余分な添付・異なる元コミットなら停止します。全添付が一致し、タグの元コミットを再確認してから公開します。公開済みの場合もタグと3添付を照合し、一致すれば書き換えずに成功します。成功後にDevBoardが `release` を進めます。生成物はGit管理外です。

通信失敗時は同じコミットで「プロダクションへ」を再実行できます。添付や公開が成功した後に応答だけ失われても、既存の状態を読み直して照合します。ロック `releases/.<版>.lock` が残った場合は、該当プロセスが終了していることを人が確認してからそのロックだけを除去してください。稼働中や確認不能のロックは削除しません。不一致時にRelease・添付・タグを消してやり直す運用はしません。

採用側は `gh release download v1.3.1 --repo github.com/ymasaki/ignite --dir ./ignite-download` として3添付を取得し、そのディレクトリで `shasum -a 256 -c SHA256SUMS` と `COMMIT` を確認します。tgzは既存の相対vendor方式で採用します。

ローカル準備だけの場合は `bash scripts/prepare-package.sh` を使います。固定コミットの検査と同じ検証記録による再利用を行い、GitHubには接続しません。この処理も本番処理もレジストリへは発行しません。過去の承認済みアーカイブを新しく作った同版のファイルで置き換えません。

## カタログの公開（GitHub Pages）

カタログは `https://ymasaki.github.io/ignite/` でも公開します。GitHub の `main` が更新されると、`.github/workflows/pages.yml` が `CATALOG_BASE=/ignite/` でカタログをビルドし、Pages へ配信します。`main` は「プロダクションへ」の `release.mjs` だけが送るので、Pages はプロダクションと同じ時点で更新されます。ステージングの `http://localhost:5199/` は従来どおり `/` に置いてビルドします。手で配信し直すときは、GitHub の Actions から同じ手順を `workflow_dispatch` で動かします。

最初の一度だけ、人がリポジトリの Settings → Pages の Source を「GitHub Actions」にします。

## レジストリへの発行

1. `package.json` の版と `CHANGELOG.md` を直す
2. `bash scripts/test.sh` を通す。`npm pack --pack-destination /tmp` で公開せず配布物も確認する
3. `git tag v1.2.0` を付けて push する
4. `npm publish`（`publishConfig` で GitHub Packages へ。`write:packages` の権限が要る）

`npm pack` と `npm publish` は `prepack` でビルドしてから配布物を作ります。開発依存を含めて `npm ci` しておきます。`--ignore-scripts` はこの保証を省くため、通常の配布では付けません。`prepare` は開発時と Git 経由の導入に備えて維持しています。

## 最初の公開の前に要ること

リポジトリ `ymasaki/ignite` が存在することを確認し、`package.json` の `repository` と一致させます。パッケージの名前の範囲 `@ymasaki` は GitHub のアカウント名と一致する必要があります。

## 配布経路の現状（2026-11-01）

既存gh認証はPackages権限がなく一覧取得が403のため、レジストリ配布は未成立です。現在採用する1.1.1アーカイブとハッシュ、同梱・更新方法は [adopting.md](adopting.md#相対アーカイブで継続利用する) に固定しています。この文書変更後に作る同じ版のtgzは、その承認済みアーカイブの代用品にはしません。

発行は人が行います。classic PATのwrite:packagesとパッケージへのWrite権限を用意し、秘密管理から環境変数へ渡したうえでユーザー設定（Git管理外）でnpm.pkg.github.comへの認証を設定します。上の確認とpackを通してから発行し、パッケージのVisibilityがPrivateであること、採用者のRead権限を確認します。新規パッケージは既定でPrivateですが、既存の可視性も確認し、Publicへの変更はしません。発行済みの同じ版を上書きせず、内容変更時はpatch版を上げます。

固定コミットは由来の記録です。distを含まないGit依存は、ignore-scriptsでの取得経路の代わりにはしません。`npm run smoke` は相対vendor依存のlockfileを別ディレクトリへコピーし、空キャッシュのci（include=dev・ignore-scripts）から公開入口・型・ビルド・CLIを検証します。

### 承認済みアーカイブをそのまま発行する

1.1.1を移す場合はチェックアウトから再packせず、承認済み `ymasaki-ignite-1.1.1.tgz` のSHA256をadopting.mdと照合します。人が認証設定後、そのファイルを指定して実行します。

```sh
npm publish ./ymasaki-ignite-1.1.1.tgz --ignore-scripts --registry=https://npm.pkg.github.com
```

この場合はビルド・検証済みのtgzをそのまま発行するためスクリプトを無効にします。発行後は別フォルダ・空キャッシュから `npm pack @ymasaki/ignite@1.1.1 --ignore-scripts --registry=https://npm.pkg.github.com --cache ./empty-cache` で取得し、SHA256の一致を確認します。既存1.1.1が異なる内容なら切替を止め、上書きしません。今回の文書変更を含めて配布する場合はpatch版を上げ、新版のアーカイブ・ハッシュ・変更履歴を更新として確認します。
