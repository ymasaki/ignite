import { IconChecks, IconClock } from '@tabler/icons-react'
import { BarList, BoxPlot, ColumnChart, Button, Dialog, Notice, Delta, Funnel, Gauge, HeatMap, Kpi, LineChart, PieChart, RadarChart, ScatterChart, Sparkline, StackColumns, Stat, TileMap, Waterfall, boxStats } from '@ymasaki/ignite'
import { useState } from 'react'
import { MONTHS, PROJECTS } from './data'
import { Case, Cases, Page, Spec } from './kit'

export const VALUES = [32, 38, 41, 37, 45, 52]
const AXIS = MONTHS.map((m) => m.slice(5))
const DAYS = ['月', '火', '水', '木', '金', '土', '日']
const HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18']
// 曜日×時間帯の件数（昼と週末に少ない形）
const BUSY = DAYS.map((_, d) => HOURS.map((_, h) => (d >= 5 ? (h % 3 ? 1 : 0) : Math.round((h === 3 ? 4 : 12) + 6 * Math.sin((h + d) / 2)))))
// 週×曜日の活動（カレンダーの形。値のない日は null）
const WEEKS = Array.from({ length: 16 }, (_, w) => `${w + 1}`)
const ACTIVITY = DAYS.map((_, d) => WEEKS.map((_, w) => (w === 15 && d > 2 ? null : (w * 7 + d * 3) % 9)))
// 処理時間の分布（秒）
const DURATIONS = [1.2, 1.4, 1.9, 2.1, 2.2, 2.4, 2.5, 2.8, 3.0, 3.1, 3.3, 3.6, 4.0, 4.2, 4.8, 5.5, 9.4]
const BINS = ['0–1', '1–2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8', '8–9', '9–10']

