// 入力欄。複数行（感想・メモなど）は .field.area、1 行（名前・区切った語の並びなど）は .field.wide。見た目は styles/components/controls.css。
// 残りの字数は出さず、上限（maxLength）で止める。FormField の中では label を省ける
import { fieldProps, useField } from './Field'

export function TextArea({ value, onChange, label, placeholder, maxLength, rows = 4, disabled = false }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string; maxLength?: number; rows?: number; disabled?: boolean }) {
  const f = useField(label)
  return <textarea className="field area" aria-label={f.label} {...fieldProps(f)} placeholder={placeholder} maxLength={maxLength} rows={rows} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
}

/** 1 行の入力欄（幅いっぱい）。secret は打った文字を伏せる（トークンなど。ブラウザに覚えさせない） */
export function TextField({ value, onChange, label, placeholder, maxLength, disabled = false, secret = false }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string; maxLength?: number; disabled?: boolean; secret?: boolean }) {
  const f = useField(label)
  return <input className="field wide" type={secret ? 'password' : 'text'} autoComplete={secret ? 'new-password' : undefined} aria-label={f.label} {...fieldProps(f)} placeholder={placeholder} maxLength={maxLength} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
}
