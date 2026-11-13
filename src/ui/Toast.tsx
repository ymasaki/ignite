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

// 知らせの外から中へフォーカスが入ったときの元の場所（最後の知らせを × で閉じたら、ここへ戻す）
let cameFrom: HTMLElement | null = null

function ToastCard({ item }: { item: Item }) {
  const { id, text, tone = 'info', action, closing } = item
  const Icon = ICONS[tone]
  const wait = toastDuration(item)
  const box = useRef<HTMLDivElement>(null)
  // 手で閉じる。閉じる知らせの中にフォーカスがあれば、隣の知らせ（下、なければ上）の × か、知らせに入る前の場所へ移す
  // （閉じる知らせは inert になるので、移さないとフォーカスが body に落ちる。WCAG 2.4.3）
  const close = () => {
    const el = box.current
    if (el?.contains(document.activeElement)) {
      const shown = [...(el.parentElement?.children ?? [])].filter((t) => !t.classList.contains('closing'))
      const i = shown.indexOf(el)
      const near = (shown[i + 1] ?? shown[i - 1])?.querySelector<HTMLElement>('[data-toast-close]')
      const back = near ?? (cameFrom?.isConnected ? cameFrom : null)
      back?.focus({ preventScroll: true })
    }
    dismissToast(id)
  }
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
    <div ref={box} className={`toast ${tone}${closing ? ' closing' : ''}`} inert={closing} onPointerEnter={() => hold('hover', true)} onPointerLeave={() => hold('hover', false)} onFocus={() => hold('focus', true)} onBlur={() => hold('focus', false)} onAnimationEnd={(e) => e.target === e.currentTarget && closing && set(items.filter((t) => t.id !== id))}>
      <Icon size={16} stroke={1.8} aria-hidden="true" />
      <span className="toast-t">{text}</span>
      {action && <LinkButton onClick={() => (close(), action.onClick())}>{action.label}</LinkButton>}
      <IconButton label="知らせを閉じる" tip="閉じる" data-toast-close="" onClick={close}><IconX size={14} stroke={1.8} /></IconButton>
    </div>
  )
}

/**
 * 知らせの置き場。AppShell の中では要らない（AppShell が置く）。
 * inert は重ねたものが開いているあいだ（AppShell が左メニューと詳細の両方を見て決める）
 */
export function Toaster({ inert }: { inert?: boolean }) {
  const shown = useSyncExternalStore((l) => (listeners.add(l), () => void listeners.delete(l)), () => items, () => items)
  return (
    <section className="toasts" aria-label="知らせ" hidden={!shown.length} inert={inert}
      onFocus={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) cameFrom = e.relatedTarget as HTMLElement | null }}>
      {shown.map((t) => <ToastCard key={t.id} item={t} />)}
    </section>
  )
}
