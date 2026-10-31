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

[docs/adopting.md](docs/adopting.md) を見てください。新しいアプリなら次の 2 行で動きます。

```sh
npm install @ymasaki/ignite react react-dom @tabler/icons-react
npx ignite init --app
```

## 開発

```sh
npm ci
npm run catalog        # 全部品を見るカタログ
bash scripts/test.sh   # 型・単体テスト・検査・監査・配布から更新までの通し確認
```

版の付け方と公開の手順は [docs/releasing.md](docs/releasing.md) にあります。
