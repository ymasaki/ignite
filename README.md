<img src="docs/logo/ignite-icon.svg" alt="Ignite のロゴ" width="72" height="72">

# Ignite

<!-- 読むとき: Ignite の概要・入っているもの・開発の始め方を知るとき -->
<!-- 見直した日: 2026-11-23 -->

Web アプリで同じ見た目・使い勝手・UX をそろえるデザインシステムです。デザインの決まり、React の UI 部品、決まりどおりかを確かめる監査を 1 つのパッケージで配ります。デスクトップアプリへの展開は次の段階です。

| 入っているもの | 場所 |
|---|---|
| デザインの決まり（原則・色・文字・余白・動き・文言・アクセシビリティ） | [DESIGN.md](DESIGN.md) |
| トークンと CSS（3 色のスキン、ライト／ダーク、表示の補助） | `@ymasaki/ignite/styles.css` |
| React の部品（アプリの枠、一覧、ダッシュボード、設定、グラフなど） | `@ymasaki/ignite` |
| ソースの検査 | `npx ignite check` |
| 描いた画面の監査（余白・文字・ホバー・コントラスト・axe-core） | `@ymasaki/ignite/audit` |
| AI エージェント向けの決まりと監査スキル | `npx ignite sync` |
| 更新の取り込み | `npx ignite upgrade ./vendor/次の版.tgz` |

## 使い始める

[docs/adopting.md](docs/adopting.md) を見てください。Node.js 22.13.0 以上を用意し、GitHub Release の固定版アーカイブを取得して、SHA256 と元コミットを確認します。相対 `vendor/` からの導入・初期化は採用手順に沿って進めてください。

更新時も [固定版の更新手順](docs/adopting.md#更新を取り込む)で次版のアーカイブを指定します。規約だけの同期は `npm run ignite:sync` です。

## 文書の案内

どの文書をいつ読むかは [文書の索引](docs/README.md) にまとめています。デザインの規約は [DESIGN.md](DESIGN.md) が入口で、章の本文は `docs/design/` にあります。

## 開発

```sh
bash scripts/setup.sh # 依存と共通の pre-commit を導入する
npm run catalog -- --port 15222 --strictPort # worktree 用。空いているポートを選び、終了後に止める
bash scripts/test.sh   # 型・単体テスト・検査・監査・配布から更新までの通し確認
```

常用カタログの専用ポートは 5199 です。開発の確認方法は [構成と確認の対応](https://github.com/ymasaki/ignite/blob/main/ARCHITECTURE.md#変更と確認の対応)、監査の実行方法は [カタログ監査](docs/catalog-audit.md)、コード品質の計測は [コード品質の計測](docs/code-health.md) を参照してください。
