// ボタン類。見た目は styles/components/button.css。
// 主ボタン（primary）は 1 画面に 1 つまで。アイコンだけのボタンは必ず label（aria-label と data-tip）を付ける。

import { IconExternalLink } from '@tabler/icons-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

export function Button({ variant = 'default', icon, active = false, className = '', children, ...rest }: Native & { variant?: 'default' | 'primary'; icon?: ReactNode; active?: boolean }) {
  return (
    <button type="button" className={`btn ${variant === 'primary' ? 'pri' : ''} ${active ? 'on' : ''} ${className}`} {...rest}>
      {icon}
      {children}
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
