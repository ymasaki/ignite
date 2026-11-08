# 主要なデザインシステムとの比較

2026-10-30 の外部比較を基に、Ignite 側の対応と残りの候補を記録する。外部システムの現在の提供範囲を再調査した表ではない。部品を足すときは Ignite の対応欄も直す。現在の全公開部品は `src/index.ts`、規約は [DESIGN.md](../DESIGN.md)、動作例はカタログを参照する。

## 比べ方

- **公式の部品一覧で確かめた**: [Carbon](https://carbondesignsystem.com/components/overview/components/)（IBM。業務向けでデータの多い画面）、[Primer](https://primer.style/product/components/)（GitHub）、[Fluent 2](https://fluent2.microsoft.design/components/web/react/)（Microsoft）
- **一覧を読めず、部品の比較に使っていない**: Material 3、Polaris、Radix（公式ページを取得できなかった、または一覧が載っていなかった）。この 3 つは下の表の根拠に含めない
- 部品の名前は同じ役割で対応させた。「3 / 3」は 3 つのシステムのいくつにあるか
- 別の基盤の考え方: [Design Tokens 形式 2025.10](https://www.designtokens.org/)（W3C のコミュニティグループの最初の安定版。W3C 標準ではない）

## 部品

| 役割 | 主要システムでの名前（Carbon / Primer / Fluent） | 3 つのうち | 1.0.0 時点 | Ignite の対応（1.1.0 以降の追記を含む） |
|---|---|---|---|---|
| ボタン | Button | 3 | あり | 危険・処理中を追加 |
| チェック | Checkbox | 3 | **なし** | `Checkbox` |
| ラジオ | Radio button / RadioGroup / Radio group | 3 | **なし** | `RadioGroup` |
| 入/切 | Toggle / ToggleSwitch / Switch | 3 | **なし** | `Switch` |
| 入力欄の枠 | Form / FormControl / Field | 3 | **なし** | `FormField` |
| 文字の入力 | Text input / TextInput・Textarea / Input・Textarea | 3 | あり | `FormField` と組む |
| パスワードの入力 | Password input / — / — | 1 | **なし** | `PasswordField`（1.3.0） |
| 選択 | Select・Dropdown / Select / Select・Dropdown | 3 | あり | `disabled` を追加 |
| 候補から選ぶ | —（Dropdown）/ Autocomplete / Combobox | 2 | **なし** | `Combobox` |
| 数の入力 | Number input / — / Spin button | 2 | **なし** | `NumberField` |
| 日付 | Date picker / — / — | 1 | **なし** | `DatePicker`（業務の画面で要るため） |
| 窓 | Modal / Dialog / Dialog | 3 | **なし** | `Dialog` |
| 確認の窓 | —（Modal）/ ConfirmationDialog / — | 1 | **なし** | `ConfirmDialog` |
| 操作の一覧 | Menu・Menu buttons / ActionMenu / Menu | 3 | **なし** | `Menu` |
| 知らせ（消える） | Notification / — / Toast | 2 | **なし** | `toast` |
| 知らせ（残る） | Notification / Banner / Message bar | 3 | 注意だけ | `Notice` の `tone` |
| 読み込み | Loading・Inline loading / Spinner / Spinner | 3 | **なし** | `Spinner` |
| 進み具合 | Progress bar / ProgressBar / Progress bar | 3 | **なし** | `ProgressBar` |
| 段階 | Progress indicator / — / — | 1 | **なし** | `Steps` |
| ページ送り | Pagination / Pagination / — | 2 | **なし** | `Pagination` |
| 開閉の並び | Accordion / Details / Accordion | 3 | **なし** | `Accordion` |
| 表 | Data table / DataTable / — | 2 | 値だけ | 並べ替え・選択・空・読み込み |
| タブ・切り替え | Tabs・Content switcher / UnderlineNav・SegmentedControl / Tablist | 3 | あり | — |
| タグ | Tag / Label・Token / Tag・Badge | 3 | あり | 意味の色を追加 |
| 顔アイコン | — / Avatar・AvatarStack / Avatar・Avatar group | 2 | あり | — |
| パンくず | Breadcrumb / Breadcrumbs / Breadcrumb | 3 | あり | — |
| 重ねる小さなパネル | Popover / Popover / Popover | 3 | あり | 切れないよう反対側へ |
| 吹き出し | Tooltip / Tooltip / Tooltip | 3 | あり（`data-tip`） | — |
| 空の状態 | — / Blankslate / — | 1 | あり | — |
| 読み込みの形 | — / SkeletonBox ほか / Skeleton | 2 | あり | — |
| アプリの枠 | UI shell / PageLayout / Nav・Drawer | 3 | あり | — |
| 木の一覧 | Tree view / TreeView / Tree | 3 | **なし** | **未対応**（1.9.0 の `TreeChart` は線でつないだ図で、一覧の Tree view ではない） |
| つまみの入力 | Slider / — / Slider | 2 | **なし** | **未対応** |
| ファイルの添付 | File uploader / — / — | 1 | **なし** | **未対応** |
| 複数選択 | Multiselect / SelectPanel / Combobox | 3 | **なし** | **未対応**（`Checkbox` の並びで代用） |
| カード | Tile / Card / Card | 3 | 一部（`EntityRow`・`ChartCard`） | 意図して足さない（役割ごとの部品に分ける） |
| コード表示 | Code snippet / — / — | 1 | **なし** | `Code`・`CodeBlock`（1.3.0） |
| カルーセル・評価 | — / — / Carousel・Rating | 1 | **なし** | 対象外（業務の画面で使わない） |

## グラフ（1.7.0）

よくあるグラフの道具（[Chart.js](https://www.chartjs.org/docs/latest/charts/)・[Recharts](https://recharts.org/en-US/api)・[Apache ECharts](https://echarts.apache.org/en/option.html#series)）の種類と比べた。どれも 1 色の濃淡で描く。

| 種類 | Ignite |
|---|---|
| 折れ線・面 | `LineChart`（`area`）・`Sparkline` |
| 縦棒・系列を並べた縦棒 | `ColumnChart`（1.7.0） |
| 横棒 | `BarList` |
| 積み上げの棒 | `StackColumns` |
| 棒と折れ線の複合 | `ColumnChart` の `line`（1.7.0） |
| ヒストグラム | `ColumnChart` の `histogram`（1.7.0） |
| 円・ドーナツ | `PieChart`（1.7.0） |
| 散布図・バブル | `ScatterChart`（1.7.0） |
| レーダー | `RadarChart`（1.7.0） |
| ヒートマップ・カレンダー | `HeatMap`（1.7.0。カレンダーは `square`） |
| ゲージ | `Gauge`（1.7.0） |
| 滝（ウォーターフォール） | `Waterfall`（1.7.0） |
| 箱ひげ | `BoxPlot`（1.7.0） |
| ファネル | `Funnel` |
| ツリーマップ | `TileMap` |
| 鶏頭図（polar area）・放射状の棒 | 足さない（同じ値は `PieChart`・`BarList` のほうが比べやすい） |
| ローソク足 | 足さない（株価など金融の画面で、業務アプリの範囲の外。上げ下げを色相で分ける慣習が 1 色の決まりと合わない） |
| 動かして拡大縮小する図・ミニマップ | `Canvas`（1.9.0）。線でつないだツリーは `TreeChart`（1.9.0） |
| サンキー・サンバースト・ネットワーク図・平行座標・地図 | 足さない（配置の計算が大きく、使う画面が出てから。地図は地図の道具を使う） |
| 拡大・範囲の選択・データの書き出し | 足さない（ダッシュボードの読み取り用で、操作は画面側の絞り込みで行う） |

## 部品の外側

| 項目 | 主要システム | Ignite |
|---|---|---|
| 色のトークン | 役割で名付ける | あり。1.1.0 で危険の色を追加 |
| 余白・重なり・動きのトークン | あり | 1.1.0 で追加。既存の部品の余白はまだ数値のまま（`--z-*` は画面全体の重なりだけ置き換え済み）。検査はしない |
| コントラストの保証 | 文書の指針が中心 | **Ignite が強い**: 全スキン × ライト・ダーク × 強くの全組を描いて測る |
| 大きさへの対応 | 区切りの指針 | **Ignite が強い**: 寸法から計算し、監査で測る |
| 表示の補助（文字の大きさ・動き・下線など） | OS 任せが多い | **Ignite が強い**: 設定の画面まで持つ |
| 決まりの機械検査 | 一部（lint） | **Ignite が強い**: `ignite check` と描いた画面の監査 |
| 部品の一覧と実装の一致 | 手順で守る | 1.1.0 で `tests/coverage.test.ts` が止める |
| デザインツールとの連携（Figma の部品） | あり | **未対応**（コードが正本で、AI エージェントが読む運用のため優先度は低い） |
| トークンの機械で読める書き出し（Design Tokens 形式） | 広がりつつある | **未対応**（下の候補） |
| 部品の使い方の文書 | 部品ごとにページ | `DESIGN.md` の表とカタログ。引数の一覧は型定義だけ |
| 多言語・右から左の文字 | あり | **未対応**（日本語のアプリに絞っている） |
| 貢献の手順 | Carbon に公開の手順あり | `AGENTS.md` と `DESIGN.md` 11 章 |

## 残りの候補（優先度の順）

1. **複数選択**: `Combobox` の複数版。絞り込みの画面で要るので、最初に足す
2. **Tree**: 階層のある一覧。3 つとも持つが、使う画面が出てから足す
3. **Slider**・**ファイルの添付**: 使う画面が出てから足す
4. **トークンの書き出し**: `tokens.css` から Design Tokens 形式の JSON を作る。ほかの道具と連携するときに足す
5. **既存の部品の余白を `--space-*` へ置き換える**: 見た目は変わらないが差分が大きいので、部品を直すときに順に行う
6. **`ignite check` の注意を止める決まりにする**: 次の major で行う
