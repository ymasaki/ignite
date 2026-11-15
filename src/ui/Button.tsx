// ボタン類。見た目は styles/components/button.css。
// 主ボタン（primary）は 1 画面に 1 つまで。アイコンだけのボタンは必ず label（aria-label と data-tip）を付ける。

import { IconExternalLink } from '@tabler/icons-react'
import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Spinner } from './Progress'
import { ariaShortcut, KeyCaps, parseShortcut, useShortcut } from './Shortcut'

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

/**
 * variant="danger" は取り消せない操作だけ（削除の確定など）。loading は処理中: 先頭のアイコンを回転に替え、押しても何も起きない（フォーカスは保ち、type="submit" でも送らない）。
 * type="submit" の loading は、幅を保ったまま文字を上へ抜き、ボタンの中央に回転を出す（送信中のボタンそのものを待ちの印にする）。
 * shortcut（「mod+k」「n」など）はキーのキャップを右に添え、そのキーで押す。押している間はキャップが沈み、ボタンも押した形になる
 */
export function Button({ type = 'button', variant = 'default', icon, active = false, loading = false, shortcut, className = '', onClick, children, ...rest }: Native & { type?: 'button' | 'submit'; variant?: 'default' | 'primary' | 'danger'; icon?: ReactNode; active?: boolean; loading?: boolean; shortcut?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const held = useShortcut(ref, shortcut)
  const parsed = shortcut ? parseShortcut(shortcut) : null
  // 文字のある送信のボタンだけ、ボタン全体を待ちの印にする（ほかの処理中は先頭のアイコンだけを替える）
  const sending = type === 'submit' && children != null
  return (
    <button ref={ref} type={type} className={`btn ${variant === 'primary' ? 'pri' : variant === 'danger' ? 'danger' : ''} ${active ? 'on' : ''} ${loading ? 'busy' : ''} ${sending && loading ? 'sending' : ''} ${held.has('key') ? 'keyed' : ''} ${className}`} aria-busy={loading || undefined} aria-disabled={loading || undefined} aria-keyshortcuts={parsed ? ariaShortcut(parsed) : undefined} onClick={loading ? (e) => e.preventDefault() : onClick} {...rest}>
      {loading && !sending ? <Spinner label="" /> : icon}
      {children != null && <span className="btn-l">{children}</span>}
      {shortcut && <KeyCaps shortcut={shortcut} held={held} />}
      {sending && <span className="btn-wait" aria-hidden="true"><Spinner label="" /></span>}
    </button>
  )
}

/** アイコンだけのボタン。label は読み上げとツールチップの両方に使う */
export function IconButton({ label, tip = label, size = 'md', className = '', children, ...rest }: Native & { label: string; tip?: string; size?: 'md' | 'lg' }) {
  return (
    <button type="button" className={`icon-btn ${size === 'lg' ? 'lg' : ''} ${className}`} aria-label={label} data-tip={tip} {...rest}>
      {children}
    </button>
  )
}

/** 文字だけのリンク風ボタン（「すべて見る」「既定に戻す」など） */
export function LinkButton({ className = '', children, ...rest }: Native) {
  return (
    <button type="button" className={`linkbtn ${className}`} {...rest}>
      {children}
    </button>
  )
}

/** 外部のページ（Confluence の原本など）へのリンク。新しいタブで開き、末尾に外部リンクのアイコン */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="linkbtn extlink" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <IconExternalLink size={14} stroke={1.8} aria-hidden="true" />
    </a>
  )
}
