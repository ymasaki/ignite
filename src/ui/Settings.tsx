// 設定の画面（DESIGN.md 7 章「画面の型」）。左メニューの下の「設定」（SettingsButton）で、内容の領域を設定の画面に切り替える。
// 画面は SettingsScreen の中に SettingGroup（まとまり）を並べ、その中に SettingRow（名前と選ぶ部品）を置く。
// ThemeSettings はどのアプリにも置くテーマ（テーマカラーとライト／ダーク。skin.ts。この端末に覚える）。見た目は styles/components/settings.css

import { IconChevronRight, IconDeviceDesktop, IconMoon, IconSettings, IconSun, type Icon } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

import { currentAssist, setAssist, type Assist } from '../assist'
import { currentTheme, setTheme, type Mode, type Skin, type Theme } from '../skin'
import { Segmented } from './Controls'
import { reducedMotion } from './Motion'

/**
 * 左メニューの下の「設定」。current: 設定の画面を開いている。collapsed: 左メニューを畳んでいる（アイコンだけにし、名前は吹き出しで出す）。
 * joined: すぐ下の欄（最終同期など）と同じまとまりにする（下の余白を詰める。下の欄は区切り線を付けない）
 */
export function SettingsButton({ current, onClick, collapsed = false, joined = false }: { current: boolean; onClick: () => void; collapsed?: boolean; joined?: boolean }) {
  return (
    <div className={`side-set ${joined ? 'joined' : ''}`}>
      <button type="button" aria-current={current ? 'page' : undefined} {...(collapsed ? { 'data-tip': '設定', 'aria-label': '設定' } : {})} onClick={onClick}>
        <IconSettings size={16} stroke={1.7} />
        <span className="side-t">設定</span>
      </button>
    </div>
  )
}

/**
 * 設定の画面の枠。ほかの画面と同じ 1 枚の面（.board）の中に、まとまりを縦に並べて面の中でスクロールする（面の角で切れるので、ヘッダーの下でぶつ切れにならない）。
 * footer は面の下端に固定する段（まとめて保存する画面の「保存」と知らせ。スクロールしても見える）
 */
export function SettingsScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="board settings-board">
      <div className="settings">{children}</div>
      {footer && <div className="settings-foot">{footer}</div>}
    </section>
  )
}

