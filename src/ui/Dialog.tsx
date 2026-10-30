// 画面の操作を止めて答えを求める窓。見た目は styles/components/overlay.css。
// ブラウザの <dialog> を使う（フォーカスの閉じ込め・背面の無効化・Esc・開いた元へのフォーカスの返却をブラウザに任せる）。

import { IconX } from '@tabler/icons-react'
import { useId, useLayoutEffect, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FOCUSABLE, useScrollFocus } from './A11y'
import { Button, IconButton } from './Button'
import { reducedMotion } from './Motion'

/**
 * 重ねて答えを待つ窓。詳細を見せるだけなら詳細パネルを使う。footer に操作を置く（主ボタンは右端）。
 * 開くと、中の data-autofocus の要素か最初の入力欄へフォーカスを移す。dismissable を切ると、Esc と外側のクリックでは閉じない
 */
export function Dialog({ open, onClose, title, footer, size = 'md', dismissable = true, alert = false, children }: { open: boolean; onClose: () => void; title: string; footer?: ReactNode; size?: 'md' | 'lg'; dismissable?: boolean; alert?: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [shown, setShown] = useState(open)
  const [closing, setClosing] = useState(false)
  if (open && !shown) setShown(true)
  if (open && closing) setClosing(false)
  useScrollFocus(body, title)
  useLayoutEffect(() => {
    const d = ref.current
    if (!open || !d || d.open) return
    d.showModal()
    const first = d.querySelector<HTMLElement>('[data-autofocus]') ?? d.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled])')
    const target = first ?? (alert ? d.querySelector<HTMLElement>(`.dlg-foot :is(${FOCUSABLE})`) : null) ?? d
    target.focus()
  }, [open, shown, alert])
  // 閉じる動きを見せてから閉じる（6 章）
  useEffect(() => {
    if (open || !shown) return
    if (reducedMotion()) return finish()
    setClosing(true)
  }, [open, shown])
  function finish() {
    ref.current?.close()
    setShown(false)
    setClosing(false)
  }
  if (!shown) return null
  // body の直下に描く（親の inert や余白の計算の影響を受けないように）
  return createPortal(
    <dialog
      ref={ref}
      className={`dialog ${size}${closing ? ' closing' : ''}`}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissable) onClose()
      }}
      onClick={(e) => e.target === ref.current && dismissable && onClose()}
      onAnimationEnd={(e) => e.target === ref.current && closing && finish()}
    >
      <div className="dlg-in">
        <div className="dlg-head">
          <h2 id={titleId}>{title}</h2>
          {dismissable && !alert && <IconButton label="閉じる" onClick={onClose}><IconX size={16} stroke={1.8} /></IconButton>}
        </div>
        {children != null && <div className="dlg-body" ref={body}>{children}</div>}
        {footer && <div className="dlg-foot">{footer}</div>}
      </div>
    </dialog>,
    document.body,
  )
}

/**
 * 取り消せない操作の確認。title は「〜しますか」で何が起きるかを書き、確定のボタンは動詞にする（「はい」にしない）。
 * danger の確定は、誤って Enter で実行しないよう、はじめのフォーカスを取り消しのほうに置く。loading は処理中
 */
export function ConfirmDialog({ open, title, confirmLabel, cancelLabel = 'やめる', danger = false, loading = false, onConfirm, onCancel, children }: { open: boolean; title: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode }) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      alert
      dismissable={!loading}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading} data-autofocus={danger ? true : undefined}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm} data-autofocus={danger ? undefined : true}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
