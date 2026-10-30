// 区切り・見出し・項目の一覧・空の状態・パンくず。見た目は styles/components/layout.css。

import { Fragment, type ReactNode } from 'react'

/**
 * 一覧の画面の型。上に絞り込みの帯（tools：SearchField・Select・Segmented）と件数、
 * その下に notice（普段と違う状態のときだけ）、残りが一覧。見出しや説明文は置かない（画面の名前はヘッダーにある）。
 * layout は並べ方: tiles（格子に並べた EntityRow size="lg"。人の一覧）/ comparison（変更前後の比較）。
 * 一覧が空のときは children の代わりに empty（EmptyState）を出す
 */
export function ListScreen({ tools, count, notice, layout, empty, children }: { tools: ReactNode; count?: ReactNode; notice?: ReactNode; layout: 'tiles' | 'comparison'; empty?: ReactNode; children?: ReactNode }) {
  return (
    <div className="lscreen">
      <ScreenBar count={count}>{tools}</ScreenBar>
      {notice}
      <div className="lscreen-body">{empty || <div className={`lscreen-list ${layout}`}>{children}</div>}</div>
    </div>
  )
}

/** 内容の面（1 枚の白い面）。画面の中身はこの中に置く（一覧は ListScreen を入れる。ダッシュボードと設定は面を持たない・自分で持つ） */
export function Board({ children }: { children: ReactNode }) {
  return <section className="board"><div className="view">{children}</div></section>
}

/** ダッシュボードの型。AppShell の aux に KPI の帯を、ここに ChartGrid を置く（この中をスクロールする） */
export function DashboardScreen({ children }: { children: ReactNode }) {
  return <div className="dash">{children}</div>
}

/**
 * 内容の枠の上の絞り込みの帯（SearchField・Select・Segmented を並べ、右端に件数）。一覧の画面（ListScreen）と
 * 年表などほかの画面の帯でも共通。画面ごとに帯を作り分けない
 */
export function ScreenBar({ count, children }: { count?: ReactNode; children: ReactNode }) {
  return (
    <div className="lscreen-bar">
      {children}
      {/* 件数は絞るたびに変わるので、読み上げにも知らせる（status） */}
      {count != null && <span className="lscreen-n num" role="status">{count}</span>}
    </div>
  )
}

/** 普段と違う状態の知らせ（1 文・32 字まで）。詳しい事情は tip（ホバーで出す）に回す */
export function Notice({ tip, children }: { tip?: string; children: ReactNode }) {
  return (
    <div className="notice" role="status" data-tip={tip}>
      {children}
    </div>
  )
}

/**
 * 人が書いた本文（自己紹介など）。画面の文言ではないので長くてよい。改行はそのまま。
 * 長いときの省略は Expandable で包む（行数で切る・続きを読む・開閉の動きは Expandable の役目）
 */
export function Prose({ children }: { children: ReactNode }) {
  return <div className="prose">{children}</div>
}

/**
 * まとまりの見出しと中身（詳細パネルの区切り、横に並べたまとまり）。見出しは 14px・太字で、下に薄い青の線を引く。
 * count は件数（灰色）、action は右端の操作
 */
export function Section({ title, count, action, level = 3, children }: { title: ReactNode; count?: ReactNode; action?: ReactNode; level?: 2 | 3; children: ReactNode }) {
  const Heading = `h${level}` as const
  return (
    <section className="section">
      <div className="section-h">
        {/* 見出しの段。詳細パネルの中は h2 の下なので既定は h3、画面の直下に置くときは level={2}。見た目は .section-h のまま */}
        <Heading className="section-t">
          {title}
          {count != null && <span className="section-c num">{count}</span>}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  )
}

/** 一覧の中の小見出し（まとまりごと・検索結果の種類ごと）。lead はロゴなど、count は件数、onClick で見出しを押せる */
export function SubHeading({ lead, count, inset = false, onClick, children }: { lead?: ReactNode; count?: ReactNode; inset?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <div className={`subhead ${inset ? 'inset' : ''}`}>
      {lead}
      <span className="sh-t">
        {onClick ? (
          <button type="button" onClick={onClick}>
            {children}
          </button>
        ) : (
          children
        )}
      </span>
      {count != null && <span className="sh-c num">{count}</span>}
    </div>
  )
}

/** 「ラベル：値」の 2 列。値が空（null / undefined / ''）の行は出さない */
export function KeyValues({ rows }: { rows: [label: string, value: ReactNode, opts?: { block?: boolean; num?: boolean }][] }) {
  return (
    <dl className="kv">
      {rows
        .filter(([, v]) => v != null && v !== '' && v !== false)
        .map(([label, v, o]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd className={`${o?.block ? 'block' : ''} ${o?.num ? 'num' : ''}`}>{v}</dd>
          </Fragment>
        ))}
    </dl>
  )
}

/**
 * 該当なし・空の表示。title があれば大きい表示（アイコン・見出し・説明）、なければ一覧の中の 1 行の説明。
 * 空欄にせず、なぜ空か・どうすればよいかを書く
 */
export function EmptyState({ icon, title, inset = false, children }: { icon?: ReactNode; title?: ReactNode; inset?: boolean; children: ReactNode }) {
  if (!title) return <p className={`empty ${inset ? 'inset' : ''}`}>{children}</p>
  return (
    <div className="empty-state">
      {icon}
      <b>{title}</b>
      <p>{children}</p>
    </div>
  )
}

/** パンくず（上位の階層）。variant="boxed" は内容の上に重ねる枠付き。name は読み上げ用の名前。current は最後に添える今いる場所（押せない） */
export function Crumbs<T>({ items, label, onPick, variant = 'plain', name = '上位の階層', current }: { items: T[]; label: (x: T) => string; onPick: (x: T) => void; variant?: 'plain' | 'boxed'; name?: string; current?: string }) {
  if (!items.length) return null
  return (
    <nav className={`crumbs ${variant}`} aria-label={name}>
      {items.map((x, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="sep">›</span>}
          <button type="button" onClick={() => onPick(x)}>
            {label(x)}
          </button>
        </Fragment>
      ))}
      {variant === 'boxed' && <span className="sep">›</span>}
      {current && (
        <>
          <span className="sep">›</span>
          <span aria-current="page">{current}</span>
        </>
      )}
    </nav>
  )
}
