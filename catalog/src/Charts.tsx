import { IconChecks, IconClock } from '@tabler/icons-react'
import { BarList, Delta, Funnel, Kpi, LineChart, Sparkline, StackColumns, Stat, TileMap } from '@ymasaki/ignite'
import { useState } from 'react'
import { MONTHS, PROJECTS } from './data'
import { Case, Cases, Page, Spec } from './kit'

export const VALUES = [32, 38, 41, 37, 45, 52]
const AXIS = MONTHS.map((m) => m.slice(5))

export function ChartsPage({ target }: { target?: string | null }) {
  const p = 'charts'
  const [tile, setTile] = useState<string | undefined>()
  const [kpi, setKpi] = useState(false)
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="kpi">
        <div className="kpis">
          <Kpi icon={<IconClock size={18} stroke={1.8} />} label="進行中" value={3} unit="件" sub={<Delta value={1} unit="件" />} />
          <Kpi icon={<IconChecks size={18} stroke={1.8} />} label="押せる" value={52} unit="件" onClick={() => setKpi(!kpi)} active={kpi} sub={<Delta value={7} unit="件" />} />
          <Kpi icon={<IconClock size={18} stroke={1.8} />} label="値なし" value={null} unit="件" />
        </div>
      </Spec>
      <Spec page={p} id="stat">
        <Cases>
          <Case label="主役"><Stat value={52} unit="件" size="lg" after={<Sparkline label="完了の推移" unit="件" values={VALUES} />} /></Case>
          <Case label="値なし"><Stat value={null} unit="件" /></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="line"><LineChart unit="件" xLabels={AXIS} series={[{ label: '完了', values: VALUES }, { label: '前の年', values: VALUES.map((v) => v - 8), soft: true }]} /></Spec>
      <Spec page={p} id="barlist"><BarList items={PROJECTS.map((x) => ({ label: x.owner, value: x.tasks }))} /></Spec>
      <Spec page={p} id="stack"><StackColumns labels={AXIS} stacks={[{ label: '完了', values: VALUES }, { label: '進行中', values: VALUES.map((v) => v / 2 | 0) }]} current={5} /></Spec>
      <Spec page={p} id="funnel"><Funnel unit="件" ofPrev="前の段から" ofFirst="最初から" steps={[{ label: '受付', value: 120 }, { label: '着手', value: 84 }, { label: '完了', value: 52 }]} /></Spec>
      <Spec page={p} id="tile"><TileMap label="プロジェクトの規模と進み具合" height={220} selected={tile} onSelect={setTile} scale={['低い', '高い']} items={PROJECTS.map((x, i) => ({ key: x.id, label: x.name, size: x.tasks, ratio: 0.15 * i + 0.1, value: `${x.tasks}件` }))} /></Spec>
    </Page>
  )
}
