// 値そのものをコピーのボタンにする（メールアドレスなど）。ホバーで全体が押せる見た目になり、右にコピーのアイコンが出る。見た目は styles/components/button.css。

import { IconCheck, IconCopy } from '@tabler/icons-react'
import { useState } from 'react'

import { announce } from './A11y'

/** 文字列をコピーし、結果を読み上げる。copied はコピーの直後だけ true（アイコンと吹き出しを変える） */
export function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
        announce('コピーしました')
      },
      () => announce('コピーできませんでした', { assertive: true }),
    )
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
