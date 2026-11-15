// 帯をなぞって数を決める（露出・音量・透明度・拡大率など、見ながら合わせる値）。見た目は styles/components/scrubber.css。
// 名前と値は帯の中に書き、値までの地を淡い主要色で塗る。ホバー・フォーカス・ドラッグ中は位置の線がつまみに膨らむ

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useField } from './Field'
import { clampNumber, stepNumber } from './Form'

/** 帯の左端からの割合（0〜1）を、step の刻みにそろえた値にする */
export function scrubValue(ratio: number, min: number, max: number, step: number): number {
  const raw = min + clampNumber(ratio, 0, 1) * (max - min)
  return stepNumber(min, Math.round((raw - min) / step) * step, step, min, max)
}

/**
 * 帯をなぞって数を決める。押した位置へ飛び、そのままドラッグで合わせる（手を離すまで帯の外に出ても追う）。
 * キーは ←→↑↓ で step、PageUp・PageDown で 10 倍、Home・End で端へ。ticks は目盛りの数（端を含めない区切りの数）。
 * 値の表示は format（既定は数と unit）。読み上げは slider
 */
export function Scrubber({ value, onChange, label, min = 0, max = 100, step = 1, unit = '', ticks = 0, format, disabled = false }: { value: number; onChange: (v: number) => void; label?: string; min?: number; max?: number; step?: number; unit?: string; ticks?: number; format?: (v: number) => string; disabled?: boolean }) {
  const f = useField(label)
  const track = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const ratio = max > min ? (clampNumber(value, min, max) - min) / (max - min) : 0
  const text = format ? format(value) : `${value}${unit}`
  const set = (v: number) => v !== value && onChange(v)
  const fromPointer = (e: PointerEvent) => {
    const r = track.current?.getBoundingClientRect()
    if (r && r.width) set(scrubValue((e.clientX - r.left) / r.width, min, max, step))
  }
  const onKey = (e: KeyboardEvent) => {
    const big = step * 10
    const next: Record<string, number> = { ArrowRight: value + step, ArrowUp: value + step, ArrowLeft: value - step, ArrowDown: value - step, PageUp: value + big, PageDown: value - big, Home: min, End: max }
    if (!(e.key in next)) return
    e.preventDefault()
    set(stepNumber(next[e.key], 0, step, min, max))
  }
  return (
    <div
      ref={track}
      className={`scrubber${drag ? ' drag' : ''}${f.invalid ? ' invalid' : ''}${disabled ? ' off' : ''}`}
      style={{ '--scrub': ratio } as CSSProperties}
      role="slider"
      id={f.id}
      tabIndex={disabled ? -1 : 0}
      aria-label={f.label}
      aria-describedby={f.describedBy}
      aria-invalid={f.invalid || undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={text}
      aria-disabled={disabled || undefined}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag(true)
        fromPointer(e)
      }}
      onPointerMove={(e) => drag && fromPointer(e)}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
      onLostPointerCapture={() => setDrag(false)}
    >
      <span className="scr-fill" aria-hidden="true" />
      {ticks > 0 && (
        <span className="scr-ticks" aria-hidden="true">
          {Array.from({ length: ticks }, (_, i) => <i key={i} style={{ left: `${((i + 1) / (ticks + 1)) * 100}%` }} />)}
        </span>
      )}
      <span className="scr-thumb" aria-hidden="true" />
      {/* 帯の中の名前は label を直接渡したときだけ（FormField の中では見出しが名前なので重ねない） */}
      {label && <span className="scr-label" aria-hidden="true">{label}</span>}
      <span className="scr-value num" aria-hidden="true">{text}</span>
    </div>
  )
}
