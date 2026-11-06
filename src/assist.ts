// 表示の補助（DESIGN.md 12 章「アクセシビリティ」の設定）。テーマ（skin.ts）と同じく <html> の属性で当て、CSS がトークンと見せ方を差し替える。
// 既定はどれも今の見た目のまま（マウスで見る人の見た目と操作を変えない）。選んだ人にだけ効く。この端末に覚え、アプリはサーバーにも覚える。
//   data-motion="reduce"   動きを止める（端末の「視差効果を減らす」でも付く）         base.css・Motion.tsx の reducedMotion()
//   data-contrast="more"   文字・枠のコントラストを強める（端末の「コントラストを上げる」でも付く） styles/assist.css
//   data-text="large|larger" 文字だけを大きくする（枠の寸法は変えない）                tokens.css の --text-scale
//   data-focus="always"    マウスで押したあとも、フォーカスの枠を出す                  styles/assist.css
//   data-underline="on"    押せる文字（名前・リンク）に下線を付ける              styles/assist.css
//   data-keys="off"        1 文字のショートカット（F・[ など）を切る（音声入力の誤作動を防ぐ。WCAG 2.1.4）  shortcutsOn()

import { startTips } from './ui/tip'

export const MOTIONS = ['auto', 'reduce'] as const
export const CONTRASTS = ['auto', 'more'] as const
export const TEXT_SIZES = ['normal', 'large', 'larger'] as const
/** 文字の大きさの倍率（tokens.css の --text-scale と同じ値） */
export const TEXT_SCALE: Record<(typeof TEXT_SIZES)[number], number> = { normal: 1, large: 1.125, larger: 1.25 }

export interface Assist {
  motion: (typeof MOTIONS)[number]
  contrast: (typeof CONTRASTS)[number]
  text: (typeof TEXT_SIZES)[number]
  /** フォーカスの枠をいつも出す */
  focus: boolean
  /** 押せる文字に下線 */
  underline: boolean
  /** 1 文字のショートカットを使う */
  keys: boolean
}
export const DEFAULT_ASSIST: Assist = { motion: 'auto', contrast: 'auto', text: 'normal', focus: false, underline: false, keys: true }

const KEY = 'ds.assist'
const QUERIES = { motion: '(prefers-reduced-motion: reduce)', contrast: '(prefers-contrast: more)' } as const

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** 覚えていた値・サーバーの値を読む。知らない値・足りない項目は既定にする（新しい版で項目が増えても、古い値で壊れない） */
export function parseAssist(raw: unknown): Assist {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_ASSIST
  return {
    motion: oneOf(MOTIONS, r.motion, d.motion),
    contrast: oneOf(CONTRASTS, r.contrast, d.contrast),
    text: oneOf(TEXT_SIZES, r.text, d.text),
    focus: bool(r.focus, d.focus),
    underline: bool(r.underline, d.underline),
    keys: bool(r.keys, d.keys),
  }
}

export const sameAssist = (a: Assist, b: Assist): boolean => (Object.keys(DEFAULT_ASSIST) as (keyof Assist)[]).every((k) => a[k] === b[k])

/** 既定から変えている項目の数（設定の画面・利用状況の集計で数える） */
export const assistChanged = (a: Assist): (keyof Assist)[] => (Object.keys(DEFAULT_ASSIST) as (keyof Assist)[]).filter((k) => a[k] !== DEFAULT_ASSIST[k])

/** 当てる先と保存先（テストでは偽物を渡す）。query はメディアクエリが当たるか、watch は当たり方が変わったときに呼んでもらう */
export interface AssistEnv {
  root: { dataset: Record<string, string | undefined> }
  store: Pick<Storage, 'getItem' | 'setItem'> | null
  query: (q: string) => boolean
  watch?: (q: string, cb: () => void) => void
  watchInput?: (cb: (pointer: boolean) => void) => void
}

export function assistEnv(): AssistEnv {
  if (typeof document === 'undefined') return { root: { dataset: {} }, store: null, query: () => false }
  let store: AssistEnv['store'] = null
  try {
    store = window.localStorage
  } catch {
    // 保存できない環境では覚えない
  }
  return {
    root: document.documentElement, store, query: (q) => window.matchMedia(q).matches,
    watch: (q, cb) => window.matchMedia(q).addEventListener('change', cb),
    watchInput: (cb) => {
      // 部品がフォーカスを移すより先に反映する。修飾キーだけ・IMEの変換中は切り替えない。
      document.addEventListener('pointerdown', () => cb(true), true)
      document.addEventListener('keydown', (e) => {
        if (!e.isComposing && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) cb(false)
      }, true)
    },
  }
}

const set = (root: AssistEnv['root'], name: string, value: string | false) => {
  if (value) root.dataset[name] = value
  else delete root.dataset[name]
}

/** <html> に当てる。motion・contrast の auto は端末の設定を見て、決まった値だけを属性に書く（CSS は属性だけを見ればよい） */
export function applyAssist(a: Assist, env: AssistEnv = assistEnv()): void {
  const r = env.root
  r.dataset.assist = JSON.stringify(a)
  set(r, 'motion', (a.motion === 'reduce' || env.query(QUERIES.motion)) && 'reduce')
  set(r, 'contrast', (a.contrast === 'more' || env.query(QUERIES.contrast)) && 'more')
  set(r, 'text', a.text !== 'normal' && a.text)
  set(r, 'focus', a.focus && 'always')
  set(r, 'underline', a.underline && 'on')
  set(r, 'keys', !a.keys && 'off')
}

/** 今の補助の設定（<html> から。付いていなければ既定） */
export function currentAssist(env: AssistEnv = assistEnv()): Assist {
  try {
    return parseAssist(JSON.parse(env.root.dataset.assist || '{}'))
  } catch {
    return DEFAULT_ASSIST
  }
}

/** 切り替えて、この端末に覚える（設定の画面から・サーバーの値が届いたとき） */
export function setAssist(a: Assist, env: AssistEnv = assistEnv()): void {
  applyAssist(a, env)
  try {
    env.store?.setItem(KEY, JSON.stringify(a))
  } catch {
    // 覚えられなくても、この表示には当てる
  }
}

/** 起動時に呼ぶ。この端末で前に選んだものをすぐ当て、端末の設定（動き・コントラスト）が変わったら当て直す */
export function startAssist(env: AssistEnv = assistEnv()): Assist {
  let stored: unknown
  try {
    stored = JSON.parse(env.store?.getItem(KEY) || 'null')
  } catch {
    stored = null // 読めない・壊れた値は既定
  }
  const a = parseAssist(stored)
  applyAssist(a, env)
  for (const q of Object.values(QUERIES)) env.watch?.(q, () => applyAssist(currentAssist(env), env))
  // 入力欄からの focus() に :focus-visible が引き継がれても、枠は操作方法に合わせる（保存しない）。
  env.watchInput?.((pointer) => set(env.root, 'input', pointer && 'pointer'))
  // 吹き出しを窓に収める（どのアプリも起動で startAssist を呼ぶので、ここで始める）
  if (env.watchInput) startTips()
  return a
}

/** 1 文字のショートカットを受けてよいか（設定で切っていれば false） */
export const shortcutsOn = (env: Pick<AssistEnv, 'root'> = assistEnv()): boolean => env.root.dataset.keys !== 'off'