export function ChartsPage({ target }: { target?: string | null }) {
  const p = 'charts'
  const [dialog, setDialog] = useState(false)
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
      <Spec page={p} id="barlist"><BarList items={PROJECTS.map((x) => ({ label: <span>{x.owner}</span>, value: x.tasks }))} /></Spec>
      <Spec page={p} id="stack"><StackColumns labels={AXIS} stacks={[{ label: '完了', values: VALUES }, { label: '進行中', values: VALUES.map((v) => v / 2 | 0) }]} current={5} /></Spec>
      <Spec page={p} id="funnel"><Funnel unit="件" ofPrev="前の段から" ofFirst="最初から" steps={[{ label: '受付', value: 120 }, { label: '着手', value: 84 }, { label: '完了', value: 52 }]} /></Spec>
      <Spec page={p} id="tile"><TileMap label="プロジェクトの規模と進み具合" height={220} selected={tile} onSelect={setTile} scale={['低い', '高い']} items={PROJECTS.map((x, i) => ({ key: x.id, label: x.name, size: x.tasks, ratio: 0.15 * i + 0.1, value: `${x.tasks}件` }))} /></Spec>
      <Spec page={p} id="column">
        <>
          <Case label="1 系列" fill><ColumnChart unit="件" labels={AXIS} series={[{ label: '完了', values: VALUES }]} current={5} /></Case>
          <Case label="系列を並べる" fill><ColumnChart unit="件" labels={AXIS} series={[{ label: '今年', values: VALUES }, { label: '前の年', values: VALUES.map((v) => v - 8) }]} /></Case>
          <Case label="負の数" fill><ColumnChart unit="件" labels={AXIS} series={[{ label: '前月との差', values: [6, 3, -4, 8, 7, -2] }]} /></Case>
        </>
      </Spec>
      <Spec page={p} id="combo"><ColumnChart unit="件" lineUnit="%" labels={AXIS} series={[{ label: '受付', values: [120, 132, 101, 140, 152, 160] }]} line={{ label: '期限内の割合', values: [82, 85, 79, 88, 91, 90] }} /></Spec>
      <Spec page={p} id="histogram"><ColumnChart histogram unit="件" labels={BINS} series={[{ label: '処理時間', values: [0, 3, 5, 4, 2, 1, 0, 0, 0, 1] }]} /></Spec>
      <Spec page={p} id="pie">
        <>
          <Case label="円" fill><PieChart unit="件" items={[{ label: '問い合わせ', value: 48 }, { label: '不具合', value: 26 }, { label: '要望', value: 14 }, { label: '請求', value: 8 }, { label: '退会', value: 3 }, { label: '分類なし', value: 5, muted: true }]} /></Case>
          <Case label="ドーナツ" fill><PieChart donut unit="件" items={[{ label: '完了', value: 52 }, { label: '進行中', value: 21 }, { label: '未着手', value: 9 }]} /></Case>
        </>
      </Spec>
      <Spec page={p} id="gauge">
        <Notice tone="info">ホバー・Tab で値を確認、Esc で閉じる</Notice>
        <Button onClick={() => setDialog(true)}>窓の中でグラフを確認</Button>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="グラフの値の確認">
          <Gauge label="今月の達成率" value={72} unit="%" target={80} />
          <HeatMap unit="件" rows={DAYS} cols={WEEKS} values={ACTIVITY} square />
          <PieChart unit="件" items={[{ label: '完了', value: 52 }, { label: '進行中', value: 21 }]} />
        </Dialog>
        <Cases cols={3}>
          <Case label="目標あり"><Gauge label="今月の達成率" value={72} unit="%" target={80} /></Case>
          <Case label="範囲"><Gauge label="容量" value={38.4} min={0} max={50} unit="GB" decimals={1} size={160} /></Case>
          <Case label="値なし"><Gauge label="満足度" value={null} size={160} /></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="waterfall"><Waterfall unit="件" start={{ label: '月初', value: 120 }} steps={[{ label: '新規', value: 46 }, { label: '再開', value: 12 }, { label: '完了', value: -58 }, { label: '取消', value: -9 }]} total="月末" /></Spec>
      <Spec page={p} id="scatter">
        <>
          <Case label="散布図" fill><ScatterChart xLabel="件数" yLabel="平均日数" yUnit="日" points={PROJECTS.flatMap((x, i) => [0, 1, 2].map((k) => ({ label: `${x.name} ${k + 1}`, x: x.tasks + k * 3, y: 2 + ((i * 3 + k * 5) % 7), muted: k === 2 })))} /></Case>
          <Case label="バブル" fill><ScatterChart xLabel="件数" yLabel="平均日数" yUnit="日" sizeLabel="人数" sizeUnit="名" points={PROJECTS.map((x, i) => ({ label: x.name, x: x.tasks, y: 2 + ((i * 3) % 7), size: 3 + i * 4 }))} /></Case>
        </>
      </Spec>
      <Spec page={p} id="radar"><RadarChart max={5} axes={['速さ', '正確さ', '説明', '連携', '提案', '継続']} series={[{ label: '今期', values: [4, 3.5, 4.5, 3, 2.5, 4] }, { label: '前期', values: [3, 3, 4, 3.5, 2, 3], soft: true }]} /></Spec>
      <Spec page={p} id="heatmap">
        <>
          <Case label="曜日×時間帯" fill><HeatMap unit="件" rows={DAYS} cols={HOURS} values={BUSY} showValues scale={['少ない', '多い']} /></Case>
          <Case label="カレンダーの形" fill><HeatMap square unit="件" rows={DAYS} cols={WEEKS} colEvery={4} values={ACTIVITY} /></Case>
        </>
      </Spec>
      <Spec page={p} id="box"><BoxPlot unit="秒" items={[{ label: '受付', ...boxStats(DURATIONS)! }, { label: '確認', ...boxStats(DURATIONS.map((v) => v * 0.7 + 0.5))! }, { label: '返信', ...boxStats(DURATIONS.map((v) => v * 1.3))! }]} /></Spec>
    </Page>
  )
}
