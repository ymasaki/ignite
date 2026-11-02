// 検索欄と、その下に出る候補の一覧。打つたびに候補を絞り、↑↓ で選び、Enter で確定する。WAI-ARIA の combobox
// （フォーカスは入力欄に置いたまま、aria-activedescendant で選んでいる候補を読み上げに伝える）。見た目は styles/components/search.css。

import { IconSearch } from '@tabler/icons-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { matchTerms, queryTerms, searchKey, startsWithTerm } from '../format/search'
import { announce } from './A11y'
import { useFocusShortcut, usePlaced } from './Controls'
import { EmptyState, SubHeading } from './Layout'
import { EntityRow, Highlight } from './List'

/** 候補の 1 行。title は名前、text は名前のほかに探せる文字、reading はよみ（かな。ローマ字でも引ける） */
export interface SuggestItem {
  key: string
  title: string
  text?: string
  reading?: string
  titleExtra?: ReactNode
  sub?: ReactNode
  lead?: ReactNode
  trailing?: ReactNode
}
/** 候補のまとまり。count は見出しの件数（既定は当たった数。出す行を絞るときの全体の数） */
export interface SuggestGroup {
  key: string
  label: string
  items: SuggestItem[]
  count?: number
}

const keys = new WeakMap<SuggestItem, string>()
const keyOf = (it: SuggestItem) => {
  let k = keys.get(it)
  if (k === undefined) keys.set(it, (k = searchKey(`${it.title} ${it.text ?? ''}`, it.reading)))
  return k
}

/** 入力に当たる候補をまとまりごとに選ぶ。語の先頭で当たるものを前に出し、1 つのまとまりは limit 行まで。件数は当たった全体の数 */
export function pickSuggestions(groups: SuggestGroup[], q: string, limit = 6): SuggestGroup[] {
  const terms = queryTerms(q)
  if (!terms.length) return []
  return groups.flatMap((g) => {
    const hits = g.items.filter((it) => matchTerms(keyOf(it), terms))
    if (!hits.length) return []
    const first = hits.filter((it) => startsWithTerm(keyOf(it), terms[0]))
    const rest = hits.filter((it) => !first.includes(it))
    return [{ ...g, count: hits.length, items: [...first, ...rest].slice(0, limit) }]
  })
}

/**
 * 検索欄の下に候補を出す。候補を渡すと、かな・カタカナ・全角半角の違いを吸収して部品が絞る。自前で絞る（サーバーで探す）ときは filter={false}。
 * more は一覧の下の操作を 1 つ（「ほかも含めて探す」など）。押しても一覧は閉じない。候補の一覧の中身は置き場所の幅で詰めず、狭い枠でも 360px まで広げる
 */
export function SearchSuggest({ value, onChange, groups, onSelect, label, placeholder, more, empty = '該当するものがありません', limit = 6, filter = true, shortcut = false, priority = 0 }: {
  value: string
  onChange: (v: string) => void
  groups: SuggestGroup[]
  onSelect: (item: SuggestItem) => void
  label: string
  placeholder: string
  more?: { label: string; onSelect: () => void }
  empty?: string
  limit?: number
  filter?: boolean
  shortcut?: boolean
  priority?: number
}) {
  const uid = useId()
  const listId = `${uid}-list`
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState(0)
  const target = useFocusShortcut(input, shortcut, priority)
  const q = value.trim()
  const shown = open && !!q
  const picked = useMemo(() => (filter ? pickSuggestions(groups, q, limit) : groups.filter((g) => g.items.length)), [filter, groups, q, limit])
  const items = picked.flatMap((g) => g.items)
  const count = items.length + (more ? 1 : 0)
  const total = picked.reduce((n, g) => n + (g.count ?? g.items.length), 0)
  const optId = (i: number) => `${uid}-${i}`
  usePlaced(body, shown)
  useEffect(() => setCur(0), [q])
  useEffect(() => {
    if (shown) document.getElementById(optId(cur))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, shown])
  // 件数を読み上げで知らせる（打ち終わるのを少し待つ）
  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => announce(total ? `候補 ${total}件` : empty), 500)
    return () => window.clearTimeout(t)
  }, [shown, q, total, empty])
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
  /** keyboard: キーボードで選んだ（続けて打てるようフォーカスを欄に残す。マウスで選んだときは外す） */
  const choose = (i: number, keyboard: boolean) => {
    if (i === items.length) return more?.onSelect()
    const it = items[i]
    if (!it) return
    setOpen(false)
    if (!keyboard) input.current?.blur()
    onSelect(it)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // 日本語の変換中のキーは欄に任せる（Safari は確定の Enter を isComposing なしの 229 で送る）
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!shown) return setOpen(true)
      if (count) setCur((c) => (c + (e.key === 'ArrowDown' ? 1 : -1) + count) % count)
    } else if (e.key === 'Enter' && shown) {
      e.preventDefault()
      choose(cur, true)
    } else if (e.key === 'Escape' && shown) {
      // 候補だけを閉じる。フォーカスは欄に残し、窓や詳細まで一緒に閉じない
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }
  let offset = 0
  return (
    // 入力欄と候補の外へ Tab で出たら閉じる
    <div className="popover suggest" ref={wrap} onBlur={(e) => !wrap.current?.contains(e.relatedTarget as Node | null) && setOpen(false)}>
      <span className="sfield">
        <IconSearch className="sfield-ic" size={16} stroke={1.7} aria-hidden="true" />
        <input ref={input} className="field" type="search" role="combobox" autoComplete="off" placeholder={placeholder} aria-label={label} aria-autocomplete="list" aria-expanded={shown} aria-controls={shown && count ? listId : undefined} aria-activedescendant={shown && count ? optId(cur) : undefined} value={value} onChange={(e) => (onChange(e.target.value), setOpen(true))} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        {target && (
          <kbd className="kbd-key" data-fit="hint">
            <span className="k-one">F</span>
            <span className="k-mod">⌘K</span>
          </kbd>
        )}
      </span>
      {shown && (
        <div ref={body} className="popover-body">
          {!items.length && <EmptyState inset>{empty}</EmptyState>}
          {count > 0 && (
            <div role="listbox" id={listId} aria-label={label}>
              {picked.map((g) => {
                const start = offset
                offset += g.items.length
                return (
                  <div key={g.key} role="group" aria-label={`${g.label} ${g.count ?? g.items.length}件`}>
                    <div aria-hidden="true"><SubHeading inset count={`${g.count ?? g.items.length}件`}>{g.label}</SubHeading></div>
                    {g.items.map((it, n) => (
                      <EntityRow key={it.key} id={optId(start + n)} tabIndex={-1} role="option" aria-selected={start + n === cur} active={start + n === cur} lead={it.lead} title={<Highlight text={it.title} q={q} />} titleExtra={it.titleExtra} sub={it.sub} trailing={it.trailing} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(start + n, false)} onMouseEnter={() => setCur(start + n)} />
                    ))}
                  </div>
                )
              })}
              {more && (
                // 押しても欄のフォーカスを保つ（行が増えても続けて打てる）
                <div id={optId(items.length)} role="option" aria-selected={cur === items.length} className={`select-opt suggest-more${cur === items.length ? ' on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(items.length, false)} onMouseEnter={() => setCur(items.length)}>{more.label}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
