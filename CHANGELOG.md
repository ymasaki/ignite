# 変更履歴

採用アプリは `npx ignite upgrade` でこの内容を確かめて取り込む。形式は [docs/releasing.md](docs/releasing.md)。

## 未リリース

### 追加

- 大きさへの対応と左メニューの部品を追加。`CollapseInline`（横の出し入れ）、`useFitCount`・`fitSlots`（入る数だけ出して「+N」）、`AvatarStack`・`fitAvatars`・`keepVisible`（`.avstack` の部品本体）、`SideStatus`・`SideAccount`・`SideIconButton`・`SIDE_ICON_SIZE`、左メニューの形で中身を入れ替える `data-side="wide"` / `"rail"`
- 監査の既定の幅に狭いスマホ（320×568）とスマホの横向き（844×390）を追加。操作なしの全画面を開いたまま窓を連続で変えて測る監査（`sweepSizes`。外すときは `sweepSkip`）と、枠に切られた中身の測定を追加。既存の画面に新しい指摘が出ることがある
- 帯の余白のトークン `--bar-y`・`--bar-x`・`--bar-gap`・`--bar-row` を追加し、`ScreenBar` の余白と間を窓に合わせて詰めるようにした（広い窓の余白は 12×16 → 10×14px、間は 8 → 14px）
- ログインの画面の型 `AuthScreen` と入力 `LoginForm`、パスワードの欄 `PasswordField` を追加
- `TextField` に `type`・`autoComplete`・`name`・`autoCapitalize`、`Button` に `type="submit"` を追加。既存の使い方は変わらない
- 書体を役割で分けた。本文・見出し・UI は M PLUS 1p、数字（`.num`）は Inter、コードは JetBrains Mono（`--font`・`--font-num`・`--font-code`）。Google Fonts から読むには `index.html` の `<head>` に `templates/app/index.html` の `<link>` を足す。足さなくても端末の書体で動き、`ignite check` が注意を出す
- 文中のコードの `Code` と、複数行のコードの `CodeBlock`（色分け・コピー・行番号・折り返し・行数の上限。和文は半角 2 桁にそろえる）
- `ignite check` が CSS の `font-family` の直書きを注意する
- `withFade` を公開した。`withFade(() => setTheme(next))` で、`ThemeSettings` と同じ 0.3s のフェードで切り替えられる。カタログのテーマの切り替えもフェードする

### 修正

- 低い画面（スマホの横向き・狭いスマホ）で `Popover` が上下どちらにも入らず切れるのを直した（`DatePicker` の月の見出しや下端が見えなかった）。窓の中央に重ねて、中でスクロールする
- 左メニューを畳むと押せる `Brand` の読み上げの名前がなくなるのを直した
- `DESIGN.md` の `AppShell` の説明の、左メニューを引き出しにする幅を実装どおり 600px に直した
- カタログ監査をMac共通ロックで直列化し、監査サーバーと子プロセスの終了後に解放する。通常表示の5199は維持する

- `DatePicker` のアイコンが開くと逆さまになるのを直し、日付の数字を曜日の列の中央にそろえた
- 左メニューの設定の上に線が二重に出るのを直した
- ひな形の `SettingsButton` を `foot` から `side` の `SideNav` の直後へ移した。線の重なりをなくし、畳んでも設定が残り、引き出しは押すと閉じる。`foot` に入れているアプリは同じように移す（`ignite check` が注意するが止めない）
- 端に近いグラフの吹き出しが窓の外へ見切れるのを直した
- 狭い窓で `AppShell` の検索欄の左端が、下の内容の左端とずれるのを直した。つまみをよけるのは画面名だけにし、検索欄は1段目に空きがあれば画面名の隣に置く（収まらなければ2段目で内容の左端にそろう）
- `Delta` を太字にしない
- `NumberField` の − ＋ にも `data-tip` を付けた
- `PanelHeader` の `actions` に文字のあるボタンを置くと補足に重なるのを直した。そのときは上段を見出しの上の行にする。アイコンだけのときの見た目は変わらない
- `Button` の文字を `.btn-l` の `<span>` で包むようにした。アプリの CSS で `.btn > 子要素` と直下を指しているときは書き換える
- `PanelHeader` の固定ヘッダーで名前を省略しないようにした。入らなければ 2 行にし、`actions` のアイコンのある文字ボタンはアイコンだけにする（文字は吹き出しと読み上げに残る）
- カタログの詳細パネルを `DESIGN.md` の形に合わせた。`Tabs` を `PanelFrame` の直下へ移してアイコンとの余白を 16px にし、`actions` の見本を任意のボタンに替え、スクロールで固定ヘッダーが出る長さの本文を足した
- 監査の `reveals` が、`PanelHeader` の `actions` の押せない写し（固定ヘッダーの `inert`）を押そうとして止まるのを直した