/** 設定のまとまり（見出しと行）。action は見出しの右の操作 */
export function SettingGroup({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="setting-group" aria-label={title}>
      <div className="setting-h">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * 設定の 1 行。左に名前（note は名前の下の補足。値そのものを書く）、右に選ぶ部品・値。
 * onClick を渡すと行ごと押せる（詳細を開く。右端に「>」を出し、開いているあいだは active）
 */
export function SettingRow({ label, note, children, onClick, active = false }: { label: ReactNode; note?: ReactNode; children?: ReactNode; onClick?: () => void; active?: boolean }) {
  const body = (
    <>
      <span className="setting-l">
        {label}
        {note && <small>{note}</small>}
      </span>
      <span className="setting-v">
        {children}
        {onClick && <IconChevronRight className="setting-go" size={16} stroke={1.7} aria-hidden="true" />}
      </span>
    </>
  )
  return onClick ? (
    <button type="button" className={`setting-row press ${active ? 'on' : ''}`} aria-expanded={active} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="setting-row">{body}</div>
  )
}

/** まとまりの中の自由な中身（入力欄・カードなど）。actions は下の右寄せの段（送信のボタンと知らせ）、note はその段の左に添える短い補足 */
export function SettingBody({ children, actions, note }: { children: ReactNode; actions?: ReactNode; note?: ReactNode }) {
  return (
    <div className="setting-body">
      {children}
      {(actions || note) && (
        <div className="setting-actions">
          {note && <span className="setting-note">{note}</span>}
          {actions}
        </div>
      )}
    </div>
  )
}

/** キーボードのキー（ショートカットの一覧） */
export function SettingKey({ children }: { children: ReactNode }) {
  return <kbd className="setting-key">{children}</kbd>
}

const SKIN_OPTIONS: { value: Skin; label: string }[] = [
  { value: 'red', label: 'レッド' },
  { value: 'blue', label: 'ブルー' },
  { value: 'green', label: 'グリーン' },
]
const mode = (value: Mode, label: string, I: Icon) => ({ value, label: <><I size={14} stroke={1.8} aria-hidden="true" />{label}</> })
const MODE_OPTIONS = [mode('light', 'ライト', IconSun), mode('dark', 'ダーク', IconMoon), mode('auto', '自動', IconDeviceDesktop)]

/** 切り替えを、画面全体のなめらかな入れ替わりで見せる（対応していないブラウザ・動きを減らす設定ではすぐ切り替える） */
function withFade(apply: () => void) {
  const start = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition
  if (start && !reducedMotion()) start.call(document, apply)
  else apply()
}

/**
 * テーマのまとまり（テーマカラーと表示モード）。テーマカラーは実際の色の丸で選ぶ。children でアプリの行を足せる。
 * onChange は切り替えたあとに呼ぶ（アプリがサーバーにも覚えるときなど）
 */
export function ThemeSettings({ children, onChange, value }: { children?: ReactNode; onChange?: (theme: Theme) => void; value?: Theme }) {
  // value を渡すと、その値を選択として出す（サーバーの値が届いて変わったとき。作り直さないので、押したボタンのフォーカスが残る）
  const [own, set] = useState<Theme>(currentTheme)
  const theme = value ?? own
  const change = (patch: Partial<Theme>) => {
    // 今の値は <html> から読む（続けて切り替えても、前の変更を取りこぼさない）
    const next = { ...currentTheme(), ...patch }
    withFade(() => setTheme(next))
    set(next)
    onChange?.(next)
  }
  return (
    <SettingGroup title="表示">
      <SettingRow label="テーマカラー">
        <span className="swatches" role="group" aria-label="テーマカラー">
          {SKIN_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={theme.skin === o.value} className="swatch" onClick={() => change({ skin: o.value })}>
              <i className={`sw sw-${o.value}`} aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </span>
      </SettingRow>
      <SettingRow label="表示モード">
        <Segmented label="表示モード" value={theme.mode} onChange={(mode) => change({ mode })} options={MODE_OPTIONS} />
      </SettingRow>
      {children}
    </SettingGroup>
  )
}

type Option<V extends string> = { value: V; label: string }
const opts = <V extends string>(...pairs: [V, string][]): Option<V>[] => pairs.map(([value, label]) => ({ value, label }))
const onOff = (v: boolean) => (v ? 'on' : 'off')
/** 補助の設定の行（名前・選択肢・今の値の読み方・変えたときの値）。既定は、どれも今の見た目のまま */
const ASSIST_ROWS: { key: keyof Assist; label: string; options: Option<string>[]; read: (a: Assist) => string; write: (v: string) => Partial<Assist> }[] = [
  { key: 'motion', label: '動きを減らす', options: opts(['auto', '端末に合わせる'], ['reduce', '減らす']), read: (a) => a.motion, write: (v) => ({ motion: v as Assist['motion'] }) },
  { key: 'contrast', label: 'コントラスト', options: opts(['auto', '端末に合わせる'], ['more', '強く']), read: (a) => a.contrast, write: (v) => ({ contrast: v as Assist['contrast'] }) },
  { key: 'text', label: '文字の大きさ', options: opts(['normal', '標準'], ['large', '大'], ['larger', '特大']), read: (a) => a.text, write: (v) => ({ text: v as Assist['text'] }) },
  { key: 'focus', label: 'フォーカスの枠', options: opts(['off', 'キーボードのとき'], ['on', 'いつも']), read: (a) => onOff(a.focus), write: (v) => ({ focus: v === 'on' }) },
  { key: 'underline', label: 'リンクの下線', options: opts(['off', 'なし'], ['on', 'あり']), read: (a) => onOff(a.underline), write: (v) => ({ underline: v === 'on' }) },
  { key: 'keys', label: '1 文字のショートカット', options: opts(['on', '使う'], ['off', '使わない']), read: (a) => onOff(a.keys), write: (v) => ({ keys: v === 'on' }) },
]

/**
 * アクセシビリティのまとまり（表示の補助。assist.ts）。選んだものはすぐ当て、この端末に覚える。
 * onChange は切り替えたあとに呼ぶ（アプリがサーバーにも覚えるときなど）。children でアプリの行を足せる
 */
export function AssistSettings({ children, onChange, value }: { children?: ReactNode; onChange?: (assist: Assist) => void; value?: Assist }) {
  // value は ThemeSettings と同じ（届いた値を、作り直さずに出す）
  const [own, set] = useState<Assist>(currentAssist)
  const assist = value ?? own
  const change = (patch: Partial<Assist>) => {
    const next = { ...currentAssist(), ...patch }
    withFade(() => setAssist(next))
    set(next)
    onChange?.(next)
  }
  return (
    <SettingGroup title="アクセシビリティ">
      {ASSIST_ROWS.map((r) => (
        <SettingRow key={r.key} label={r.label}>
          <Segmented label={r.label} value={r.read(assist)} onChange={(v) => change(r.write(v))} options={r.options} />
        </SettingRow>
      ))}
      {children}
    </SettingGroup>
  )
}
