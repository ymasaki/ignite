import { IconBell, IconBoxMultiple, IconChartDonut, IconClick, IconCode, IconForms, IconHome, IconLayoutDashboard, IconLayoutList, IconLogin2, IconPalette, IconRoute, IconTable, IconTypography, IconUsers, IconWaveSine } from '@tabler/icons-react'
import type { ReactNode } from 'react'

// カタログの目録。左メニュー・ページの目次・部品の検索・概要の件数は、すべてここから作る
export interface Spec {
  id: string
  title: string
  parts?: string[]
}
export interface PageDef {
  key: string
  label: string
  group?: string
  icon: ReactNode
  specs: Spec[]
}

const icon = (Icon: typeof IconHome) => <Icon size={18} stroke={1.8} />

export const PAGES: PageDef[] = [
  { key: 'overview', label: '概要', icon: icon(IconHome), specs: [] },
  { key: 'color', label: '色', group: '基礎', icon: icon(IconPalette), specs: [
    { id: 'brand', title: '主要色' },
    { id: 'surface', title: '地と線' },
    { id: 'state', title: '状態' },
    { id: 'ink', title: '文字' },
    { id: 'scale', title: 'グラフの濃淡' },
  ] },
  { key: 'type', label: '文字', group: '基礎', icon: icon(IconTypography), specs: [
    { id: 'sizes', title: '大きさ' },
    { id: 'faces', title: '書体の役割', parts: ['Code'] },
    { id: 'weights', title: '太さ' },
    { id: 'sample', title: '組み合わせ' },
  ] },
  { key: 'shape', label: '形と余白', group: '基礎', icon: icon(IconBoxMultiple), specs: [
    { id: 'radius', title: '角丸' },
    { id: 'shadow', title: '影' },
    { id: 'space', title: '余白' },
    { id: 'icons', title: 'アイコン' },
  ] },
  { key: 'motion', label: '動き', group: '基礎', icon: icon(IconWaveSine), specs: [
    { id: 'collapse', title: '押し下げて出す', parts: ['Collapse'] },
    { id: 'inline', title: '横の出し入れ', parts: ['CollapseInline'] },
    { id: 'list', title: '一覧の出し入れ', parts: ['AnimatedList'] },
    { id: 'rolling', title: '数の変化', parts: ['RollingNumber'] },
    { id: 'appear', title: '読み込みから中身へ', parts: ['Skeleton', 'Appear'] },
    { id: 'expand', title: '本文の開閉', parts: ['Expandable'] },
  ] },
  { key: 'actions', label: 'ボタン', group: '部品', icon: icon(IconClick), specs: [
    { id: 'button', title: 'ボタン', parts: ['Button'] },
    { id: 'icon', title: 'アイコンのボタン', parts: ['IconButton'] },
    { id: 'text', title: '文字のボタン', parts: ['LinkButton', 'ExternalLink', 'CopyText'] },
    { id: 'menu', title: '操作の一覧', parts: ['Menu'] },
    { id: 'popover', title: '小さなパネル', parts: ['Popover'] },
  ] },
  { key: 'navigate', label: '切り替えと移動', group: '部品', icon: icon(IconRoute), specs: [
    { id: 'segmented', title: '切り替え', parts: ['Segmented'] },
    { id: 'tabs', title: 'タブ', parts: ['Tabs'] },
    { id: 'stepper', title: '前後の送り', parts: ['MonthStepper', 'Stepper'] },
    { id: 'pagination', title: 'ページ送り', parts: ['Pagination'] },
    { id: 'crumbs', title: 'パンくず', parts: ['Crumbs'] },
    { id: 'steps', title: '手続きの段階', parts: ['Steps'] },
    { id: 'accordion', title: '開閉の並び', parts: ['Accordion'] },
  ] },
  { key: 'forms', label: 'フォーム', group: '部品', icon: icon(IconForms), specs: [
    { id: 'suggest', title: '候補を出す検索', parts: ['SearchSuggest'] },
    { id: 'field', title: '入力欄の枠', parts: ['FormField', 'TextField', 'TextArea'] },
    { id: 'search', title: '検索と並び順', parts: ['SearchField', 'Select'] },
    { id: 'number', title: '数', parts: ['NumberField'] },
    { id: 'pick', title: '候補と日付', parts: ['Combobox', 'DatePicker'] },
    { id: 'error', title: 'エラーの状態', parts: ['focusFirstInvalid'] },
    { id: 'radio', title: '1 つを選ぶ', parts: ['RadioGroup'] },
    { id: 'check', title: '入と切', parts: ['Checkbox', 'Switch'] },
  ] },
  { key: 'feedback', label: '知らせと確認', group: '部品', icon: icon(IconBell), specs: [
    { id: 'notice', title: '画面の知らせ', parts: ['Notice'] },
    { id: 'toast', title: '操作の結果', parts: ['toast'] },
    { id: 'dialog', title: '確認の窓', parts: ['Dialog', 'ConfirmDialog'] },
    { id: 'progress', title: '進み具合', parts: ['Spinner', 'ProgressBar'] },
    { id: 'empty', title: '空の状態', parts: ['EmptyState'] },
  ] },
  { key: 'marks', label: '人と印', group: '部品', icon: icon(IconUsers), specs: [
    { id: 'avatar', title: '顔アイコン', parts: ['Avatar'] },
    { id: 'avatars', title: '顔の並び', parts: ['AvatarGroup', 'AvatarStack', 'IconBox'] },
    { id: 'tag', title: 'タグ', parts: ['Tag'] },
    { id: 'chip', title: '取り消せるタグ', parts: ['Chip', 'Badge'] },
    { id: 'markpicker', title: 'マーカー', parts: ['MarkPicker'] },
  ] },
  { key: 'data', label: '一覧と表', group: '部品', icon: icon(IconTable), specs: [
    { id: 'rows', title: '一覧の行', parts: ['EntityRow', 'Highlight'] },
    { id: 'table', title: '値の表', parts: ['DataTable'] },
    { id: 'tablestate', title: '表の状態', parts: ['DataTable'] },
    { id: 'kv', title: '項目と本文', parts: ['Section', 'SubHeading', 'KeyValues', 'Prose'] },
    { id: 'bar', title: '内容の上の帯', parts: ['ScreenBar'] },
    { id: 'sideparts', title: '左メニューの部品', parts: ['SideStatus', 'SideAccount', 'SideIconButton'] },
  ] },
  { key: 'code', label: 'コード', group: '部品', icon: icon(IconCode), specs: [
    { id: 'lines', title: '行番号つき', parts: ['CodeBlock'] },
    { id: 'json', title: 'JSON' },
    { id: 'sql', title: 'SQL' },
    { id: 'shell', title: '命令' },
    { id: 'log', title: 'ログ' },
    { id: 'wrap', title: '折り返し' },
    { id: 'grid', title: '桁の確認' },
  ] },
  { key: 'charts', label: 'グラフと数字', group: '部品', icon: icon(IconChartDonut), specs: [
    { id: 'kpi', title: 'KPI', parts: ['Kpi', 'Delta'] },
    { id: 'stat', title: '大きな数字', parts: ['Stat', 'Sparkline'] },
    { id: 'line', title: '折れ線', parts: ['LineChart'] },
    { id: 'barlist', title: '横棒', parts: ['BarList'] },
    { id: 'stack', title: '積み上げ', parts: ['StackColumns'] },
    { id: 'funnel', title: '段ごとの減り方', parts: ['Funnel'] },
    { id: 'tile', title: '面積と濃さ', parts: ['TileMap'] },
  ] },
  { key: 'list', label: '一覧と詳細', group: '画面の型', icon: icon(IconLayoutList), specs: [] },
  { key: 'header', label: '検索欄のないヘッダー', group: '画面の型', icon: icon(IconLayoutList), specs: [] },
  { key: 'dashboard', label: 'ダッシュボード', group: '画面の型', icon: icon(IconLayoutDashboard), specs: [] },
  { key: 'login', label: 'ログイン', group: '画面の型', icon: icon(IconLogin2), specs: [] },
]

export const pageOf = (key: string) => PAGES.find((p) => p.key === key)
export const specOf = (page: string, id: string) => pageOf(page)?.specs.find((s) => s.id === id)
export const PART_COUNT = new Set(PAGES.flatMap((p) => p.specs.flatMap((s) => s.parts ?? []))).size
