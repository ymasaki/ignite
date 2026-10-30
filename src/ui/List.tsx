// 一覧の 1 行と、検索語の強調。見た目は styles/components/list.css。
// 行はホバーで --panel-2 の地、選択中（active）は --pri-soft の地。押すと詳しい中身を開く。

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

/**
 * 一覧の 1 行。左にアイコン（顔・アイコンの箱など）、中央に名前と補足（最大 2 行）、右に付加情報（状態のタグ・件数）。
 * size="lg" は格子に並べる大きい行。onClick などの操作を渡さなければ、押せない行（見た目は同じで、ホバーの地が出ない）
 */
export function EntityRow({
  lead,
  title,
  titleExtra,
  sub,
  sub2,
  trailing,
  active = false,
  size = 'md',
  className = '',
  ...rest
}: {
  lead: ReactNode
  title: ReactNode
  titleExtra?: ReactNode
  sub?: ReactNode
  sub2?: ReactNode
  trailing?: ReactNode
  active?: boolean
  size?: 'md' | 'lg'
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'>) {
  const cls = `erow ${size === 'lg' ? 'lg' : ''} ${active ? 'on' : ''} ${className}`
  const body = (
    <>
      {lead}
      <span className="er-b">
        <span className="er-t">
          <span className="er-title">{title}</span>
          {titleExtra}
        </span>
        {sub && <span className="er-s">{sub}</span>}
        {sub2 && <span className="er-s">{sub2}</span>}
      </span>
      {trailing && <span className="er-trail">{trailing}</span>}
    </>
  )
  // 押しても何も起きない行（操作のハンドラを 1 つも渡していない）はボタンにしない（押せる手がかり＝ホバーの地を出さない）
  // 選択中（詳細を開いている）は、見た目だけでなく読み上げにも伝える
  const current = active ? { 'aria-current': true as const } : {}
  if (!Object.keys(rest).some((k) => /^on[A-Z]/.test(k))) return <div className={`${cls} static`} {...current} {...(rest as HTMLAttributes<HTMLDivElement>)}>{body}</div>
  return (
    <button type="button" className={cls} {...current} {...rest}>
      {body}
    </button>
  )
}

/** 検索語を <mark> で強調 */
export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}
