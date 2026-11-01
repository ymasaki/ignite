// ログインの画面の型（AuthScreen）と中身（LoginForm）。見た目は styles/components/auth.css。
// 認証そのものは持たない。入力を onSubmit で渡し、結果は loading と error で受け取る

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { announce, focusFirstInvalid } from './A11y'
import { Button, LinkButton } from './Button'
import { FormField } from './Field'
import { Checkbox } from './Form'
import { Notice } from './Layout'
import { Collapse } from './Motion'
import { PasswordField, TextField } from './TextArea'

/**
 * アプリの枠（AppShell）の外に置く、ログインなどの画面の型。窓の中央に 1 枚の面を置く。
 * mark と name はアプリの印と名前、title は h1、footer は面の外の下に添えるもの。低い窓では画面の中をスクロールする
 */
export function AuthScreen({ mark, name, title, footer, children }: { mark?: ReactNode; name: ReactNode; title: string; footer?: ReactNode; children: ReactNode }) {
  const titleId = useId()
  return (
    <main className="auth-screen">
      <div className="auth-column">
        <section className="auth-card" aria-labelledby={titleId}>
          <div className="auth-brand">
            {mark}
            <span>{name}</span>
          </div>
          <h1 className="auth-title" id={titleId}>{title}</h1>
          {children}
        </section>
        {footer && <div className="auth-foot">{footer}</div>}
      </div>
    </main>
  )
}

export interface LoginValues {
  identifier: string
  password: string
  remember: boolean
}

type LoginErrors = { identifier?: string; password?: string }

/** 送る前の検証。空と、メールアドレスの形だけを見る（パスワードの強さは見ない） */
export function validateLogin(v: { identifier: string; password: string }, label: string, type: 'email' | 'text'): LoginErrors {
  const id = v.identifier.trim()
  return {
    identifier: !id ? `${label}を入れてください` : type === 'email' && !/^\S+@\S+$/.test(id) ? 'メールアドレスの形で入れてください' : undefined,
    password: v.password ? undefined : 'パスワードを入れてください',
  }
}

/**
 * ログインの入力。入力の値は部品が持ち、検証を通ったものだけを onSubmit へ渡す。
 * error は認証の失敗の文（どちらの欄が違うかを書かない）。受け取るとパスワードの欄へ移る。
 * identifierType="text" はユーザー名などで入るとき（identifierLabel も渡す）。remember は「ログインしたまま」の欄を出す。
 * onForgot を渡すと再設定のリンクを出す。alternatives は別の方法のボタン（Button を縦に並べる）
 */
export function LoginForm({ onSubmit, loading = false, error, identifierLabel = 'メールアドレス', identifierType = 'email', remember: showRemember = false, onForgot, alternatives, submitLabel = 'ログインする' }: { onSubmit: (values: LoginValues) => void; loading?: boolean; error?: string; identifierLabel?: string; identifierType?: 'email' | 'text'; remember?: boolean; onForgot?: () => void; alternatives?: ReactNode; submitLabel?: string }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<LoginErrors>({})
  const form = useRef<HTMLFormElement>(null)
  const failed = !!error && !loading

  useEffect(() => {
    if (!failed || !error) return
    announce(error, { assertive: true })
    const field = form.current?.querySelector<HTMLInputElement>('[autocomplete="current-password"]')
    field?.focus()
    field?.select()
  }, [failed, error])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    const found = validateLogin({ identifier, password }, identifierLabel, identifierType)
    setErrors(found)
    if (found.identifier || found.password) {
      requestAnimationFrame(() => form.current && focusFirstInvalid(form.current))
      return
    }
    onSubmit({ identifier: identifier.trim(), password, remember })
  }

  return (
    <div className="login">
      <form ref={form} className="login-form" noValidate aria-label="ログイン" onSubmit={submit}>
        <Collapse open={failed}>
          <div className="login-notice"><Notice tone="danger">{error}</Notice></div>
        </Collapse>
        <FormField label={identifierLabel} error={errors.identifier}>
          <TextField value={identifier} onChange={(v) => { setIdentifier(v); setErrors({ ...errors, identifier: undefined }) }} type={identifierType} name="username" autoComplete="username" autoCapitalize="none" />
        </FormField>
        <FormField label="パスワード" error={errors.password}>
          <PasswordField value={password} onChange={(v) => { setPassword(v); setErrors({ ...errors, password: undefined }) }} name="password" />
        </FormField>
        {(showRemember || onForgot) && (
          <div className="login-row">
            {showRemember && <Checkbox checked={remember} onChange={setRemember} label="ログインしたままにする" />}
            {onForgot && <LinkButton className="login-forgot" onClick={onForgot}>パスワードを再設定する</LinkButton>}
          </div>
        )}
        <Button type="submit" variant="primary" className="login-submit" loading={loading}>{submitLabel}</Button>
      </form>
      {alternatives && (
        <>
          <div className="login-sep">または</div>
          <div className="login-alt">{alternatives}</div>
        </>
      )}
    </div>
  )
}
