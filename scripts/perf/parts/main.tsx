// 部品を数百個並べた負荷の見本。scripts/perf/parts.mjs が ?case= で 1 つずつ開いて測る。カタログと配布物には入らない。
import '@ymasaki/ignite/styles.css'
import { AppShell, Canvas, Collapse, ColumnChart, DataTable, Kpi, KpiBand, LineChart, RollingNumber, SideNav, Skeleton, TreeCard, TreeChart, WaveText, type TreeItem } from '@ymasaki/ignite'
import { useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

declare global {
  interface Window {
    /** 測定の側から見本の値を進める */
    perfStep?: () => void
    /** 見本の中の部品が描かれた回数 */
    perfRenders: number
  }
}
window.perfRenders = 0

/** 測定の側から進められる回数 */
function useStep(): number {
  const [n, setN] = useState(0)
  window.perfStep = () => setN((v) => v + 1)
  return n
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** 400 個の回る数字。進めると全部の値が変わる */
function Rolling() {
  const step = useStep()
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{range(400).map((i) => <span key={i} className="num"><RollingNumber value={1000 + ((i * 37 + step * 111) % 9000)} /></span>)}</div>
}

interface Node extends TreeItem { name: string; children?: Node[] }
/** 6 列 × 5 組 × 9 件（326 節）のツリー。積んだ子はすべて開く */
const TREE: Node = { id: 'root', name: '全体', children: range(6).map((c) => ({ id: `c${c}`, name: `列 ${c + 1}`, children: range(5).map((g) => ({ id: `c${c}g${g}`, name: `組 ${g + 1}`, children: range(9).map((k) => ({ id: `c${c}g${g}k${k}`, name: `項目 ${k + 1}` })) })) })) }
const TREE_OPEN = TREE.children!.flatMap((c) => [c.id, ...c.children!.map((g) => g.id)])

function Tree() {
  const step = useStep()
  return (
    <div style={{ height: '100vh' }}>
      <Canvas label="負荷のツリー">
        <TreeChart<Node> root={TREE} defaultOpen={TREE_OPEN} selected={`c0g0k${step % 9}`} render={(n, state) => <TreeCard title={n.name} name={n.name} sub="担当なし" meta={n.children?.length} state={state} />} />
      </Canvas>
    </div>
  )
}

/** 300 個の開いた Collapse */
function Collapses() {
  return <div>{range(300).map((i) => <Collapse key={i} open><p style={{ margin: 0 }}>出し入れする中身 {i}</p></Collapse>)}</div>
}

/** 600 行・3 階層の表。階層の見出しを積む */
const DEPTHS = range(600).map((i) => (i % 60 === 0 ? 0 : i % 10 === 0 ? 1 : 2))
function Table() {
  return (
    <div style={{ height: 600 }}>
      <DataTable label="負荷の表" stickyHead depths={DEPTHS} columns={['名前', '担当', '作業', '期限']} rows={DEPTHS.map((d, i) => [{ content: `${'作業'.repeat(d + 1)} ${i}` }, { content: '佐藤 葵' }, { content: i % 13 }, { content: '11/30' }])} />
    </div>
  )
}

/** 表の中身を進めるたびに差し替える（スクロールできる枠の確かめ直しの負荷） */
function Mutating() {
  const step = useStep()
  return <DataTable label="差し替わる表" columns={['名前', '値']} rows={range(40).map((i) => [{ content: `行 ${i}` }, { content: (i * 7 + step) % 100 }])} />
}

/** 折れ線と縦棒を 30 枚ずつ */
function Charts() {
  const labels = range(12).map((i) => `${i + 1}月`)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
      {range(30).map((i) => <div key={`l${i}`}><LineChart xLabels={labels} series={[{ label: '利用者', values: labels.map((_, k) => 20 + ((k * 7 + i * 3) % 40)) }]} /></div>)}
      {range(30).map((i) => <div key={`c${i}`}><ColumnChart labels={labels} series={[{ label: '件数', values: labels.map((_, k) => 5 + ((k * 5 + i) % 30)) }]} /></div>)}
    </div>
  )
}

/** 読み込み中の形を 30 個（何もしない間の負荷） */
function Skeletons() {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>{range(30).map((i) => <Skeleton key={i} />)}</div>
}

/** 待ちの文を 10 個（何もしない間の負荷） */
function Waves() {
  return <div style={{ display: 'grid', gap: 12 }}>{range(10).map((i) => <WaveText key={i}>読み込んでいます</WaveText>)}</div>
}

function Counted({ children }: { children: ReactNode }) {
  window.perfRenders++
  return <>{children}</>
}
const NAV = range(24).map((i) => ({ key: `n${i}`, label: `画面 ${i + 1}`, icon: <span aria-hidden="true">●</span> }))
const KPIS = [{ key: 'all', items: range(6).map((i) => <Kpi key={i} icon={<span>●</span>} label={`指標 ${i + 1}`} value={1200 + i * 37} />) }]
/** アプリの枠。窓の幅を 1px ずつ変えたときに、左メニューの中身が描き直される回数を数える */
function Shell() {
  return (
    <AppShell title="負荷の枠" collapse={{ collapsed: false, onChange: () => undefined }} aux={<KpiBand groups={KPIS} />} side={(_close, state) => <Counted><SideNav items={NAV} current="n0" collapsed={state.collapsed} onSelect={() => undefined} /></Counted>}>
      <div style={{ padding: 16 }}>{range(40).map((i) => <p key={i}>内容 {i}</p>)}</div>
    </AppShell>
  )
}

const CASES: Record<string, () => ReactNode> = { rolling: Rolling, tree: Tree, collapse: Collapses, table: Table, mutating: Mutating, charts: Charts, skeleton: Skeletons, wave: Waves, shell: Shell }
const Case = CASES[new URLSearchParams(location.search).get('case') ?? '']
createRoot(document.getElementById('root')!).render(Case ? <Case /> : <p>?case= に {Object.keys(CASES).join(' / ')} を指定します</p>)
