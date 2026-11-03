# Ignite の版と公開

## 版の付け方

採用アプリは固定版とlockfileで再現し、更新版を明示的に選びます。次の基準で版を決めます。

| 版 | 変更 | 例 |
|---|---|---|
| major | 採用アプリのコードか画面の配置を直す必要がある | 部品・引数・CSS のクラス名・トークン名の削除や意味の変更、目盛りの削除、検査の新しい決まりで既存の書き方が止まる |
| minor | 足しただけで、採用アプリは直さなくてよい | 部品・修飾・トークン・スキンの追加、見た目の改善、監査の測定の追加 |
| patch | 決まりどおりでなかったものを直す | 不具合修正、文書の修正 |

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

ステージングは、検査済みの変更を main に取り込み、そのソースを読むカタログへ反映する段階です。部品変更時はカタログも更新します。DevBoard の取り込み後の処理で `bash scripts/build-catalog.sh` を実行し、配信用カタログを `catalog-dist/` へビルドします。URL は `http://localhost:5199/` です。URLを開くと `staging.start` が専用サーバーを起動します。WebDockは使いません。手動起動も `bash scripts/start-catalog.sh` で行えます（停止まで動きます）。既に起動中なら、取り込み後にブラウザを再読み込みすると更新済みの配信用ファイルを表示します。ポート競合時は別ポートへ逃げずに失敗します。

プロダクションは、人が DevBoard の「プロダクションへ」を押して、配布できるパッケージを用意する段階です。`production.command` は `bash scripts/prepare-package.sh` を実行します。未コミット変更と対象コミットの不一致があれば停止し、固定コミットの一時コピーで `npm ci --include=dev`・一括検査・`npm pack` を実行します。

成功すると、プロジェクトの `releases/<版>/` に tgz、`SHA256SUMS`、由来のコミットを記した `COMMIT` が残ります。同じ版の保存先がある場合は上書きせず停止します。内容が変わる場合は、版と変更履歴を更新してから再実行します。生成物は Git 管理外です。成功後に DevBoard が `release` を進めます。これにより main は確認中の変更、release は配布物を用意した変更を表します。

この処理はレジストリへ発行しません。採用アプリへ tgz とハッシュを渡すか、必要な認証を整えて人が下記の発行を行います。過去の承認済み1.1.1アーカイブを、新しく作った同版のファイルで置き換えません。

## レジストリへの発行

1. `package.json` の版と `CHANGELOG.md` を直す
2. `bash scripts/test.sh` を通す。`npm pack --pack-destination /tmp` で公開せず配布物も確認する
3. `git tag v1.2.0` を付けて push する
4. `npm publish`（`publishConfig` で GitHub Packages へ。`write:packages` の権限が要る）

`npm pack` と `npm publish` は `prepack` でビルドしてから配布物を作ります。開発依存を含めて `npm ci` しておきます。`--ignore-scripts` はこの保証を省くため、通常の配布では付けません。`prepare` は開発時と Git 経由の導入に備えて維持しています。

## 最初の公開の前に要ること

Private リポジトリ `ymasaki/ignite` が存在することを確認し、`package.json` の `repository` と一致させます。パッケージの名前の範囲 `@ymasaki` は GitHub のアカウント名と一致する必要があります。

## 配布経路の現状（2026-11-01）

リポジトリはPrivateを再確認済み。既存gh認証はPackages権限がなく一覧取得が403のため、レジストリ配布は未成立です。現在採用する1.1.1アーカイブとハッシュ、同梱・更新方法は [adopting.md](adopting.md#相対アーカイブで継続利用する) に固定しています。この文書変更後に作る同じ版のtgzは、その承認済みアーカイブの代用品にはしません。

発行は人が行います。classic PATのwrite:packagesとパッケージへのWrite権限を用意し、秘密管理から環境変数へ渡したうえでユーザー設定（Git管理外）でnpm.pkg.github.comへの認証を設定します。上の確認とpackを通してから発行し、パッケージのVisibilityがPrivateであること、採用者のRead権限を確認します。新規パッケージは既定でPrivateですが、既存の可視性も確認し、Publicへの変更はしません。発行済みの同じ版を上書きせず、内容変更時はpatch版を上げます。

固定コミットは由来の記録です。distを含まないGit依存は、ignore-scriptsでの取得経路の代わりにはしません。`npm run smoke` は相対vendor依存のlockfileを別ディレクトリへコピーし、空キャッシュのci（include=dev・ignore-scripts）から公開入口・型・ビルド・CLIを検証します。

### 承認済みアーカイブをそのまま発行する

1.1.1を移す場合はチェックアウトから再packせず、承認済み `ymasaki-ignite-1.1.1.tgz` のSHA256をadopting.mdと照合します。人が認証設定後、そのファイルを指定して実行します。

```sh
npm publish ./ymasaki-ignite-1.1.1.tgz --ignore-scripts --registry=https://npm.pkg.github.com
```

この場合はビルド・検証済みのtgzをそのまま発行するためスクリプトを無効にします。発行後は別フォルダ・空キャッシュから `npm pack @ymasaki/ignite@1.1.1 --ignore-scripts --registry=https://npm.pkg.github.com --cache ./empty-cache` で取得し、SHA256の一致を確認します。既存1.1.1が異なる内容なら切替を止め、上書きしません。今回の文書変更を含めて配布する場合はpatch版を上げ、新版のアーカイブ・ハッシュ・変更履歴を更新として確認します。
