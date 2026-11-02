## Ignite（デザインシステム）

このアプリの画面は Ignite（`@ymasaki/ignite`）で作る。見た目と操作を Ignite を使うほかのアプリとそろえるため、次を守る。

- 決まりの正本は `node_modules/@ymasaki/ignite/DESIGN.md`。UI を足す・直す前に読む（0 章の手順: 画面の型 → 部品 → 文言）。この版の決まりに従う。
- 部品は `@ymasaki/ignite` から使う。ほかの UI ライブラリ・CSS フレームワークを入れない。画面に `<button>`・`<input>`・`<p>` などを直接書かない。
- 色・文字の大きさ・余白・角丸はトークン（`var(--…)`）だけを使う。Ignite の部品の見た目をアプリの CSS で上書きしない。足りなければアプリの部品を作るか、Ignite に修飾を足す。
- 書体はトークンで選ぶ。金額・KPI などの数字は `.num`、コードは `Code`・`CodeBlock` を使い、`font-family` を直接書かない。
- 枠は `AppShell` に任せ、窓の幅を `matchMedia` で見ない。
- コミットの前に `npx ignite check`、大きな UI の変更のあとに `npm run ignite:audit` を実行する。監査は `ignite-audit` スキルで行える。
- Ignite の更新は `npx ignite upgrade` で取り込む。この節と `ignite-audit` スキルは Ignite が管理するので、手で直さない（アプリ固有の決まりはこの節の外に書く）。
