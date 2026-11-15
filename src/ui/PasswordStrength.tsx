// 新しいパスワードを決める欄の下に置く強さの目安。見た目は styles/components/password.css。
// 強さの判定は目安（長さ・文字の種類・よくある並び）で、サーバーの検証の代わりにはしない

import { RollingWord } from './Motion'

export type PasswordScore = 0 | 1 | 2 | 3 | 4

/** よくある語・並び（含んでいれば長くても弱い）。小文字で比べる */
const COMMON = ['password', 'passw0rd', 'qwerty', 'asdfgh', 'letmein', 'welcome', 'admin', 'iloveyou', 'abc123', '111111', '123456', 'monkey', 'dragon', 'sunshine', 'princess']

/** 4 字以上続けて 1 つずつ増える・減る並び（abcd・1234・9876） */
function hasRun(s: string, n = 4): boolean {
  let up = 1
  let down = 1
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1)
    up = d === 1 ? up + 1 : 1
    down = d === -1 ? down + 1 : 1
    if (up >= n || down >= n) return true
  }
  return false
}

/**
 * パスワードの強さの目安（0 は未入力、1 弱い〜4 とても強い）と、強くするための 1 文（3 未満のとき）。
 * 長さで段を決め（8 字未満 1・12 字未満 2・16 字未満 3・それ以上 4）、英小文字・英大文字・数字・記号のうち 3 種類以上なら 1 段上げ、
 * 1 種類だけなら 1 段下げる。同じ字の 3 回以上の繰り返し・続いた並び・よくある語を含めば 1 にする
 */
export function passwordStrength(pw: string): { score: PasswordScore; advice?: string } {
  if (!pw) return { score: 0 }
  const len = [...pw].length
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  const lower = pw.toLowerCase()
  const pattern = COMMON.some((w) => lower.includes(w)) || /(.)\1{2,}/u.test(pw) || hasRun(lower)
  let score = len < 8 ? 1 : len < 12 ? 2 : len < 16 ? 3 : 4
  if (kinds >= 3 && len >= 8) score += 1
  if (kinds === 1) score -= 1
  score = Math.min(4, Math.max(1, score))
  if (pattern) score = 1
  const advice = score >= 3 ? undefined : pattern ? '繰り返しや続いた並び、よくある語を避ける' : len < 12 ? '12 字以上にする' : '英大文字・数字・記号を混ぜる'
  return { score: score as PasswordScore, advice }
}

/** 強さの言葉（0 は未入力） */
export const PASSWORD_WORDS = ['', '弱い', 'やや弱い', '強い', 'とても強い'] as const

/**
 * パスワードの強さの目安。4 つの棒が左から順に伸び、強さで色（弱い --danger・やや弱い --warn・強い以上 --ok-ink）と言葉が変わる。
 * 言葉は RollingWord で回し、3 未満なら強くするための 1 文を添える。読み上げは meter（値は言葉）。
 * PasswordField（autoComplete="new-password"）の下に置く。ログインの欄には置かない
 */
export function PasswordStrength({ value, label = 'パスワードの強さ' }: { value: string; label?: string }) {
  const { score, advice } = passwordStrength(value)
  return (
    <div className={`pwstr s${score}`}>
      <div className="pwstr-row">
        <span className="pwstr-bars" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={score ? PASSWORD_WORDS[score] : '未入力'}>
          {[1, 2, 3, 4].map((i) => <span key={i} className={i <= score ? 'on' : undefined} />)}
        </span>
        <span className="pwstr-word" aria-hidden="true">{score > 0 && <RollingWord>{PASSWORD_WORDS[score]}</RollingWord>}</span>
      </div>
      {advice && <span className="pwstr-advice">{advice}</span>}
    </div>
  )
}
