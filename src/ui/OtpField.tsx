// 2 段階認証などの確認コードの欄。見た目は styles/components/otp.css。
// 本物の入力欄は 1 つ（透明にして升の上に重ねる。並び全体を label にし、どこを押しても欄に入る）。桁数は貼り付けた「123 456」なども読めるよう maxLength で切らず、数字にしてから切る。貼り付け・端末の自動入力（one-time-code）・読み上げはブラウザに任せ、升は見た目だけ

import { useRef, useState, type CSSProperties } from 'react'
import { fieldProps, useField } from './Field'

/** 打った・貼った文字から数字だけを取り出し（全角も読む）、桁数で切る */
export function otpDigits(text: string, length: number): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\D/g, '').slice(0, length)
}

/**
 * 確認コードの欄（既定は 6 桁の数字）。入った数字は升に下から弾んで入り、次の升に打つ位置の印が移る。
 * 全部そろうと onComplete を呼ぶ（そこで確かめてよい）。FormField の error が付くと升が横に揺れる。
 * 数字以外・全角は数字に直し、余った桁は捨てる
 */
export function OtpField({ value, onChange, onComplete, length = 6, label, disabled = false, autoFocus = false }: { value: string; onChange: (v: string) => void; onComplete?: (code: string) => void; length?: number; label?: string; disabled?: boolean; autoFocus?: boolean }) {
  const f = useField(label)
  const input = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  // 打つ位置はいつも末尾（升の途中を書き換えるときは消して打ち直す。1 つの欄なので位置をずらさない）
  const toEnd = () => {
    const el = input.current
    if (el) requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
  }
  const cur = Math.min(value.length, length - 1)
  return (
    <label className={`otp${focused ? ' focus' : ''}${f.invalid ? ' invalid' : ''}${disabled ? ' off' : ''}`} style={{ '--otp-n': length } as CSSProperties}>
      <input
        ref={input}
        className="otp-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-label={f.label}
        {...fieldProps(f)}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const next = otpDigits(e.target.value, length)
          onChange(next)
          if (next.length === length && next !== value) onComplete?.(next)
        }}
        onFocus={() => (setFocused(true), toEnd())}
        onBlur={() => setFocused(false)}
        onClick={toEnd}
        onSelect={(e) => {
          const el = e.currentTarget
          if (el.selectionStart !== el.value.length || el.selectionEnd !== el.value.length) toEnd()
        }}
      />
      {Array.from({ length }, (_, i) => [
        // 6 桁以上の偶数は半分で区切り、3 桁ずつ読み取れるようにする（見た目だけ。値に区切りは入れない）
        i > 0 && length >= 6 && length % 2 === 0 && i === length / 2 && <span key="sep" className="otp-sep" aria-hidden="true" />,
        <span key={i} className={`otp-cell${i < value.length ? ' filled' : ''}${focused && i === cur ? ' cur' : ''}`} aria-hidden="true">
          {i < value.length && <span key={value[i]}>{value[i]}</span>}
        </span>,
      ])}
    </label>
  )
}
