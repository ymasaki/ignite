import { ChartCard, CopyText, LinkButton, reducedMotion, Board, useScrollFocus } from '@ymasaki/ignite'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pageOf, specOf } from './nav'

const go = (el: Element | null | undefined, smooth = true) => el?.scrollIntoView({ block: 'start', behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
export const specEl = (root: ParentNode, id: string) => root.querySelector(`[data-spec="${id}"]`)

/** 面の中をスクロールするカタログのページ。右に目次を置き、今見ている標本を印で示す */
export function Page({ page, target, children }: { page: string; target?: string | null; children: ReactNode }) {
  const def = pageOf(page)
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState<string | null>(def?.specs[0]?.id ?? null)
  useScrollFocus(ref, def?.label ?? '')
  useEffect(() => {
    const box = ref.current
    if (!box || !def) return
    const update = () => {
      const top = box.getBoundingClientRect().top + 32
      const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 2
      const seen = def.specs.filter((s) => { const el = specEl(box, s.id); return el && el.getBoundingClientRect().top <= top })
      setOn(atEnd ? def.specs[def.specs.length - 1]?.id ?? null : seen[seen.length - 1]?.id ?? def.specs[0]?.id ?? null)
    }
    box.addEventListener('scroll', update, { passive: true })
    return () => box.removeEventListener('scroll', update)
  }, [def])
  useEffect(() => {
    if (target && ref.current) go(specEl(ref.current, target), false)
  }, [target])
  return (
    <Board>
      <div className="cat-wrap">
        <div className="cat" ref={ref}>
          <div className="cat-main">{children}</div>
          {!!def?.specs.length && (
            <div className="cat-toc" role="navigation" aria-label="このページの目次">
              {def.specs.map((s) => <div className="cat-toc-i" key={s.id} data-on={on === s.id || undefined}><LinkButton onClick={() => go(ref.current && specEl(ref.current, s.id))}>{s.title}</LinkButton></div>)}
            </div>
          )}
        </div>
      </div>
    </Board>
  )
}

/** 標本の 1 枚。見出し・見せる面・部品の名前（押すとコピー）を持つ。見出しと部品の名前は目録から読む */
export function Spec({ page, id, wide = false, tall = false, plain = false, center = false, children }: { page: string; id: string; wide?: boolean; tall?: boolean; plain?: boolean; center?: boolean; children: ReactNode }) {
  const s = specOf(page, id)
  return (
    <div className={`cat-spec${wide ? ' wide' : ''}`} data-spec={id}>
      <ChartCard title={s?.title ?? id}>
        <div className={`cat-stage${tall ? ' tall' : ''}${plain ? ' plain' : ''}${center ? ' center' : ''}`}>{children}</div>
        {!!s?.parts?.length && <div className="cat-parts">{s.parts.map((p) => <CopyText key={p} text={p} label="部品の名前" />)}</div>}
      </ChartCard>
    </div>
  )
}

/** 変種 1 つと、その名前 */
export function Case({ label, fill = false, children }: { label: string; fill?: boolean; children: ReactNode }) {
  return <div className={`cat-case${fill ? ' fill' : ''}`}><span className="cat-case-t">{label}</span>{children}</div>
}

/** 変種の並び */
export const Cases = ({ cols, children }: { cols?: 2 | 3; children: ReactNode }) => <div className={`cat-cases${cols ? ` cols${cols}` : ''}`}>{children}</div>
