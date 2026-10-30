// 操作の結果の短い知らせ。見た目は styles/components/overlay.css。
// どこからでも toast() で出せる（AppShell が Toaster を置く）。結果が画面で見えるときは出さない（8 章）。

import { IconAlertCircle, IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { announce } from './A11y'
import { IconButton, LinkButton } from './Button'

export type ToastTone = 'info' | 'ok' | 'danger'
export interface ToastOptions {
  tone?: ToastTone
  /** 「元に戻す」など 1 つだけ。これが要る知らせは消えるまでを長くする */
  action?: { label: string; onClick: () => void }
  /** 消えるまでの ms。null は × で閉じるまで残す（danger の既定） */
  duration?: number | null
}
type Item = ToastOptions & { id: number; text: string; closing?: boolean }

const MAX = 3
let items: Item[] = []
let seq = 0
const listeners = new Set<() => void>()
const set = (next: Item[]) => {
  items = next
  listeners.forEach((l) => l())
}

/** 知らせを出す（読み上げにも知らせる）。返り値は dismissToast に渡す番号 */
export function toast(text: string, options: ToastOptions = {}): number {
  const id = ++seq
  // 3 つまで。あふれたら古いものから（閉じるまで残す知らせも同じ）
  set([...items, { ...options, id, text }].slice(-MAX))
  announce(text, { assertive: options.tone === 'danger' })
  return id
}

/** 閉じる動きのあとで消す */
export const dismissToast = (id: number) => set(items.map((t) => (t.id === id ? { ...t, closing: true } : t)))

const ICONS = { info: IconInfoCircle, ok: IconCircleCheck, danger: IconAlertCircle }

/** 消えるまでの ms。読む時間と押す時間を取る（WCAG 2.2.1。載せている・フォーカスがあるあいだは止める） */
export const toastDuration = (o: ToastOptions) => (o.duration !== undefined ? o.duration : o.tone === 'danger' ? null : o.action ? 8000 : 5000)

function ToastCard({ item }: { item: Item }) {
  const { id, text, tone = 'info', action, closing } = item
  const Icon = ICONS[tone]
  const wait = toastDuration(item)
  const timer = useRef(0)
  // 載せている・フォーカスがある、のどちらかが続くあいだは止める
  const held = useRef({ hover: false, focus: false })
  const stop = () => window.clearTimeout(timer.current)
  const start = () => {
    stop()
    if (wait != null && !held.current.hover && !held.current.focus) timer.current = window.setTimeout(() => dismissToast(id), wait)
  }
  const hold = (k: 'hover' | 'focus', on: boolean) => {
    held.current[k] = on
    if (on) stop()
    else start()
  }
  // 出たときに一度だけ数え始める（ほかの知らせで描き直されても、止めているあいだは動かさない）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => (start(), stop), [])
  return (
    <div className={`toast ${tone}${closing ? ' closing' : ''}`} inert={closing} onPointerEnter={() => hold('hover', true)} onPointerLeave={() => hold('hover', false)} onFocus={() => hold('focus', true)} onBlur={() => hold('focus', false)} onAnimationEnd={(e) => e.target === e.currentTarget && closing && set(items.filter((t) => t.id !== id))}>
      <Icon size={16} stroke={1.8} aria-hidden="true" />
      <span className="toast-t">{text}</span>
      {action && <LinkButton onClick={() => (dismissToast(id), action.onClick())}>{action.label}</LinkButton>}
      <IconButton label="知らせを閉じる" tip="閉じる" onClick={() => dismissToast(id)}><IconX size={14} stroke={1.8} /></IconButton>
    </div>
  )
}

/**
 * 知らせの置き場。AppShell の中では要らない（AppShell が置く）。
 * 知らせがなくても置いておく（重ねた Drawer が開くときに背面として数えるため）。inert は重ねた左メニューのあいだ
 */
export function Toaster({ inert }: { inert?: boolean }) {
  const shown = useSyncExternalStore((l) => (listeners.add(l), () => void listeners.delete(l)), () => items, () => items)
  return <section className="toasts" aria-label="知らせ" hidden={!shown.length} inert={inert}>{shown.map((t) => <ToastCard key={t.id} item={t} />)}</section>
}
