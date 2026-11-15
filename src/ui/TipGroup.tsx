// 同じまとまりのアイコンのボタン（道具の並び・書式のボタンなど）の吹き出しを 1 つにまとめる。見た目は styles/components/tipgroup.css。
// 最初は通常の吹き出しと同じく 0.25s 待って出し、出ているあいだに隣のボタンへ移ると、待たずに吹き出しが位置と幅を変えながら滑って移る

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { tipShift } from './tip'

type Tip = { text: string; x: number; y: number }

/** 吹き出しが出るまでの待ち（base.css の [data-tip] と同じ） */
const TIP_DELAY = 250
/** ボタンの隙間を通るあいだは消さない（隣へ移るたびに出し直さないように） */
const TIP_GRACE = 120

/**
 * 中のボタンの data-tip（IconButton の label）を、まとまりで 1 つの吹き出しに出す。label はまとまりの読み上げ名（role="group"）。
 * 中のボタンはふつうどおり Tab で順に移る。吹き出しは飾りで、読み上げは各ボタンの aria-label。Esc で消える
 */
export function TipGroup({ label, children }: { label: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const [shown, setShown] = useState(false)
  const timer = useRef(0)
  const hide = useRef(0)
  const width = useRef<number | null>(null)

  const place = (el: HTMLElement) => {
    const b = box.current
    const text = el.dataset.tip
    if (!b || !text) return
    const br = b.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    window.clearTimeout(hide.current)
    setTip({ text, x: r.left + r.width / 2 - br.left, y: r.bottom - br.top })
    if (!shown && !timer.current) timer.current = window.setTimeout(() => ((timer.current = 0), setShown(true)), TIP_DELAY)
  }
  const leave = () => {
    window.clearTimeout(hide.current)
    hide.current = window.setTimeout(() => {
      window.clearTimeout(timer.current)
      timer.current = 0
      setShown(false)
      setTip(null)
      width.current = null
    }, TIP_GRACE)
  }
  useEffect(() => () => (window.clearTimeout(timer.current), window.clearTimeout(hide.current)), [])
  // 出ているあいだは、フォーカスがまとまりの外にあっても Esc で消す（WCAG 1.4.13。マウスを載せただけのとき）
  useEffect(() => {
    if (!tip) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && leave()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!tip])

  // 文言が変わったら、前の幅から新しい幅へ動かす。窓の左右からはみ出す分は横に寄せる
  useLayoutEffect(() => {
    const el = bubble.current
    if (!el || !tip) return
    el.style.width = ''
    const w = el.getBoundingClientRect().width
    const left = (box.current?.getBoundingClientRect().left ?? 0) + tip.x - w / 2
    el.style.setProperty('--tg-shift', `${tipShift(left, left + w, document.documentElement.clientWidth)}px`)
    if (shown && width.current !== null && width.current !== w) {
      el.style.width = `${width.current}px`
      void el.offsetWidth
      el.style.width = `${w}px`
    }
    width.current = w
  }, [tip, shown])

  const target = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-tip]') : null)
  return (
    <div
      ref={box}
      className="tipgroup"
      role="group"
      aria-label={label}
      onPointerOver={(e) => {
        const el = target(e.target)
        if (el && box.current?.contains(el) && e.pointerType === 'mouse') place(el)
      }}
      onPointerLeave={leave}
      onFocus={(e) => {
        const el = target(e.target)
        if (el && el.matches(':focus-visible')) place(el)
      }}
      onBlur={(e) => !box.current?.contains(e.relatedTarget as Node | null) && leave()}
      onPointerDown={leave}
    >
      {children}
      {tip && (
        <span ref={bubble} className={`tg-bubble${shown ? ' on' : ''}`} style={{ left: tip.x, top: tip.y }} aria-hidden="true">
          <span key={tip.text}>{tip.text}</span>
        </span>
      )}
    </div>
  )
}
