// 素の値を受け取る表。割合の濃淡は主要色（--chart-1）の濃さで示す。dense はカードの中に並べる狭い表（セルの余白を詰める）。
// 並べ替えと選択は状態を持たない: 今の状態を受け取り、押されたことを返す（並べ替えた行を渡すのはアプリ）。
// stickyHead は表の枠を親の高さいっぱいの縦スクロールにし、列見出しを上に残す。depths（各行の深さ）は先頭の列を字下げし、
// stickyHead と一緒に渡すと、スクロールで見ている行の上位の行を見出しの下に積み、配下が流れ切ったら次の上位の行と入れ替える（tableSticky.ts）。
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

import { useScrollFocus } from './A11y'
import { Checkbox } from './Form'
import { Skeleton } from './Motion'
import { stickyRows } from './tableSticky'

export interface TableCell { content: ReactNode; ratio?: number }
export type TableColumn = string | { label: string; sortable?: boolean }
export interface TableSort { column: number; dir: 'asc' | 'desc' }
const colLabel = (c: TableColumn) => (typeof c === 'string' ? c : c.label)
const SORT_NAME = { asc: 'ascending', desc: 'descending' } as const
const NONE = new Map<number, number>()

/** 階層の表で、見出しの下に積む行（行番号 → 固定する位置）。depthKey が空なら積まない */
function useStuckRows(ref: RefObject<HTMLDivElement | null>, depthKey: string) {
  const [stuck, setStuck] = useState(NONE)
  useLayoutEffect(() => {
    const sc = ref.current
    const table = sc?.querySelector('table')
    if (!sc || !table || !depthKey) return setStuck(NONE)
    const depths = depthKey.split(',').map(Number)
    const update = () => {
      const body = table.tBodies[0]
      const head = table.tHead
      if (!body || !head || body.rows.length !== depths.length) return setStuck(NONE)
      const hs = [...body.rows].map((r) => r.getBoundingClientRect().height)
      const tops: number[] = []
      hs.reduce((y, h, i) => ((tops[i] = y), y + h), body.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop)
      const m = new Map(stickyRows(depths, tops, hs, sc.scrollTop + head.getBoundingClientRect().height, sc.scrollTop).map((r) => [r.i, r.top]))
      setStuck((cur) => ([...cur].join() === [...m].join() ? cur : m))
    }
    update()
    sc.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(sc)
    ro.observe(table)
    return () => {
      sc.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [ref, depthKey])
  return stuck
}

export function DataTable({ label, columns, rows, dense = false, sort, onSort, rowKeys, selected, onSelect, empty, loading = false, stickyHead = false, depths }: { label: string; columns: TableColumn[]; rows: TableCell[][]; dense?: boolean; sort?: TableSort; onSort?: (column: number) => void; rowKeys?: string[]; selected?: string[]; onSelect?: (keys: string[]) => void; empty?: ReactNode; loading?: boolean; stickyHead?: boolean; depths?: number[] }) {
  // 狭い幅で横にスクロールするときは、キーボードでも送れるようにする
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, label)
  const selecting = !!(rowKeys && selected && onSelect)
  const picked = new Set(selected)
  const allOn = !!rowKeys?.length && rowKeys.every((k) => picked.has(k))
  const toggle = (key: string) => onSelect?.(picked.has(key) ? selected!.filter((k) => k !== key) : [...selected!, key])
  const span = columns.length + (selecting ? 1 : 0)
  const stack = stickyHead && !loading && !!depths && depths.length === rows.length
  const stuck = useStuckRows(ref, stack ? depths.join(',') : '')
  const lastStuck = Math.max(-1, ...stuck.keys())
  return <div ref={ref} className={`data-table-scroll${stickyHead ? ' sticky' : ''}`}><table className={`data-table${dense ? ' dense' : ''}${selecting ? ' has-select' : ''}`} aria-label={label} aria-busy={loading || undefined}>
    <thead><tr>
      {selecting && <th scope="col" className="sel-cell"><Checkbox hideLabel label="すべて選ぶ" checked={allOn} indeterminate={!allOn && rowKeys!.some((k) => picked.has(k))} onChange={(on) => onSelect!(on ? rowKeys! : [])} /></th>}
      {columns.map((c, i) => {
        const on = sort?.column === i
        if (typeof c === 'string' || !c.sortable || !onSort) return <th key={i} scope="col">{colLabel(c)}</th>
        return <th key={i} scope="col" aria-sort={on ? SORT_NAME[sort!.dir] : 'none'}><button type="button" className={`th-sort${on ? ' on' : ''}`} onClick={() => onSort(i)}>{c.label}{on ? (sort!.dir === 'asc' ? <IconChevronUp size={14} stroke={1.8} aria-hidden="true" /> : <IconChevronDown size={14} stroke={1.8} aria-hidden="true" />) : <IconSelector size={14} stroke={1.8} aria-hidden="true" />}</button></th>
      })}
    </tr></thead>
    <tbody>
      {loading ? <tr><td colSpan={span} className="table-note"><Skeleton variant="compact" /></td></tr>
        : !rows.length && empty ? <tr><td colSpan={span} className="table-note">{empty}</td></tr>
        : rows.map((row, i) => {
          const key = rowKeys?.[i]
          const name = typeof row[0]?.content === 'string' ? row[0].content : `${i + 1}行目`
          const d = depths?.[i]
          // 積んだ行は位置を --stuck-top で渡し、浅い段ほど手前に置く（押し上げた行は上の段の下へ潜る）
          const top = stuck.get(i)
          const vars: Record<string, string | number> = {}
          if (d != null) vars['--depth'] = d
          if (top != null) Object.assign(vars, { '--stuck-top': `${top}px`, '--stuck-z': Math.max(1, 10 - (d ?? 0)) })
          const style = Object.keys(vars).length ? (vars as CSSProperties) : undefined
          const cls = [key != null && picked.has(key) ? 'sel' : '', top != null ? 'stuck' : '', i === lastStuck ? 'stuck-last' : ''].filter(Boolean).join(' ')
          return <tr key={key ?? i} className={cls || undefined} style={style}>
            {selecting && <td className="sel-cell"><Checkbox hideLabel label={`${name}を選ぶ`} checked={picked.has(key!)} onChange={() => toggle(key!)} /></td>}
            {row.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell.content}{d != null && <span className="sr-only">（第{d + 1}階層）</span>}</th> : <td key={j} className={cell.ratio == null ? '' : `heat-${Math.min(4, Math.max(0, Math.ceil(cell.ratio * 4)))}`}><span className="num">{cell.content}</span></td>)}
          </tr>
        })}
    </tbody>
  </table></div>
}
