// グラフ共通の吹き出し。SVG とスクロール枠の中でも同じ表示・操作にする。
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** 読み取り用の図の確認口。選択ボタン・凡例・meter は呼び出し側で役割を上書きする */
export const chartTip = (text: string) => ({ role: 'img' as const, 'data-chart-tip': text, tabIndex: 0, 'aria-label': text })
/** 名前の元の要素の、読み上げと同じ文字（aria-hidden の中は除く。回る数字の 0〜9 の帯を拾わないため） */
const spokenText = (el: Element | null) => {
  if (!el) return ''
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
  return copy.textContent ?? ''
}
const targetOf = (node: EventTarget | null) => node instanceof Element ? node.closest<HTMLElement | SVGElement>('[data-chart-tip]') : null

let dismissCurrent: (() => void) | undefined

export function ChartTooltip({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  const Tag = inline ? 'span' : 'div'
  const [revision, setRevision] = useState(0)
  const [target, setTarget] = useState<HTMLElement | SVGElement | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const dismissedFocus = useRef<HTMLElement | SVGElement | null>(null)
  const leaving = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelLeave = () => clearTimeout(leaving.current)
  const localTarget = (node: EventTarget | null) => root.current?.contains(node as Node | null) ? targetOf(node) : null
  const focused = () => {
    const el = localTarget(document.activeElement)
    return el === dismissedFocus.current ? null : el
  }
  const leave = () => {
    cancelLeave()
    // 部品と吹き出しの間の 6px を通っても閉じない。長い値にポインタを載せて読める。
    leaving.current = setTimeout(() => setTarget(focused()), 100)
  }
  useLayoutEffect(() => cancelLeave, [])
  useLayoutEffect(() => {
    if (!target) return
    const close = () => {
      cancelLeave()
      setTarget(null)
    }
    dismissCurrent?.()
    dismissCurrent = close
    const el = tip.current!
    // top layer で表示するため、dialog や overflow の背面に隠れない。
    if (!el.matches(':popover-open')) el.showPopover()
    const r = target.getBoundingClientRect(), t = el.getBoundingClientRect()
    const w = document.documentElement.clientWidth, h = document.documentElement.clientHeight
    el.style.left = `${Math.max(8, Math.min(w - t.width - 8, r.left + (r.width - t.width) / 2))}px`
    el.style.top = `${Math.max(8, Math.min(h - t.height - 8, r.bottom + 6 + t.height <= h - 8 ? r.bottom + 6 : r.top - t.height - 6))}px`
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.documentElement.dataset.tips === 'off') { close(); return }
      dismissedFocus.current = localTarget(document.activeElement)
      // 最初の Esc は吹き出しだけを閉じ、親の Dialog や選択操作には渡さない。
      e.preventDefault()
      e.stopPropagation()
      close()
    }
    const scroll = () => {
      const now = target.getBoundingClientRect()
      // focus() に伴う自動スクロールは、配置を測り終えた後に通知されることがある。
      if (!target.isConnected || Math.abs(now.top - r.top) > 0.5 || Math.abs(now.left - r.left) > 0.5) close()
    }
    // 値の更新にも追随する。CSS の attr() と同じく、古い値を出したままにしない。
    const updates = new MutationObserver(() => target.isConnected ? setRevision(v => v + 1) : close())
    updates.observe(root.current!, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-chart-tip', 'aria-labelledby'] })
    document.addEventListener('keydown', escape, true)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', close)
    return () => {
      updates.disconnect()
      if (dismissCurrent === close) dismissCurrent = undefined
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', close)
    }
  }, [target, revision])
  return (
    <Tag ref={root} className="chart-tooltip-root"
      onMouseOver={(e) => {
        const next = targetOf(e.target)
        if (next || (e.target instanceof Element && e.target.closest('.chart-tip'))) cancelLeave()
        if (next && next !== targetOf(e.relatedTarget) && matchMedia('(hover:hover)').matches) {
          if (dismissedFocus.current === next) dismissedFocus.current = null
          setTarget(next)
        }
      }}
      onMouseOut={(e) => {
        if (e.relatedTarget instanceof Element && e.relatedTarget.closest('.chart-tip')) return
        if (targetOf(e.target) !== targetOf(e.relatedTarget)) leave()
      }}
      onFocus={(e) => { dismissedFocus.current = null; setTarget(targetOf(e.target)) }}
      onBlur={(e) => setTarget(localTarget(e.relatedTarget))}>
      {children}
      {target && createPortal(
        <div ref={tip} className="chart-tip" role="tooltip" popover="manual" onMouseLeave={leave}>
          {target.getAttribute('aria-labelledby')?.split(/\s+/).map(id => spokenText(document.getElementById(id))).filter(Boolean).join('　') || target.getAttribute('data-chart-tip')}
        </div>, target.closest('dialog') ?? document.body,
      )}
    </Tag>
  )
}
