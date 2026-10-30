// 入力欄の見出し・補足・エラーの枠（FormField）と、中の入力欄へ渡す仕組み（useField）。見た目は styles/components/form.css。

import { IconAlertCircle } from '@tabler/icons-react'
import { createContext, useContext, useId, type ReactNode } from 'react'
import { Collapse } from './Motion'

interface FieldState {
  id?: string
  label?: string
  describedBy?: string
  invalid?: boolean
  required?: boolean
}
const FieldContext = createContext<FieldState | null>(null)

/** FormField の中なら枠の名前・補足・エラーを受け取る。label は枠の外で使うときの名前（枠の中では省ける） */
export const useField = (label?: string): FieldState => ({ ...useContext(FieldContext), ...(label ? { label } : {}) })

/** input・textarea に渡す属性 */
export const fieldProps = (f: FieldState) => ({ id: f.id, 'aria-describedby': f.describedBy, 'aria-invalid': f.invalid || undefined, 'aria-required': f.required || undefined })

/**
 * 入力欄の見出し（上）・補足（hint）・エラー（error）を 1 つにまとめる枠。中に 1 つの入力の部品を置く。
 * 見出しは押すと欄へ移り、補足とエラーは読み上げで欄と一緒に読まれる。
 * group は複数の項目を選ぶ部品（RadioGroup など）のとき（見出しが 1 つの欄を指さない）
 */
export function FormField({ label, hint, error, required = false, group = false, children }: { label: string; hint?: ReactNode; error?: ReactNode; required?: boolean; group?: boolean; children: ReactNode }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="form-field">
      <div className="ff-head">
        {group ? <span className="ff-label">{label}</span> : <label className="ff-label" htmlFor={id}>{label}</label>}
        {required && <span className="ff-req">必須</span>}
      </div>
      <FieldContext.Provider value={{ id: group ? undefined : id, label, describedBy, invalid: !!error, required }}>{children}</FieldContext.Provider>
      {hint && <small className="ff-hint" id={hintId}>{hint}</small>}
      {/* エラーの出し入れで下を押し下げるので Collapse で包む（6 章） */}
      <Collapse open={!!error}>
        <small className="ff-error" id={error ? errorId : undefined}>
          <IconAlertCircle size={14} stroke={1.8} aria-hidden="true" />
          {error}
        </small>
      </Collapse>
    </div>
  )
}
