// ボタン類。見た目は styles/components/button.css。
// 主ボタン（primary）は 1 画面に 1 つまで。アイコンだけのボタンは必ず label（aria-label と data-tip）を付ける。

import { IconExternalLink } from '@tabler/icons-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Progress'

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

/** variant="danger" は取り消せない操作だけ（削除の確定など）。loading は処理中: 先頭のアイコンを回転に替え、押しても何も起きない（フォーカスは保ち、type="submit" でも送らない） */
export function Button({ type = 'button', variant = 'default', icon, active = false, loading = false, className = '', onClick, children, ...rest }: Native & { type?: 'button' | 'submit'; variant?: 'default' | 'primary' | 'danger'; icon?: ReactNode; active?: boolean; loading?: boolean }) {
  return (
    <button type={type} className={`btn ${variant === 'primary' ? 'pri' : variant === 'danger' ? 'danger' : ''} ${active ? 'on' : ''} ${loading ? 'busy' : ''} ${className}`} aria-busy={loading || undefined} aria-disabled={loading || undefined} onClick={loading ? (e) => e.preventDefault() : onClick} {...rest}>
      {loading ? <Spinner label="" /> : icon}
      {children != null && <span className="btn-l">{children}</span>}
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
