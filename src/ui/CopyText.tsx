// 値そのものをコピーのボタンにする（メールアドレスなど）。ホバーで全体が押せる見た目になり、右にコピーのアイコンが出る。見た目は styles/components/button.css。

import { IconCheck, IconCopy } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { announce } from './A11y'

/** 文字列をコピーし、結果を読み上げる。copied はコピーの直後だけ true（アイコンと吹き出しを変える） */
export function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const fail = () => announce('コピーできませんでした', { assertive: true })
  const copy = () => {
    // http など、コピーの機能が無い環境でも黙って終わらせない
    if (!navigator.clipboard) return fail()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      // 続けて押したら、あとに押した分から数え直す
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
      announce('コピーしました')
    }, fail)
  }
  return { copied, copy }
}

/** label は何をコピーするか（「メールアドレス」）。読み上げの名前は「値 label をコピー」（見えている値を名前に含める。WCAG 2.5.3） */
export function CopyText({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy(text)
  return (
    <button type="button" className={`copytext ${copied ? 'copied' : ''}`} aria-label={`${text} ${label}をコピー`} data-tip={copied ? 'コピーしました' : 'コピー'} onClick={copy}>
      <span className="ct-v">{text}</span>
      <span className="ct-i">{copied ? <IconCheck size={14} stroke={1.8} /> : <IconCopy size={14} stroke={1.8} />}</span>
    </button>
  )
}
