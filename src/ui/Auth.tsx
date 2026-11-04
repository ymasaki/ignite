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
 * mark と name はアプリの印と名前、title は h1（読み上げ用。画面には出さない）、footer は面の外の下に添えるもの。低い窓では画面の中をスクロールする
 */
export function AuthScreen({ mark, name, title, footer, children }: { mark?: ReactNode; name: ReactNode; title: string; footer?: ReactNode; children: ReactNode }) {
  const titleId = useId()
  return (
    <main className="auth-screen">
      <div className="auth-column">
        <section className="auth-card" aria-labelledby={titleId}>
          <div className="auth-brand">
            {mark && <span className="auth-mark">{mark}</span>}
            <span className="auth-name">{name}</span>
          </div>
          <h1 className="auth-title sr-only" id={titleId}>{title}</h1>
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

/** ProviderLogo で出せる外部認証の提供元 */
export type AuthProvider = 'google' | 'apple' | 'microsoft' | 'github' | 'okta'

// 各社の公式ロゴ。形と色は各社のブランドの決まりなので、テーマ・スキンで変えない（トークンにしない）。
// 単色のロゴ（Apple・GitHub・Okta）は文字の色（currentColor）で描き、ダークモードでも地との差を保つ
const LOGOS: Record<AuthProvider, { box: string; body: ReactNode }> = {
  // Google の 4 色の「G」（Google Identity Services のボタンの決まり。色を変えない・単色にしない）
  google: {
    box: '0 0 48 48',
    body: (
      <>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </>
    ),
  },
  apple: {
    box: '0 0 24 24',
    body: <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />,
  },
  // Microsoft の 4 色の四角（Microsoft の「Sign in with Microsoft」の決まり）
  microsoft: {
    box: '0 0 21 21',
    body: (
      <>
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </>
    ),
  },
  github: {
    box: '0 0 24 24',
    body: <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />,
  },
  okta: {
    box: '0 0 24 24',
    body: <path fill="currentColor" d="M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z" />,
  },
}

/**
 * 外部認証の提供元の公式ロゴ（LoginForm の alternatives に置く Button の icon など）。
 * 飾りなので読み上げない（ボタンの文字「Google でログインする」が名前になる）。size は一辺の px で、Button のアイコンと同じ 16 が既定
 */
export function ProviderLogo({ provider, size = 16 }: { provider: AuthProvider; size?: number }) {
  const logo = LOGOS[provider]
  return (
    <svg className="provider-logo" width={size} height={size} viewBox={logo.box} aria-hidden="true" focusable="false">
      {logo.body}
    </svg>
  )
}
