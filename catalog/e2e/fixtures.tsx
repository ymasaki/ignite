// 操作テスト専用の見本。カタログの実例では作れない条件（あとから増える件数・フォームの中の欄など）を、
// 監査サーバー（Vite）が配るこのファイルをテストがページへ読み込んで描く。カタログの画面とビルドには入らない。
import { Expandable, FormField, NumberField, Pagination, SearchSuggest, Select } from '@ymasaki/ignite'
import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

declare global {
  interface Window {
    /** テストから見本の状態を変える入口 */
    fx?: (v: string) => void
  }
}

/** テストから値を差し替えられる状態 */
function useFx(initial: string): string {
  const [v, setV] = useState(initial)
  useEffect(() => {
    window.fx = setV
    return () => { delete window.fx }
  }, [])
  return v
}

/** 件数をあとから読み込む一覧のページ送り（最初は 1 ページ） */
function PaginationFx() {
  const count = Number(useFx('1'))
  return <Pagination page={1} count={count} onChange={() => undefined} />
}

/** フォームの中の数の欄。送信したときの値を出す */
function NumberFx() {
  const [value, setValue] = useState<number | null>(1)
  const [sent, setSent] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSent(String(value)) }}>
      <FormField label="数"><NumberField value={value} onChange={setValue} /></FormField>
      <button type="submit">送信</button>
      <output data-sent>{sent}</output>
    </form>
  )
}

/** 短い名前と、同じ幅の長い名前 2 つ */
function SelectFx() {
  const value = useFx('a')
  return <Select label="対象" value={value} onChange={() => undefined} options={[{ value: 'a', label: '短' }, { value: 'b', label: '長い名前の選択肢その一' }, { value: 'c', label: '長い名前の選択肢その二' }]} />
}

/** 中に動きのある要素を持つ本文 */
function ExpandFx() {
  return (
    <div style={{ width: 320 }}>
      <Expandable lines={2}>
        <p>{'開閉する本文の見本。'.repeat(20)}<span data-inner>語</span></p>
      </Expandable>
    </div>
  )
}

/** 絞り込みを外に任せる検索（候補の数が外から変わる） */
function SuggestFx() {
  const n = Number(useFx('3'))
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState('')
  const items = Array.from({ length: n }, (_, i) => ({ key: String(i), title: `候補${i + 1}` }))
  return (
    <>
      <SearchSuggest value={q} onChange={setQ} groups={[{ key: 'g', label: '候補', items }]} onSelect={(it) => setPicked(it.title)} label="検索" placeholder="検索" filter={false} />
      <output data-picked>{picked}</output>
    </>
  )
}

const FIXTURES: Record<string, () => ReactNode> = { pagination: PaginationFx, number: NumberFx, select: SelectFx, expand: ExpandFx, suggest: SuggestFx }

/** カタログの画面を隠し、見本だけを描く */
export function mount(name: string) {
  const Fx = FIXTURES[name]
  if (!Fx) throw new Error(`見本がありません: ${name}`)
  document.getElementById('root')!.style.display = 'none'
  const host = document.createElement('div')
  host.id = 'fx'
  host.style.padding = '24px'
  document.body.append(host)
  createRoot(host).render(<Fx />)
}
