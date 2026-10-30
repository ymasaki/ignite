// テーマ（スキンとライト／ダーク。DESIGN.md 2 章「スキンとダークモード」）。<html data-skin="…" data-mode="…"> の値で、
// styles/skins/ と styles/dark.css が色のトークンを差し替える。アプリは起動時に startTheme を呼び、切り替えは設定の画面の ThemeSettings（ui/Settings.tsx）に任せる。

/** スキンの名前（主要色）。先頭が既定（tokens.css の色）。ほかは styles/skins/<名前>.css */
export const SKINS = ['red', 'blue', 'green'] as const
export type Skin = (typeof SKINS)[number]
/** 表示モードの選び方。auto は端末（OS）の設定に合わせる。<html data-mode> に書くのは、決まった light / dark */
export const MODES = ['light', 'dark', 'auto'] as const
export type Mode = (typeof MODES)[number]
export interface Theme {
  skin: Skin
  mode: Mode
}
export const DEFAULT_THEME: Theme = { skin: SKINS[0], mode: MODES[0] }

/** URL のパラメータの名前（?skin=blue&mode=dark）と、この端末に覚える鍵 */
export const SKIN_PARAM = 'skin'
export const MODE_PARAM = 'mode'
const KEYS = { skin: 'ds.skin', mode: 'ds.mode' } as const

export const isSkin = (v: unknown): v is Skin => (SKINS as readonly unknown[]).includes(v)
export const isMode = (v: unknown): v is Mode => (MODES as readonly unknown[]).includes(v)

/** 使うテーマ: URL の指定 → この端末で前に選んだもの → 既定 の順（項目ごとに。知らない名前は飛ばす） */
export const pickTheme = (stored: Partial<Record<keyof Theme, string | null>> = {}, params: Record<string, string> = {}, fallback: Theme = DEFAULT_THEME): Theme => ({
  skin: isSkin(params[SKIN_PARAM]) ? (params[SKIN_PARAM] as Skin) : isSkin(stored.skin) ? stored.skin : fallback.skin,
  mode: isMode(params[MODE_PARAM]) ? (params[MODE_PARAM] as Mode) : isMode(stored.mode) ? stored.mode : fallback.mode,
})

/** 当てる先と保存先（テストでは偽物を渡す）。dark は端末がダークの設定か、watch は端末の設定が変わったときに呼んでもらう */
export interface ThemeEnv {
  root: { dataset: Record<string, string | undefined> }
  store: Pick<Storage, 'getItem' | 'setItem'> | null
  dark: () => boolean
  watch?: (cb: () => void) => void
}

const DARK_QUERY = '(prefers-color-scheme: dark)'
/** ブラウザの環境。保存先が使えないときは無いものとして扱う。画面のない環境（サーバー側での描画・計測）では、何も覚えない既定の環境 */
export function browserEnv(): ThemeEnv {
  if (typeof document === 'undefined') return { root: { dataset: {} }, store: null, dark: () => false }
  const localStore = (): ThemeEnv['store'] => {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }
  return {
    root: document.documentElement,
    store: localStore(),
    dark: () => window.matchMedia(DARK_QUERY).matches,
    watch: (cb) => window.matchMedia(DARK_QUERY).addEventListener('change', cb),
  }
}
const read = (env: ThemeEnv, key: string) => {
  try {
    return env.store?.getItem(key) ?? null
  } catch {
    return null
  }
}
const write = (env: ThemeEnv, key: string, value: string) => {
  try {
    env.store?.setItem(key, value)
  } catch {
    // 保存できなくても、この表示には当てる
  }
}

/** <html> に当てる。data-mode は決まった light / dark、選び方（auto を含む）は data-mode-pref に残す */
export function applyTheme(theme: Theme, env: ThemeEnv = browserEnv()): void {
  env.root.dataset.skin = theme.skin
  env.root.dataset.modePref = theme.mode
  env.root.dataset.mode = theme.mode === 'auto' ? (env.dark() ? 'dark' : 'light') : theme.mode
}

/** 今のテーマ（<html> の属性から。付いていなければ既定） */
export const currentTheme = (env: ThemeEnv = browserEnv()): Theme => pickTheme({ skin: env.root.dataset.skin, mode: env.root.dataset.modePref ?? env.root.dataset.mode })

/** テーマを切り替えて、この端末に覚える（設定の画面から） */
export function setTheme(theme: Theme, env: ThemeEnv = browserEnv()): void {
  applyTheme(theme, env)
  write(env, KEYS.skin, theme.skin)
  write(env, KEYS.mode, theme.mode)
}

/**
 * 起動時に呼ぶ。この端末で前に選んだテーマをすぐ当て、URL に skin・mode の指定があればそれに切り替えて覚える。
 * 「端末に合わせる」を選んでいるあいだは、端末の設定が変わったら当て直す。
 * params は URL のパラメータ（外側のページの URL を後から読む環境があるので、Promise でも受ける）
 */
export async function startTheme(params: Promise<Record<string, string>> | Record<string, string> = {}, env: ThemeEnv = browserEnv()): Promise<Theme> {
  const stored = () => ({ skin: read(env, KEYS.skin), mode: read(env, KEYS.mode) })
  applyTheme(pickTheme(stored()), env)
  env.watch?.(() => applyTheme(currentTheme(env), env))
  const p = await params
  const theme = pickTheme(stored(), p)
  if (isSkin(p[SKIN_PARAM])) write(env, KEYS.skin, theme.skin)
  if (isMode(p[MODE_PARAM])) write(env, KEYS.mode, theme.mode)
  applyTheme(theme, env)
  return theme
}
