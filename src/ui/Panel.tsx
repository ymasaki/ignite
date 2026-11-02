// 詳細パネルの中身の枠（DESIGN.md「詳細パネル」）。見た目は styles/components/panel.css。
//
//  ┌ 上段: 任意の操作（actions）………………… × ┐
//  │ 大きな顔／アイコン  補足（kicker）      │
//  │                    名前（20px）        │
//  └                    下の行（lines）      ┘
//
// 名前がスクロールで隠れたら、同じ内容を小さくした固定ヘッダーを出す（高さ 0 の sticky に重ねるので本文は動かない）。

import { IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { IconButton } from './Button'

// 固定ヘッダーの高さ（styles/components/panel.css の .pstick-bar と合わせる）
const STICK_H = 64

/** 見出し（名前）の下端が固定ヘッダーの下に入ったら true */
function useStuck<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = ref.current
    const sc = el?.closest('.panel, .drawer')
    if (!el || !sc) return
    // スクロールしていないときは出さない（補足のない見出しは名前が上に詰まり、スクロールしなくても固定ヘッダーの高さより上に来るため）
    const check = () => setStuck(sc.scrollTop > 0 && el.getBoundingClientRect().bottom < sc.getBoundingClientRect().top + STICK_H)
    check()
    sc.addEventListener('scroll', check, { passive: true })
    return () => sc.removeEventListener('scroll', check)
  }, [])
  return [ref, stuck] as const
}

/** 詳細パネルの中身の枠（開いたまま別のものに切り替えたときは、中身だけ静かに入れ替える）。header の下に本文（PanelBody）を置く */
export function PanelFrame({ children }: { children: ReactNode }) {
  return <div className="pwrap">{children}</div>
}

/** 詳細パネルの本文（見出しの下。本文の左右の余白） */
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="pb">{children}</div>
}

export function PanelHeader({
  visual,
  smallVisual,
  kicker,
  title,
  lines,
  stickySub,
  actions,
  onClose,
}: {
  /** 大きな顔アイコン・アイコン（72px） */
  visual: ReactNode
  /** 固定ヘッダーの小さな顔アイコン・アイコン */
  smallVisual: ReactNode
  /** 名前の上の補足 */
  kicker?: ReactNode
  title: string
  /** 名前の下の行 */
  lines?: ReactNode
  /** 固定ヘッダーの補足 */
  stickySub?: string
  /** × の左に置く任意のボタン。省略できる（上段と固定ヘッダーの両方に出す） */
  actions?: ReactNode
  onClose?: () => void
}) {
  const [titleRef, stuck] = useStuck<HTMLHeadingElement>()
  const close = (
    <IconButton label="詳細を閉じる" tip="閉じる" onClick={onClose}>
      <IconX size={16} stroke={1.8} />
    </IconButton>
  )
  return (
    <>
      <div className={`pstick ${stuck ? 'on' : ''}`} inert={!stuck}>
        <div className="pstick-bar">
          {smallVisual}
          <div className="pstick-t">
            <b>{title}</b>
            {stickySub && <span>{stickySub}</span>}
          </div>
          {/* スクロールして見出しが隠れても、操作は固定ヘッダーから押せる（上段と同じボタン） */}
          {actions}
          {close}
        </div>
      </div>
      <div className="ph">
        {actions}
        {close}
      </div>
      <div className="prof">
        {visual}
        <div className="prof-t">
          {kicker && <div className="prof-k">{kicker}</div>}
          <h2 /* design-ok: 詳細パネルの見出しそのもの */ className="prof-n" ref={titleRef}>
            {title}
          </h2>
          {lines}
        </div>
      </div>
    </>
  )
}