### 追加

- `SideNav` の項目に `group`（まとまりの見出し）を足した
- `SearchSuggest`（検索欄の下に候補を出す部品）と、かな・ローマ字の照合の関数（`searchKey`・`queryTerms`・`matchTerms` など）を足した

### 変更

- `DESIGN.md` に「面の中に角丸の枠のカードを重ねない」を足した
- `SideNav` の選択中の地が、押した項目へ `Segmented` と同じばねでスライドする
- `Pagination` の選択中の地が、押したページへスライドする
- `LineChart` はホバーした点に印と縦線を出す。`BarList`・`StackColumns` はホバーした要素以外を薄くする
- `DataTable` はホバーした行の地を変える。`Highlight`（`mark`）は濃い黄色・太字・下線にした
- `AvatarGroup` のホバーの拡大をなめらかに動かす

## 1.2.2（2026-11-02）

### 修正

- 既存公開APIによるテーマ・アダプタ部品・固有監査の拡張ガイドと、任意でコピーする統合例を追加
- 配布例の更新・規約同期後もアプリ所有ファイルと固有違反検出が保たれることを通し確認

## 1.2.1（2026-11-02）

### 修正

- テーマCSSでも区切り内の余白変更と既存部品の上書きを検査。色トークンの定義は引き続き許可

## 1.2.0（2026-11-02）

### 追加

- 画面監査にaxe専用の前処理・復元と、段組みの一部を採用側の測定で置換する設定を追加。設定なしの既存監査は維持

### 修正

- サブディレクトリからの `ignite check --staged` でもGitのindexを読めるよう修正
- 固定版の相対vendor配布とPrivate Packagesへの切替条件を明記
- 配布の通し確認に、空キャッシュ・スクリプト無効でのlockfile復元と公開入口の検証を追加

## 1.1.1（2026-10-31）

### 修正

- 配布前にビルドする `prepack` と Node.js 22.12.0 以上の要件を追加
- `init` で規約同期・更新の npm スクリプトも追加（既存の設定は保持）
- 非公開パッケージの認証、ひな形の依存、更新の確定と公開前の試用手順を明記

## 1.1.0（2026-10-30）

### 追加

- フォームの部品: `FormField`・`Checkbox`・`RadioGroup`・`Switch`・`NumberField`・`Combobox`・`DatePicker`
- 確認と知らせの部品: `Dialog`・`ConfirmDialog`・`toast`（`Toaster` は `AppShell` が置く）・`Spinner`・`ProgressBar`
- 移動の部品: `Menu`・`Pagination`・`Accordion`・`Steps`
- `Button` の `variant="danger"` と `loading`、`Tag` の `ok`・`warn`・`danger`、`Notice` の `tone`、`Select` の `disabled`
- `DataTable` の並べ替え・行の選択・`empty`・`loading`
- トークン: `--danger*`、`--on-danger`、`--space-*`、`--z-*`、`--dur-*`
- `focusFirstInvalid()`
- `TextField`・`TextArea`・`Select` は `FormField` の中で `label` を省ける
- `ignite check` の注意: `alert`・`confirm`・`prompt` とブラウザ標準の入力、新しい部品のクラスの上書き（どれも止めない）

### 修正

- 重ねた `Drawer` がフォーカスの枠を出していた
- `Popover`・`Select` が下・右で切れるとき、反対側へ開く
- `Select` の一覧を開いているあいだに親が描き直すと、選択中の項目へフォーカスが戻っていた
- `Dialog` の中の `Popover` を Esc で閉じたときに、`Dialog` まで閉じないようにした

## 1.0.0（2026-10-30）

### 追加

- 最初の版
