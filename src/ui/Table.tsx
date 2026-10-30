// 素の値を受け取る表。割合の濃淡は主要色（--chart-1）の濃さで示す。dense はカードの中に並べる狭い表（セルの余白を詰める）。
import { useRef, type ReactNode } from 'react'

import { useScrollFocus } from './A11y'
export interface TableCell { content: ReactNode; ratio?: number }
export function DataTable({ label, columns, rows, dense = false }: { label: string; columns: string[]; rows: TableCell[][]; dense?: boolean }) {
  // 狭い幅で横にスクロールするときは、キーボードでも送れるようにする
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, label)
  return <div ref={ref} className="data-table-scroll"><table className={`data-table${dense ? ' dense' : ''}`} aria-label={label}>
    <thead><tr>{columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell.content}</th> : <td key={j} className={cell.ratio == null ? '' : `heat-${Math.min(4, Math.max(0, Math.ceil(cell.ratio * 4)))}`}><span className="num">{cell.content}</span></td>)}</tr>)}</tbody>
  </table></div>
}
