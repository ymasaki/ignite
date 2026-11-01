// 入力欄。複数行（感想・メモなど）は .field.area、1 行（名前・区切った語の並びなど）は .field.wide。見た目は styles/components/controls.css。
// 残りの字数は出さず、上限（maxLength）で止める。FormField の中では label を省ける
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { IconButton } from './Button'
import { fieldProps, useField } from './Field'

export function TextArea({ value, onChange, label, placeholder, maxLength, rows = 4, disabled = false }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string; maxLength?: number; rows?: number; disabled?: boolean }) {
  const f = useField(label)
  return <textarea className="field area" aria-label={f.label} {...fieldProps(f)} placeholder={placeholder} maxLength={maxLength} rows={rows} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
}

/**
 * 1 行の入力欄（幅いっぱい）。secret は打った文字を伏せる（トークンなど。ブラウザに覚えさせない）。
 * type・autoComplete・name・autoCapitalize は、ブラウザの自動入力と端末のキーボードに欄の種類を伝える
 */
export function TextField({ value, onChange, label, placeholder, maxLength, disabled = false, secret = false, type = 'text', autoComplete, name, autoCapitalize }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string; maxLength?: number; disabled?: boolean; secret?: boolean; type?: 'text' | 'email' | 'tel' | 'url' } & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoComplete' | 'name' | 'autoCapitalize'>) {
  const f = useField(label)
  return <input className="field wide" type={secret ? 'password' : type} autoComplete={autoComplete ?? (secret ? 'new-password' : undefined)} name={name} autoCapitalize={autoCapitalize} aria-label={f.label} {...fieldProps(f)} placeholder={placeholder} maxLength={maxLength} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
}

/**
 * パスワードの欄。右端のボタンで打った文字を確かめられ、フォームを送ると伏せた形へ戻す。
 * 自動入力のために、ログインは current-password、新しいパスワードを決める欄は new-password を渡す
 */
export function PasswordField({ value, onChange, label, placeholder, autoComplete = 'current-password', name, maxLength, disabled = false }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string; autoComplete?: 'current-password' | 'new-password'; name?: string; maxLength?: number; disabled?: boolean }) {
  const f = useField(label)
  const [shown, setShown] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const form = input.current?.form
    if (!form) return
    const hide = () => setShown(false)
    form.addEventListener('submit', hide)
    return () => form.removeEventListener('submit', hide)
  }, [])
  return (
    <span className="pw-field">
      <input ref={input} className="field wide" type={shown ? 'text' : 'password'} autoComplete={autoComplete} name={name} autoCapitalize="none" spellCheck={false} aria-label={f.label} {...fieldProps(f)} placeholder={placeholder} maxLength={maxLength} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
      <IconButton className="pw-toggle" label="パスワードを表示" tip={shown ? '隠す' : '表示する'} aria-pressed={shown} disabled={disabled} onClick={() => setShown(!shown)}>
        {shown ? <IconEyeOff size={16} stroke={1.8} aria-hidden="true" /> : <IconEye size={16} stroke={1.8} aria-hidden="true" />}
      </IconButton>
    </span>
  )
}
