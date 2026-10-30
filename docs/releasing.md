# Ignite の版と公開

## 版の付け方

採用アプリは `^1.0.0` の範囲で更新を受け取ります。次の基準で版を決めます。

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
2. `bash scripts/test.sh` を通す
3. `git tag v1.2.0` を付けて push する
4. `npm publish`（`publishConfig` で GitHub Packages へ。`write:packages` の権限が要る）

## 最初の公開の前に要ること

Private リポジトリ `ymasaki/ignite` を作り、`package.json` の `repository` と一致させます。パッケージの名前の範囲 `@ymasaki` は GitHub のアカウント名と一致する必要があります。
