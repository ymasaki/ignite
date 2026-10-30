# 変更履歴

採用アプリは `npx ignite upgrade` でこの内容を確かめて取り込む。形式は [docs/releasing.md](docs/releasing.md)。

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
- `ignite check` の注意: `alert`・`confirm`・`prompt` とブラウザ標準の入力（止めない）

### 修正

- 重ねた `Drawer` がフォーカスの枠を出していた
- `Popover`・`Select` が下・右で切れるとき、反対側へ開く
- `Dialog` の中の `Popover` を Esc で閉じたときに、`Dialog` まで閉じないようにした

## 1.0.0（2026-10-30）

### 追加

- 最初の版
