# 変更履歴

採用アプリは `npx ignite upgrade` でこの内容を確かめて取り込む。形式は [docs/releasing.md](docs/releasing.md)。

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
