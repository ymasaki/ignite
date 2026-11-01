// 日付を選ぶ（ボタン ＋ カレンダー）。見た目は styles/components/form.css。値は「2026-09-27」の文字列。
// キーボードは WAI-ARIA の date picker の型: ←→↑↓ で日、Home・End で週の端、PageUp・PageDown で月（Shift で年）、Enter で選ぶ、Esc で閉じる

import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { fmtDate, fmtMonth, jstDate } from '../format/date'
import { IconButton, LinkButton } from './Button'
import { Popover } from './Controls'
import { useField } from './Field'
import { addDays, addMonths, clampDate, monthGrid, weekday } from './calendar'

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
const longDate = (iso: string) => `${Number(iso.slice(0, 4))}年${Number(iso.slice(5, 7))}月${Number(iso.slice(8))}日 ${WEEK[weekday(iso)]}曜日`

function Calendar({ value, today, min, max, weekStart, onPick, onClear }: { value: string | null; today: string; min?: string; max?: string; weekStart: number; onPick: (iso: string) => void; onClear?: () => void }) {
  const [focus, setFocus] = useState(clampDate(value ?? today, min, max))
  const grid = useRef<HTMLTableElement>(null)
  const moved = useRef(false)
  // 開いたときと、キーで日を動かしたときに、その日へフォーカスを移す（前後の月のボタンを押したときは動かさない）
  useEffect(() => {
    if (moved.current) grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }, [focus])
  useEffect(() => void grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus(), [])
  const out = (iso: string) => (min != null && iso < min) || (max != null && iso > max)
  const move = (iso: string) => {
    moved.current = true
    setFocus(clampDate(iso, min, max))
  }
  const onKey = (e: KeyboardEvent) => {
    const dow = (weekday(focus) - weekStart + 7) % 7
    const to = e.key === 'ArrowRight' ? addDays(focus, 1) : e.key === 'ArrowLeft' ? addDays(focus, -1) : e.key === 'ArrowDown' ? addDays(focus, 7) : e.key === 'ArrowUp' ? addDays(focus, -7) : e.key === 'Home' ? addDays(focus, -dow) : e.key === 'End' ? addDays(focus, 6 - dow) : e.key === 'PageDown' ? addMonths(focus, e.shiftKey ? 12 : 1) : e.key === 'PageUp' ? addMonths(focus, e.shiftKey ? -12 : -1) : null
    if (to === null) return
    e.preventDefault()
    move(to)
  }
  const ym = focus.slice(0, 7)
  return (
    <div className="cal" role="dialog" aria-label={fmtMonth(ym)}>
      <div className="cal-head">
        <IconButton label="前の月" onClick={() => ((moved.current = false), setFocus(clampDate(addMonths(focus, -1), min, max)))}><IconChevronLeft size={16} stroke={1.8} /></IconButton>
        <b className="num" aria-live="polite">{fmtMonth(ym)}</b>
        <IconButton label="次の月" onClick={() => ((moved.current = false), setFocus(clampDate(addMonths(focus, 1), min, max)))}><IconChevronRight size={16} stroke={1.8} /></IconButton>
      </div>
      <table ref={grid} role="grid" aria-label={fmtMonth(ym)} onKeyDown={onKey}>
        <thead><tr>{Array.from({ length: 7 }, (_, i) => <th key={i} scope="col" abbr={`${WEEK[(i + weekStart) % 7]}曜日`}>{WEEK[(i + weekStart) % 7]}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: 6 }, (_, w) => (
            <tr key={w}>
              {monthGrid(ym, weekStart).slice(w * 7, w * 7 + 7).map((iso) => (
                <td key={iso} aria-selected={iso === value}>
                  <button type="button" className={`cal-d num${iso.slice(0, 7) === ym ? '' : ' other'}${iso === value ? ' on' : ''}`} tabIndex={iso === focus ? 0 : -1} disabled={out(iso)} aria-label={longDate(iso)} aria-current={iso === today ? 'date' : undefined} onClick={() => onPick(iso)}>
                    {Number(iso.slice(8))}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cal-foot">
        {!out(today) && <LinkButton onClick={() => onPick(today)}>今日</LinkButton>}
        {onClear && <LinkButton onClick={onClear}>選択を外す</LinkButton>}
      </div>
    </div>
  )
}

/** 1 日を選ぶ。min・max で選べる範囲を絞る。clearable で「選択を外す」を出す。weekStart は週の始まり（既定は日曜） */
export function DatePicker({ value, onChange, label, min, max, placeholder = '日付を選ぶ', clearable = false, weekStart = 0, today = jstDate(new Date()), disabled = false }: { value: string | null; onChange: (v: string | null) => void; label?: string; min?: string; max?: string; placeholder?: string; clearable?: boolean; weekStart?: number; today?: string; disabled?: boolean }) {
  const f = useField(label)
  const btn = useRef<HTMLButtonElement>(null)
  const shown = value ? fmtDate(value) : placeholder
  return (
    <Popover
      className="select datepicker"
      trigger={(open, toggle) => (
        <button ref={btn} id={f.id} type="button" disabled={disabled} className={`btn select-btn ${open ? 'on' : ''}`} aria-invalid={f.invalid || undefined} aria-haspopup="dialog" aria-expanded={open} aria-label={`${f.label ?? ''}: ${shown}`} aria-describedby={f.describedBy} onClick={toggle}>
          <IconCalendar className="sel-ico" size={15} stroke={1.8} aria-hidden="true" />
          <span className="sel-label num">{shown}</span>
        </button>
      )}
    >
      {(close) => {
        const done = (v: string | null) => {
          close()
          btn.current?.focus()
          if (v !== value) onChange(v)
        }
        return <Calendar value={value} today={today} min={min} max={max} weekStart={weekStart} onPick={done} onClear={clearable && value ? () => done(null) : undefined} />
      }}
    </Popover>
  )
}
