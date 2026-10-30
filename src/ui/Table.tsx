// 素の値を受け取る表。割合の濃淡は主要色（--chart-1）の濃さで示す。dense はカードの中に並べる狭い表（セルの余白を詰める）。
// 並べ替えと選択は状態を持たない: 今の状態を受け取り、押されたことを返す（並べ替えた行を渡すのはアプリ）。
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react'
import { useRef, type ReactNode } from 'react'

import { useScrollFocus } from './A11y'
import { Checkbox } from './Form'
import { Skeleton } from './Motion'
export interface TableCell { content: ReactNode; ratio?: number }
export type TableColumn = string | { label: string; sortable?: boolean }
export interface TableSort { column: number; dir: 'asc' | 'desc' }
const colLabel = (c: TableColumn) => (typeof c === 'string' ? c : c.label)
const SORT_NAME = { asc: 'ascending', desc: 'descending' } as const

export function DataTable({ label, columns, rows, dense = false, sort, onSort, rowKeys, selected, onSelect, empty, loading = false }: { label: string; columns: TableColumn[]; rows: TableCell[][]; dense?: boolean; sort?: TableSort; onSort?: (column: number) => void; rowKeys?: string[]; selected?: string[]; onSelect?: (keys: string[]) => void; empty?: ReactNode; loading?: boolean }) {
  // 狭い幅で横にスクロールするときは、キーボードでも送れるようにする
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, label)
  const selecting = !!(rowKeys && selected && onSelect)
  const picked = new Set(selected)
  const allOn = !!rowKeys?.length && rowKeys.every((k) => picked.has(k))
  const toggle = (key: string) => onSelect?.(picked.has(key) ? selected!.filter((k) => k !== key) : [...selected!, key])
  const span = columns.length + (selecting ? 1 : 0)
  return <div ref={ref} className="data-table-scroll"><table className={`data-table${dense ? ' dense' : ''}${selecting ? ' has-select' : ''}`} aria-label={label} aria-busy={loading || undefined}>
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
          return <tr key={key ?? i} className={key != null && picked.has(key) ? 'sel' : undefined}>
            {selecting && <td className="sel-cell"><Checkbox hideLabel label={`${name}を選ぶ`} checked={picked.has(key!)} onChange={() => toggle(key!)} /></td>}
            {row.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell.content}</th> : <td key={j} className={cell.ratio == null ? '' : `heat-${Math.min(4, Math.max(0, Math.ceil(cell.ratio * 4)))}`}><span className="num">{cell.content}</span></td>)}
          </tr>
        })}
    </tbody>
  </table></div>
}
