// 線でつないだツリー（TreeChart）と、その節（TreeCard・TreePill）。Canvas の中に置くと、節の位置合わせ・ミニマップが働く。
// 見た目は styles/components/tree.css

import { IconChevronDown } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

import { useCanvas } from './Canvas'
import { Collapse } from './Motion'

export interface TreeItem {
  id: string
  children?: TreeItem[]
  /** 子を横の列に並べる。省略時は根だけが列で、それ以外は親の下に縦に積む（積んだ子は開閉できる） */
  columns?: boolean
}

/** render に渡す節の状態 */
export interface TreeNodeState {
  depth: number
  /** 縦に積む子が開いているか（列に並べる子は常に出す） */
  open: boolean
  /** 開閉できる子の数（縦に積む子の数。列に並べる節では 0） */
  hidden: number
  /** 縦に積む子を開閉する。開閉の間、その節の画面上の位置を保つ */
  toggle: () => void
}

/**
 * 線でつないだツリー。根を上に置き、columns の節の子は横の列に（上の横線から下りる）、それ以外の子は親の下に縦に積む（左の縦線から入る）。
 * 縦に積む子は open（省略時は内部で持つ。最初は defaultOpen）で開閉し、開閉は Collapse で伸び縮みさせる。
 * 節の中身は render で描く（TreeCard・TreePill など）。selected の節はミニマップでも強調する
 */
export function TreeChart<T extends TreeItem>({
  root,
  render,
  open,
  defaultOpen = [],
  onToggle,
  selected,
}: {
  root: T
  render: (item: T, state: TreeNodeState) => ReactNode
  open?: ReadonlySet<string>
  defaultOpen?: string[]
  onToggle?: (id: string, open: boolean) => void
  selected?: string | null
}) {
  const canvas = useCanvas()
  const [own, setOwn] = useState<ReadonlySet<string>>(() => new Set(defaultOpen))
  const opened = open ?? own
  const kids = (n: T) => (n.children ?? []) as T[]
  const cols = (n: T, depth: number) => n.columns ?? depth === 0

  const node = (n: T, depth: number, parent: string | undefined, rail: boolean) => {
    const isOpen = opened.has(n.id)
    const hidden = cols(n, depth) ? 0 : kids(n).length
    const toggle = () => {
      // 開閉で中身の大きさが変わっても、押した節が画面上で動かないように（伸び縮みの間）
      canvas?.hold(n.id, 600)
      const next = new Set(opened)
      if (isOpen) next.delete(n.id)
      else next.add(n.id)
      if (!open) setOwn(next)
      onToggle?.(n.id, !isOpen)
    }
    return (
      <div className="tree-node" data-node={n.id} data-parent={parent} data-edge={rail ? 'rail' : undefined} data-on={selected === n.id || undefined}>
        {render(n, { depth, open: isOpen, hidden, toggle })}
      </div>
    )
  }
  /** 節の下（列に並べる子、または縦に積む子） */
  const below = (n: T, depth: number): ReactNode => {
    const cs = kids(n)
    if (!cs.length) return null
    if (cols(n, depth))
      return (
        <>
          <div className="tree-stem" />
          <div className="tree-cols">
            {cs.map((c) => (
              <div className={`tree-col ${cols(c, depth + 1) && kids(c).length ? 'wide' : ''}`} key={c.id}>
                {node(c, depth + 1, n.id, false)}
                {below(c, depth + 1)}
              </div>
            ))}
          </div>
        </>
      )
    return (
      <Collapse open={opened.has(n.id)}>
        <div className="tree-stack">
          {cs.map((c) => (
            <div className="tree-item" key={c.id}>
              {node(c, depth + 1, n.id, true)}
              {below(c, depth + 1)}
            </div>
          ))}
        </div>
      </Collapse>
    )
  }
  return (
    <div className="tree">
      {node(root, 0, undefined, false)}
      {below(root, 0)}
    </div>
  )
}

/**
 * ツリーの節のカード。カード全体が 1 つのボタン（name が読み上げの名前）で、中の操作（人名のボタンなど）は上に重ねて別に押せる。
 * 並び: lead（アイコン）＋ label（小さな種別）・title → sub（責任者など）… meta（件数など）→ children → more（閉じているときの「子 N 件」など）→ 開閉。
 * size は文字と余白、level は枠の強さ（1 が最上位で濃く太い）、dashed は点線の枠（補助の節）
 */
export function TreeCard({
  title,
  name,
  label,
  lead,
  sub,
  meta,
  more,
  size = 'sm',
  level,
  dashed = false,
  selected = false,
  dim = false,
  onClick,
  state,
  children,
}: {
  title: ReactNode
  /** 読み上げの名前（種別・件数・開閉の状態を含めて書く） */
  name: string
  label?: ReactNode
  lead?: ReactNode
  sub?: ReactNode
  meta?: ReactNode
  /** 子が閉じているときに出す補足（「子 3 件」など） */
  more?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  level?: 1 | 2 | 3 | 4
  dashed?: boolean
  selected?: boolean
  /** ほかを強調しているときに薄くする */
  dim?: boolean
  onClick?: () => void
  /** TreeChart の render から受け取った状態。渡すと開閉のボタンを出す */
  state?: TreeNodeState
  children?: ReactNode
}) {
  const canToggle = !!state && state.hidden > 0
  return (
    <div className={`tree-card s-${size} ${level ? `lv-${level}` : ''} ${dashed ? 'dashed' : ''} ${selected ? 'on' : ''} ${dim ? 'dim' : ''} ${canToggle ? 'has-toggle' : ''}`}>
      <button type="button" className="tc-hit" aria-label={name} aria-current={selected || undefined} onClick={onClick} />
      <span className="tc-top">
        {lead && <span className="tc-lead">{lead}</span>}
        <span className="tc-titles">
          {label && <span className="tc-label">{label}</span>}
          <span className="tc-title">{title}</span>
        </span>
      </span>
      {(sub || meta) && (
        <span className="tc-row">
          <span className="tc-sub">{sub}</span>
          {meta && (
            <span className="tc-meta num" aria-hidden="true">
              {meta}
            </span>
          )}
        </span>
      )}
      {children}
      {canToggle && !state.open && more && <span className="tc-more num">{more}</span>}
      {canToggle && (
        <button type="button" className={`tc-toggle ${state.open ? 'open' : ''}`} aria-label={`${name}の下を${state.open ? '閉じる' : '開く'}`} data-tip={state.open ? '閉じる' : '開く'} aria-expanded={state.open} onClick={state.toggle}>
          <IconChevronDown size={14} stroke={1.8} />
        </button>
      )}
    </div>
  )
}

/** ツリーの丸い節（列をまとめる見出しの人・グループなど）。lead に顔アイコン、上に小さな label、下に title。onClick で押せる */
export function TreePill({ title, label, lead, name, selected = false, dim = false, onClick }: { title: ReactNode; label?: ReactNode; lead?: ReactNode; name?: string; selected?: boolean; dim?: boolean; onClick?: () => void }) {
  const body = (
    <>
      {lead && <span className="tp-lead">{lead}</span>}
      <span className="tp-text">
        {label && <span className="tp-label">{label}</span>}
        <span className="tp-title">{title}</span>
      </span>
    </>
  )
  const cls = `tree-pill ${selected ? 'on' : ''} ${dim ? 'dim' : ''}`
  return onClick ? (
    <button type="button" className={cls} aria-label={name} aria-current={selected || undefined} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls} role="group" aria-label={name}>
      {body}
    </div>
  )
}
