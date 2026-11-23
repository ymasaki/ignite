# 文書の索引

<!-- 見直した日: 2026-11-20 -->

どの文書をいつ読むかの一覧。全部を先に読まず、作業する領域の文書だけを読む。

- 入口: Ignite で作業するエージェントは [AGENTS.md](https://github.com/ymasaki/ignite/blob/main/AGENTS.md) を毎回読む。UI を作る・直すときは [DESIGN.md](../DESIGN.md) を読み、作業する章の `docs/design/` の文書へ進む。
- 領域の正本: 下の表の各文書。今の仕組みと約束だけを書き、経緯は [CHANGELOG.md](../CHANGELOG.md) とコミットに残す。
- 文書の書き方の決まり・上限・検査は [AGENTS.md の「文書を保つ」](https://github.com/ymasaki/ignite/blob/main/AGENTS.md#文書を保つ)。

下の表は各文書の冒頭の `<!-- 読むとき: … -->` から作る（`node scripts/docs.mjs --write`）。

<!-- 索引: node scripts/docs.mjs --write で各文書の「読むとき」から作る。手で直さない -->
| 文書 | 読むとき |
|---|---|
| [AGENTS.md](https://github.com/ymasaki/ignite/blob/main/AGENTS.md)（開発リポジトリ） | Ignite で作業を始めるとき必ず（作業ルール・確認の手順・文書の決まり） |
| [ARCHITECTURE.md](https://github.com/ymasaki/ignite/blob/main/ARCHITECTURE.md)（開発リポジトリ） | Ignite 自身の構成・公開入口・ビルドを変えるとき、変更に対応する確認を探すとき |
| [CHANGELOG.md](../CHANGELOG.md) | 版ごとの変更点と移行方法を確かめるとき（追記だけの記録） |
| [DESIGN.md](../DESIGN.md) | UI を足す・直す前に必ず（層・原則・文言と、どの章の文書を読むかの一覧） |
| [README.md](../README.md) | Ignite の概要・入っているもの・開発の始め方を知るとき |
| [docs/adopting.md](adopting.md) | アプリに Ignite を導入・更新するとき、アプリ側の検査と監査を設定するとき |
| [docs/catalog-audit.md](catalog-audit.md) | Ignite のカタログ監査を実行する・直すとき、監査の再利用やロックの扱いを確かめるとき |
| [docs/code-health.md](code-health.md) | 本体のコードの解析・行カバレッジ・計算の速さを測る・計測の仕組みを直すとき |
| [docs/coverage.md](coverage.md) | 部品を足す候補を選ぶとき、主要なデザインシステムとの対応を確かめるとき |
| [docs/design/accessibility.md](design/accessibility.md) | キー操作・フォーカス・読み上げ・押す面・表示の補助を決める・直すとき |
| [docs/design/color.md](design/color.md) | 色・コントラスト・スキン・ダークモードを決める・直すとき |
| [docs/design/foundations.md](design/foundations.md) | 書体と文字の大きさ・角丸と影と重なり・動きの長さと緩急を決める・直すとき |
| [docs/design/layout.md](design/layout.md) | 余白・部品の大きさ・画面の骨組みの区切りを決める・直すとき |
| [docs/design/parts-charts.md](design/parts-charts.md) | グラフ・キャンバス・ツリーの部品を使う・足す・直すとき（どのグラフを選ぶかは画面の型の文書） |
| [docs/design/parts-display.md](design/parts-display.md) | タブ・メニュー・ダイアログ・知らせ・印・顔アイコン・一覧の行・KPI・表の部品を使う・足す・直すとき |
| [docs/design/parts-inputs.md](design/parts-inputs.md) | ボタン・入力欄・選択・認証の部品を使う・足す・直すとき |
| [docs/design/parts-layout.md](design/parts-layout.md) | 画面の枠・面・まとまり・詰め方・動きの部品、見出しの段、状態で表示が変わる部品を使う・足す・直すとき |
| [docs/design/responsive.md](design/responsive.md) | 窓や枠の大きさが変わったときの詰め方・新しい画面やアプリの大きさへの対応を決めるとき |
| [docs/design/screens.md](design/screens.md) | 新しい画面の型を選ぶ・足すとき、グラフの種類を選ぶとき |
| [docs/design/states.md](design/states.md) | 読み込み中・空・エラー・知らせ・ホバー・押している間の見せ方を決める・直すとき |
| [docs/extensions.md](extensions.md) | 採用アプリ固有のテーマ・部品・監査を足すとき、Ignite とアプリの所有範囲を確かめるとき |
| [docs/releasing.md](releasing.md) | 版を決める・変更履歴を書く・ステージングやプロダクションへ出すとき |
<!-- /索引 -->
