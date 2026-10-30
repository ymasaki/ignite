// 色のコントラストの決まり（DESIGN.md 2 章「コントラスト」）。文字と地・部品と地のトークンの組ごとに、下回ってはいけない比を持つ。
// どのスキン・表示モードでも満たす（デザインの監査が、実際に描いた色で全部の組み合わせを測る）。色を足す・変えるときはここに組を足す。

import type { Skin } from './skin'

export type Rgb = [number, number, number]

/** 相対輝度（WCAG 2.x。0〜1） */
const luminance = ([r, g, b]: Rgb) => {
  const lin = (v: number) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** コントラスト比（1〜21。順番は問わない） */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** 文字は 4.5 以上、アイコン・枠・グラフなど文字でないものと大きな文字は 3 以上（WCAG 2.x の AA） */
export const CONTRAST_TEXT = 4.5
export const CONTRAST_UI = 3

export interface ContrastRule {
  /** 前に出る色と地のトークン */
  fg: string
  bg: string
  min: number
  /** どこで使う組か */
  use: string
  /** スキンごとの例外（その比まで許す。理由は DESIGN.md 2 章に書く） */
  except?: Partial<Record<Skin, number>>
}

const text = (fg: string, bg: string, use: string): ContrastRule => ({ fg, bg, min: CONTRAST_TEXT, use })
const ui = (fg: string, bg: string, use: string, except?: ContrastRule['except']): ContrastRule => ({ fg, bg, min: CONTRAST_UI, use, except })
/** ブランドの緑（#00c093）は明るく、白い地の上で 3 に届かない（約 2.3、薄い緑の地の上で約 2.1）。緑のテーマのライトだけ、色だけに頼らない部品（アイコン・選択の枠・グラフ）に限って許す */
const GREEN = { green: 2 }

export const CONTRAST_RULES: ContrastRule[] = [
  text('--ink', '--panel', '本文'),
  text('--ink', '--bg', '画面の地の上の本文・見出し'),
  text('--ink-2', '--panel', '補足'),
  text('--ink-2', '--bg', '画面の地の上の補足'),
  text('--ink-3', '--panel', 'ラベル・件数'),
  text('--ink-3', '--panel-2', '沈んだ地の上のラベル（表の見出し、切り替えの選んでいない項目）'),
  text('--ink-3', '--bg', '画面の地の上のラベル'),
  text('--ink', '--hover', 'ホバーした行・項目の本文'),
  text('--ink-2', '--hover', 'ホバーした行・項目の補足'),
  text('--ink-3', '--hover', 'ホバーした行・項目のラベル・件数'),
  text('--ink', '--hover-strong', 'ホバーした切り替え・タブの項目'),
  text('--ink-3', '--hover-strong', 'ホバーした切り替え・タブの項目の件数'),
  text('--ink', '--press', '押している行・項目の本文'),
  text('--ink-2', '--press', '押している行・項目の補足'),
  text('--ink-3', '--press', '押している行・項目のラベル・件数'),
  text('--pri-ink', '--panel', '主要色の文字'),
  text('--pri-ink', '--pri-soft', '薄い主要色の地の上の文字（選択中のメニュー、タグ）'),
  text('--ink-3', '--pri-soft', '選択中の行の補足（メニュー・一覧・設定の行・押した KPI）'),
  text('--ok-ink', '--panel', '肯定の数字（前の週より増えた）'),
  text('--warn', '--panel', '注意の数字（前の週より減った）'),
  text('--pri-ink-2', '--pri-soft-2', '一段濃い主要色の地の上の文字'),
  text('--pri-ink-2', '--thumb', '切り替え・タブの選択中'),
  text('--pri-ink-2', '--pri-press', '押している、押し込まれた部品・文中のリンク'),
  text('--link', '--panel', '文字だけのリンク'),
  text('--link-press', '--panel', '押している文字だけのリンク'),
  text('--on-solid', '--solid', '主ボタン・バッジ'),
  text('--on-solid', '--solid-hover', '主ボタンのホバー'),
  text('--on-solid', '--solid-press', '押している主ボタン'),
  text('--on-tip', '--tip', '吹き出し'),
  text('--ok-ink', '--ok-soft', '肯定のタグ'),
  text('--warn', '--warn-soft', '注意'),
  text('--ink', '--hl', '検索語のハイライト'),
  ...[1, 2, 3, 4, 5].flatMap((n) => [
    text('--ink', `--mark-${n}`, 'マーカー色の地の上の本文'),
    text('--ink-2', `--mark-${n}`, 'マーカー色の地の上の補足（コメント）'),
    text('--ink-3', `--mark-${n}`, 'マーカー色の地の上のラベル・件数'),
    ui(`--mark-${n}-line`, '--panel', 'マーカー色の見本・枠'),
  ]),
  ui('--on-solid', '--solid-bright', '押した KPI のアイコン'),
  ui('--on-pri', '--pri', '主要色の地の上の大きな数字・アイコン'),
  ui('--pri', '--panel', 'アイコン・選択の枠', GREEN),
  ui('--pri', '--pri-soft', '薄い主要色の地の上のアイコン', GREEN),
  ui('--chart-1', '--panel', 'グラフの線・棒', GREEN),
  ui('--focus', '--panel', 'フォーカスの枠'),
  ui('--focus', '--bg', '画面の地の上のフォーカスの枠'),
]

/** 設定の「コントラストを強く」（assist.ts・styles/assist.css）の文字の比（WCAG 1.4.6 AAA） */
export const CONTRAST_TEXT_MORE = 7
/** 強くしたときだけ見る組（ふだんは区切りを淡くして、形と余白で見せる） */
const MORE_ONLY: ContrastRule[] = [
  ui('--line-2', '--panel', '入力欄・ボタン・カードの枠'),
  ui('--line-2', '--bg', '画面の地の上の枠'),
]
/**
 * 表示の補助に合わせた決まり。more（コントラストを強く）では、文字を 7 以上にし、スキンの例外（緑）をなくし、枠の組を足す。
 * 文字でないもの（アイコン・枠）は 3 のまま（AAA にも上の段がない）
 */
export function contrastRulesFor(more: boolean): ContrastRule[] {
  if (!more) return CONTRAST_RULES
  return [...CONTRAST_RULES.map((r) => ({ ...r, min: r.min === CONTRAST_TEXT ? CONTRAST_TEXT_MORE : r.min, except: undefined })), ...MORE_ONLY]
}
