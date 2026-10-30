// 移動と開閉の部品（ページ送り・操作のメニュー・開閉の並び）。見た目は styles/components/navigation.css。

import { IconChevronDown, IconChevronLeft, IconChevronRight, IconDots } from '@tabler/icons-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button, IconButton } from './Button'
import { Popover } from './Controls'
import { Collapse } from './Motion'

/** 並べるページの番号。最初・最後・今のページの前後を残し、間を '…' にする（1 つだけ飛ぶなら番号のまま） */
export function pageItems(page: number, count: number, around = 1): (number | '…')[] {
  const keep = [...new Set([1, count, ...Array.from({ length: around * 2 + 1 }, (_, i) => page - around + i)])].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  return keep.flatMap((p, i) => {
    const gap = p - (keep[i - 1] ?? p)
    return gap === 2 ? [p - 1, p] : gap > 2 ? ['…' as const, p] : [p]
  })
}

/** 長い一覧のページ送り（1 ページ目が 1）。枠が狭ければ番号の代わりに「3 / 20」を出す */
export function Pagination({ page, count, onChange, label = 'ページ送り' }: { page: number; count: number; onChange: (page: number) => void; label?: string }) {
  if (count <= 1) return null
  return (
    <nav className="pagination" aria-label={label}>
      <div className="pg-row">
        <IconButton label="前のページ" disabled={page <= 1} onClick={() => onChange(page - 1)}><IconChevronLeft size={16} stroke={1.8} /></IconButton>
        {pageItems(page, count).map((p, i) => (p === '…' ? <span key={`gap${i}`} className="pg-gap" aria-hidden="true">…</span> : <button key={p} type="button" className="pg-n num" aria-label={`${p}ページ目`} aria-current={p === page ? 'page' : undefined} onClick={() => p !== page && onChange(p)}>{p}</button>))}
        <span className="pg-cur num">{page} / {count}</span>
        <IconButton label="次のページ" disabled={page >= count} onClick={() => onChange(page + 1)}><IconChevronRight size={16} stroke={1.8} /></IconButton>
      </div>
    </nav>
  )
}

export interface MenuItem {
  key: string
  label: string
  icon?: ReactNode
  /** 取り消せない操作（文字が --danger になる） */
  danger?: boolean
  disabled?: boolean
  /** 前に区切りの線を引く */
  separator?: boolean
  onSelect: () => void
}

/** ボタンから開く操作の一覧（値を選ぶなら Select）。icon だけを渡すとアイコンのボタンになる。↑↓・Home・End で移り、Enter で実行、Esc で閉じる */
export function Menu({ label, items, icon, iconOnly = false }: { label: string; items: MenuItem[]; icon?: ReactNode; iconOnly?: boolean }) {
  const list = useRef<HTMLDivElement>(null)
  const onKey = (e: KeyboardEvent) => {
    const all = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || [])]
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    const to = e.key === 'ArrowDown' ? (i + 1) % all.length : e.key === 'ArrowUp' ? (i - 1 + all.length) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : null
    if (to === null) return
    e.preventDefault()
    all[to]?.focus()
  }
  return (
    <Popover
      className="select menu"
      trigger={(open, toggle) => {
        const a11y = { 'aria-haspopup': 'menu', 'aria-expanded': open, onClick: toggle } as const
        return iconOnly ? <IconButton label={label} {...a11y}>{icon ?? <IconDots size={16} stroke={1.8} />}</IconButton> : <Button active={open} icon={icon} {...a11y}>{label}<IconChevronDown size={15} stroke={1.8} aria-hidden="true" /></Button>
      }}
    >
      {(close) => (
        <div
          role="menu"
          aria-label={label}
          ref={(el) => {
            // 開いた最初の 1 回だけ、先頭の項目へ
            if (el && list.current !== el) el.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
            list.current = el
          }}
          onKeyDown={onKey}
        >
          {items.map((it) => (
            <div key={it.key} role="none">
              {it.separator && <div className="menu-sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`select-opt${it.danger ? ' danger' : ''}`}
                disabled={it.disabled}
                onClick={(e) => {
                  const back = e.currentTarget.closest('.popover')?.querySelector<HTMLElement>('[aria-expanded]')
                  close()
                  back?.focus()
                  it.onSelect()
                }}
              >
                {it.icon && <span className="sel-lead">{it.icon}</span>}
                <span className="sel-label">{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </Popover>
  )
}

export interface AccordionItem {
  key: string
  title: ReactNode
  /** 見出しの右の補足（件数など） */
  meta?: ReactNode
  children: ReactNode
}

/** 見出しを押して開閉するまとまりの並び。既定は 1 つだけ開き、multiple で同時に開ける。見出しの段は level（既定 h3） */
export function Accordion({ items, multiple = false, defaultOpen = [], level = 3 }: { items: AccordionItem[]; multiple?: boolean; defaultOpen?: string[]; level?: 2 | 3 | 4 }) {
  const [open, setOpen] = useState(defaultOpen)
  const H = `h${level}` as 'h3'
  const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : multiple ? [...o, key] : [key]))
  return (
    <div className="accordion">
      {items.map((it) => {
        const on = open.includes(it.key)
        return (
          <div key={it.key} className="ac-item">
            <H className="ac-h">
              <button type="button" aria-expanded={on} onClick={() => toggle(it.key)}>
                <span className="ac-t">{it.title}</span>
                {it.meta != null && <span className="ac-m num">{it.meta}</span>}
                <IconChevronDown className="ac-chev" size={16} stroke={1.8} aria-hidden="true" />
              </button>
            </H>
            <Collapse open={on}><div className="ac-body">{it.children}</div></Collapse>
          </div>
        )
      })}
    </div>
  )
}
