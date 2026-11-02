// コードの表示（文中の Code、複数行の CodeBlock）。見た目は styles/components/code.css。

import { IconCheck, IconCopy } from '@tabler/icons-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { useScrollFocus } from './A11y'
import { IconButton } from './Button'
import { useCopy } from './CopyText'
import { CODE_LANGUAGES, codeLines, type CodeLanguage } from './codeTokens'

/** 文中の短いコード（関数名・コマンド・値） */
export function Code({ children }: { children: ReactNode }) {
  return <code className="code-inline">{children}</code>
}

/**
 * 複数行のコード・JSON・SQL・ログ・CLI の表示。title はファイル名など。label は読み上げ名とコピーのボタンの名前（既定は title か言語）。
 * lineNumbers は行番号、wrap は折り返し（既定は横スクロール）、maxLines は見せる行数の上限（超えた分は縦スクロール）
 */
export function CodeBlock({ code, language = 'plain', title, label, lineNumbers = false, wrap = false, maxLines }: { code: string; language?: CodeLanguage; title?: string; label?: string; lineNumbers?: boolean; wrap?: boolean; maxLines?: number }) {
  const name = label ?? title ?? CODE_LANGUAGES[language]
  const { copied, copy } = useCopy(code)
  const body = useRef<HTMLDivElement>(null)
  useScrollFocus(body, name)
  useEffect(() => {
    if (maxLines) body.current?.style.setProperty('--cb-lines', String(maxLines))
    else body.current?.style.removeProperty('--cb-lines')
  }, [maxLines])
  return (
    <figure className={`cb${lineNumbers ? ' numbered' : ''}${wrap ? ' wrap' : ''}${maxLines ? ' limited' : ''}`}>
      <figcaption className="cb-h">
        <span className="cb-t">{title ?? CODE_LANGUAGES[language]}</span>
        {title && language !== 'plain' && <span className="cb-l">{CODE_LANGUAGES[language]}</span>}
        <IconButton label={copied ? 'コピーしました' : `${name}をコピー`} onClick={copy}>{copied ? <IconCheck size={16} stroke={1.8} /> : <IconCopy size={16} stroke={1.8} />}</IconButton>
      </figcaption>
      <div className="cb-b" ref={body}>
        <pre><code>
          {codeLines(code, language).map((line, i) => (
            <span className="cb-ln" key={i}>
              {line.map((t, j) => <span key={j} className={[t.kind && `t-${t.kind}`, t.wide && 'cb-w'].filter(Boolean).join(' ') || undefined}>{t.text}</span>)}
              {'\n'}
            </span>
          ))}
        </code></pre>
      </div>
    </figure>
  )
}
