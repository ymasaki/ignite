// 小さな印。見た目は styles/components/chip.css。
// Tag: 状態の印（区分・役割など） / Chip: 取り消せるタグ（絞り込みの差分） / Badge: 件数の丸

import { useState, type ReactNode } from 'react'
import { RollingNumber } from './Motion'

/** onClick を渡すと押せる印（対象を開くのでホバーで影） */
export function Tag({ variant = 'default', onClick, children }: { variant?: 'default' | 'accent' | 'dashed' | 'ok' | 'warn' | 'danger'; onClick?: () => void; children: ReactNode }) {
  const cls = `tag ${variant === 'default' ? '' : variant}`
  if (onClick)
    return (
      <button type="button" className={`${cls} link`} onClick={onClick}>
        {children}
      </button>
    )
  return <span className={cls}>{children}</span>
}

/** × で取り消せるタグ。onRemove の説明は removeLabel（読み上げ）と removeTip（ツールチップ）で書く */
export function Chip({ lead, strong = false, removeLabel, removeTip, onRemove, children }: { lead?: ReactNode; strong?: boolean; removeLabel: string; removeTip: string; onRemove: () => void; children: ReactNode }) {
  return (
    <span className={`chip ${lead ? 'has-lead' : ''} ${strong ? 'strong' : ''}`}>
      {lead}
      {children}
      <button type="button" aria-label={removeLabel} data-tip={removeTip} onClick={onRemove}>
        ×
      </button>
    </span>
  )
}

/**
 * 数が 0 のときは幅 0 に畳んでおき、数が付くと幅を広げながら出す（ボタンの幅と隣の検索欄がなめらかに動くように）。
 * 数の変化は RollingNumber で回す。0 に戻るときは前の数のまま縮めて消す
 */
export function Badge({ count }: { count: number }) {
  const [shown, setShown] = useState(count)
  if (count > 0 && count !== shown) setShown(count)
  return (
    <span className={`badge-slot${count > 0 ? '' : ' off'}`} aria-hidden={count > 0 ? undefined : true}>
      <span>
        <span className="badge num">
          <RollingNumber value={shown} />
        </span>
      </span>
    </span>
  )
}
