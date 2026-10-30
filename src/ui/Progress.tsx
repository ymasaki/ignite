// 進み具合の部品（回転・進み具合の棒・段階）。見た目は styles/components/progress.css。

import { IconCheck } from '@tabler/icons-react'

/** 待ち時間が読めない処理の印。領域の読み込みには Skeleton を使い、これはボタンの中や小さな更新に使う。label が空なら飾り（読み上げない） */
export function Spinner({ label = '読み込み中', size = 'sm' }: { label?: string; size?: 'sm' | 'lg' }) {
  return <span className={`spinner ${size}`} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} />
}

/** 処理の進み具合。value は 0〜100、null は進みが測れない処理。showValue で右に % を出す */
export function ProgressBar({ value, label, showValue = false }: { value: number | null; label: string; showValue?: boolean }) {
  const v = value == null ? null : Math.min(100, Math.max(0, value))
  return (
    <div className="progress">
      <div className={`pg-track${v == null ? ' unknown' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v ?? undefined}>
        <span style={v == null ? undefined : { width: `${v}%` }} />
      </div>
      {showValue && v != null && <span className="num">{Math.round(v)}%</span>}
    </div>
  )
}

/** 順に進む手続きの今いる段階。current は今の段階の番号（0 から）。枠が狭ければ縦に並ぶ */
export function Steps({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <div className="steps-box">
      <ol className="steps" aria-label={label}>
        {steps.map((s, i) => (
          <li key={s} className={i < current ? 'done' : i === current ? 'now' : undefined} aria-current={i === current ? 'step' : undefined}>
            <span className="st-mark num" aria-hidden="true">{i < current ? <IconCheck size={14} stroke={2.4} /> : i + 1}</span>
            <span>{s}{i < current && <span className="sr-only">（完了）</span>}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
