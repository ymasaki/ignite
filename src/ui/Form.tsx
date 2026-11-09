// フォームの部品（チェック・ラジオ・スイッチ・数値・候補から選ぶ入力）。見た目は styles/components/form.css。
// 値を受け取り、変わったら返すだけで状態を持たない。FormField の中では label を省ける。

import { IconCheck, IconChevronDown, IconMinus, IconPlus } from '@tabler/icons-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { usePlaced, type SelectOption } from './Controls'
import { fieldProps, useField } from './Field'
import { RollingNumber } from './Motion'

/** 1 つの項目の入/切。indeterminate は「一部だけ選んでいる」（表の見出しのすべて選ぶなど）。hideLabel は名前を見せない（表の中など） */
export function Checkbox({ checked, onChange, label, hint, indeterminate = false, hideLabel = false, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label?: string; hint?: ReactNode; indeterminate?: boolean; hideLabel?: boolean; disabled?: boolean }) {
  const f = useField(label)
  const ref = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label className={`check${disabled ? ' off' : ''}${f.invalid ? ' invalid' : ''}`}>
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} {...fieldProps(f)} />
      <span className="check-box" aria-hidden="true">
        {indeterminate ? <IconMinus size={14} stroke={2.4} /> : <IconCheck size={14} stroke={2.4} />}
      </span>
      <span className={hideLabel ? 'sr-only' : 'check-t'}>
        {f.label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

export type RadioOption<T extends string> = { value: T; label: string; hint?: ReactNode; disabled?: boolean }

/** 文面まで見せて 1 つを選ぶ（短い切り替えは Segmented、項目が多いときは Select）。inline は横に並べる */
export function RadioGroup<T extends string>({ value, options, onChange, label, inline = false, disabled = false }: { value: T | null; options: RadioOption<T>[]; onChange: (v: T) => void; label?: string; inline?: boolean; disabled?: boolean }) {
  const f = useField(label)
  const name = useId()
  return (
    <div className={`radios${inline ? ' inline' : ''}`} role="radiogroup" aria-label={f.label} aria-describedby={f.describedBy} aria-required={f.required || undefined} aria-invalid={f.invalid || undefined}>
      {options.map((o) => {
        const off = disabled || o.disabled
        return (
          <label key={o.value} className={`check${off ? ' off' : ''}${f.invalid ? ' invalid' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={o.value === value} disabled={off} onChange={() => onChange(o.value)} />
            <span className="check-box round" aria-hidden="true"><i /></span>
            <span className="check-t">
              {o.label}
              {o.hint && <small>{o.hint}</small>}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** 押すとすぐ効く入/切（保存のボタンのある画面では Checkbox を使う）。つまみが --ease-spring で動く */
export function Switch({ checked, onChange, label, hideLabel = false, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label?: string; hideLabel?: boolean; disabled?: boolean }) {
  const f = useField(label)
  return (
    <button type="button" role="switch" className="switch" id={f.id} aria-checked={checked} aria-label={hideLabel ? f.label : undefined} aria-describedby={f.describedBy} aria-invalid={f.invalid || undefined} disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="sw-track" aria-hidden="true"><span className="sw-thumb" /></span>
      {!hideLabel && <span>{f.label}</span>}
    </button>
  )
}

const FULL_WIDTH = /[０-９．－ー−]/g
const HALF: Record<string, string> = { '．': '.', '－': '-', 'ー': '-', '−': '-' }

/** 打った文字を数にする（全角の数字も読む。日本語の入力のまま打てるように）。読めなければ null */
export function parseNumber(text: string): number | null {
  const s = text.trim().replaceAll(',', '').replace(FULL_WIDTH, (c) => HALF[c] ?? String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 上限と下限に収める */
export const clampNumber = (n: number, min = -Infinity, max = Infinity) => Math.min(max, Math.max(min, n))

/** 増減した値（0.1 の足し算の端数が出ないよう、step の桁にそろえる） */
export function stepNumber(n: number | null, delta: number, step: number, min?: number, max?: number): number {
  // 小さい step は「1e-7」の形になるので、指数も数える
  const [mantissa, exp = '0'] = String(step).split('e')
  const digits = Math.min(100, Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exp)))
  return clampNumber(Number(((n ?? min ?? 0) + delta).toFixed(digits)), min, max)
}

/** 数を入れる欄。↑↓ と − ＋ で増減し、欄を離れるときに上限・下限へ収める。全角の数字も読む。unit は欄の右に添える単位 */
export function NumberField({ value, onChange, label, min, max, step = 1, unit, placeholder, disabled = false }: { value: number | null; onChange: (v: number | null) => void; label?: string; min?: number; max?: number; step?: number; unit?: string; placeholder?: string; disabled?: boolean }) {
  const f = useField(label)
  const [draft, setDraft] = useState<string | null>(null)
  // 打っている途中に外から値が変わったら、外の値を優先する（古い下書きを離れるときに書き戻さない）
  useEffect(() => setDraft(null), [value])
  const shown = draft === null ? value : parseNumber(draft)
  // 値が変わったら（− ＋・↑↓・外からの変更のどれでも）、欄の数字の上に回る数字（RollingNumber）を重ねて桁を回す。
  // 打ち込んで確定した値と、打ち込みの途中は欄の文字のまま（打った字がそのまま見えているので回さない）。
  // 回る数字は初めの表示では動かないので、ふだんから見えない形で置いておき、変えた直後だけ見せる
  const [rolling, setRolling] = useState(false)
  const prev = useRef(value)
  const typed = useRef(false)
  useLayoutEffect(() => {
    if (prev.current === value) return
    prev.current = value
    if (typed.current) typed.current = false
    else setRolling(true)
  }, [value])
  useEffect(() => {
    if (!rolling) return
    const t = window.setTimeout(() => setRolling(false), 700)
    return () => clearTimeout(t)
  }, [rolling, value])
  const text = value == null ? '' : String(value)
  const rollable = draft === null && /^\d+(\.\d+)?$/.test(text)
  const set = (n: number) => (setDraft(null), onChange(n))
  const stepBy = (n: number) => (setRolling(true), set(n))
  const commit = () => {
    if (draft === null) return
    const n = parseNumber(draft)
    const next = n === null ? null : clampNumber(n, min, max)
    setDraft(null)
    typed.current = next !== value
    onChange(next)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const next = stepNumber(draft === null ? value : parseNumber(draft), e.key === 'ArrowUp' ? step : -step, step, min, max)
    if (draft === null) stepBy(next)
    else set(next)
  }
  return (
    <span className="numfield">
      <span className={`nf-box${rolling && rollable ? ' rolling' : ''}`}>
        <input className="field" type="text" inputMode="decimal" role="spinbutton" autoComplete="off" aria-label={f.label} aria-valuenow={shown ?? undefined} aria-valuemin={min} aria-valuemax={max} aria-valuetext={shown != null && unit ? `${shown}${unit}` : undefined} placeholder={placeholder} disabled={disabled} value={draft ?? value ?? ''} onChange={(e) => (setRolling(false), setDraft(e.target.value))} onBlur={commit} onKeyDown={onKey} {...fieldProps(f)} />
        {rollable && <span className="nf-roll" aria-hidden="true"><RollingNumber value={value!} decimals={text.split('.')[1]?.length ?? 0} /></span>}
        {/* ↑↓ で同じことができるので Tab では止まらない */}
        <button type="button" className="nf-btn" tabIndex={-1} aria-label={`${f.label ?? ''}を減らす`} data-tip={`${f.label ?? ''}を減らす`} disabled={disabled || (value != null && min != null && value <= min)} onClick={() => stepBy(stepNumber(value, -step, step, min, max))}><IconMinus size={14} stroke={1.8} /></button>
        <button type="button" className="nf-btn" tabIndex={-1} aria-label={`${f.label ?? ''}を増やす`} data-tip={`${f.label ?? ''}を増やす`} disabled={disabled || (value != null && max != null && value >= max)} onClick={() => stepBy(stepNumber(value, step, step, min, max))}><IconPlus size={14} stroke={1.8} /></button>
      </span>
      {unit && <span className="nf-unit">{unit}</span>}
    </span>
  )
}

/** 候補を名前で絞る（大文字・小文字を区別しない） */
export const filterOptions = <T extends string>(options: SelectOption<T>[], q: string) => {
  const s = q.trim().toLowerCase()
  return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options
}

/**
 * 打って絞り込み、候補から 1 つを選ぶ（候補が 10 を超えるとき。少なければ Select）。
 * ↑↓ で移り Enter で選ぶ（変換の確定の Enter では選ばない）、Esc で閉じる。欄を空にして離れると選択を外す
 */
export function Combobox<T extends string>({ value, options, onChange, label, placeholder, empty = '該当なし', disabled = false }: { value: T | null; options: SelectOption<T>[]; onChange: (v: T | null) => void; label?: string; placeholder?: string; empty?: string; disabled?: boolean }) {
  const f = useField(label)
  const uid = useId()
  const listId = `${uid}-list`
  const body = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const cur = options.find((o) => o.value === value)
  const shown = filterOptions(options, q ?? '')
  usePlaced(body, open)
  // 開いたときは選択中の候補から始める
  useEffect(() => {
    if (open) setActive(Math.max(0, shown.findIndex((o) => o.value === value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    if (open) body.current?.querySelector(`[id="${uid}-${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, uid])
  const pick = (o: SelectOption<T>) => {
    setOpen(false)
    setQ(null)
    if (o.value !== value) onChange(o.value)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      if (shown.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length)
    } else if (e.key === 'Enter' && open && shown[active]) {
      e.preventDefault()
      pick(shown[active])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      setQ(null)
    }
  }
  const onBlur = () => {
    setOpen(false)
    if (q === '' && value != null) onChange(null)
    setQ(null)
  }
  return (
    <div className="popover select combo">
      <input className="field wide" type="text" role="combobox" autoComplete="off" aria-label={f.label} aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && shown[active] ? `${uid}-${active}` : undefined} placeholder={placeholder} disabled={disabled} value={q ?? cur?.label ?? ''} onChange={(e) => (setQ(e.target.value), setActive(0), setOpen(true))} onClick={() => setOpen(true)} onKeyDown={onKey} onBlur={onBlur} {...fieldProps(f)} />
      <IconChevronDown className="combo-chev" size={15} stroke={1.8} aria-hidden="true" />
      {open && (
        <div ref={body} className="popover-body">
          <div role="listbox" id={listId} aria-label={f.label}>
            {shown.map((o, i) => (
              // 押してもフォーカスを欄に残す（離れた扱いで閉じないように）
              <div key={o.value} id={`${uid}-${i}`} role="option" aria-selected={o.value === value} className={`select-opt${i === active ? ' on' : ''}`} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
                {o.lead && <span className="sel-lead">{o.lead}</span>}
                <span className="sel-label">{o.label}</span>
                <IconCheck className="sel-check" size={15} stroke={1.8} />
                {o.meta != null && <span className="sel-meta num">{o.meta}</span>}
              </div>
            ))}
            {!shown.length && <div className="combo-empty">{empty}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
