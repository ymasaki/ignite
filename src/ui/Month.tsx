// 前後の送り（対象の月・週）。見た目は styles/components/month.css。

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { fmtMonth } from '../format/date'
import { IconButton } from './Button'
import { Select, type SelectOption } from './Controls'
import { RollingNumber } from './Motion'

/**
 * 「‹ 値 ⌄ ›」を 1 つの枠にまとめた前後の送り（対象の月・週など）。値を押すと一覧（Select）、‹ › で前後へ移る。
 * options は新しい順。display は枠に出す中身（省略時は選んだ項目の label）。meta は右端の補足。
 * hideMeta は狭いときに補足をなめらかに隠す（DESIGN.md 5 章。置き場所で決める。useFitStep）
 */
export function Stepper<T extends string>({ label, prevLabel, nextLabel, value, options, onChange, display, hideMeta }: {
  label: string; prevLabel: string; nextLabel: string; value: T; options: SelectOption<T>[]; onChange: (v: T) => void; display?: ReactNode; hideMeta?: boolean
}) {
  const i = options.findIndex((o) => o.value === value)
  const older = i >= 0 ? options[i + 1]?.value : undefined
  const newer = i > 0 ? options[i - 1].value : undefined
  return (
    <div className={`stepper${hideMeta ? ' no-meta' : ''}`} role="group" aria-label={label}>
      <IconButton label={prevLabel} disabled={!older} onClick={() => older && onChange(older)}><IconChevronLeft size={16} stroke={1.8} /></IconButton>
      <Select label={label} value={value} onChange={onChange} options={options} display={display} />
      <IconButton label={nextLabel} disabled={!newer} onClick={() => newer && onChange(newer)}><IconChevronRight size={16} stroke={1.8} /></IconButton>
    </div>
  )
}

/**
 * 「‹ 2026年9月 ⌄ ›」の月の送り（Stepper）。年・月の数字は切り替えるとスロットのように回る。
 * 高さは絞り込みの帯の入力欄と同じ。月は「2026-09」の形で、months は新しい順。meta は右端の補足（「今月」）
 */
export function MonthStepper({ value, months, onChange, meta, hideMeta }: { value: string; months: string[]; onChange: (m: string) => void; meta?: (m: string) => ReactNode; hideMeta?: boolean }) {
  const [y, m] = value.split('-').map(Number)
  return (
    <Stepper label="対象月" prevLabel="前の月" nextLabel="次の月" value={value} onChange={onChange} hideMeta={hideMeta}
      options={months.map((v) => ({ value: v, label: fmtMonth(v), meta: meta?.(v) }))}
      display={<span className="num"><RollingNumber value={y} />年<RollingNumber value={m} />月</span>} />
  )
}
