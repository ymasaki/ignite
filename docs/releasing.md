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

## 公開

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
