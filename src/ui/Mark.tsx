// マーカー色（利用者が選んで塗るハイライト）の選択。見た目は styles/components/controls.css の .marks と、塗る側の [data-mark]。
// 色は --mark-1〜5（DESIGN.md 2 章の例外。色だけで伝えないよう、ボタンの名前に色の名前を入れる）

import { IconBan, IconCheck } from '@tabler/icons-react'

/** マーカー色の名前（--mark-1〜5 の順） */
export const MARK_NAMES = ['黄', '緑', '青', '紫', '桃'] as const

/** 色を選ぶ（0 は塗らない）。選んでいるものは押し込まれた状態（aria-pressed） */
export function MarkPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="marks" role="group" aria-label={label}>
      {[0, ...MARK_NAMES.map((_, i) => i + 1)].map((n) => {
        const name = n ? MARK_NAMES[n - 1] : 'なし'
        return (
          <button key={n} type="button" className="mark-sw" data-mark={n || undefined} aria-pressed={value === n} aria-label={name} data-tip={name} onClick={() => onChange(n)}>
            {n === 0 ? <IconBan size={14} stroke={1.8} aria-hidden="true" /> : value === n && <IconCheck size={14} stroke={2} aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
