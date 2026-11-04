import { IconChartLine, IconChecks, IconClock, IconListCheck, IconPencil, IconShare } from '@tabler/icons-react'
import { AssistSettings, AuthScreen, Avatar, BarList, Board, Button, ChartCard, ChartGrid, Chip, DashboardScreen, Delta, EmptyState, EntityRow, Funnel, IconBox, IconButton, KeyValues, Kpi, KpiBand, LineChart, LinkButton, ListScreen, LoginForm, PanelBody, PanelFrame, PanelHeader, ProviderLogo, SearchField, Section, Segmented, SettingBody, SettingGroup, SettingKey, SettingRow, SettingsScreen, Sparkline, StackColumns, Stat, tabPanelProps, Tabs, Tag, ThemeSettings, TileMap, toast } from '@ymasaki/ignite'
import { useRef, useState, type ReactNode } from 'react'
import { VALUES } from './Charts'
import { MONTHS, PROJECTS, UPDATES } from './data'

export function ListPage({ selected, onOpen }: { selected: string | null; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const rows = PROJECTS.filter((p) => (status === 'all' || p.status === status) && (p.name.includes(q) || p.owner.includes(q)))
  return (
    <Board>
      <ListScreen
        layout="tiles"
        count={`${rows.length}件`}
        tools={<>
          <SearchField label="プロジェクトを探す" placeholder="名前・担当者" value={q} onChange={setQ} shortcut />
          <Segmented label="状態で絞り込む" value={status} onChange={setStatus} options={[{ value: 'all', label: 'すべて' }, { value: '進行中', label: '進行中' }, { value: '完了', label: '完了' }]} />
        </>}
        empty={rows.length ? undefined : <EmptyState title="該当するものがありません">絞り込みを変えてください</EmptyState>}
      >
        {rows.map((p) => <EntityRow key={p.id} size="lg" active={p.id === selected} onClick={() => onOpen(p.id)} lead={<Avatar initial={p.initial} tone={p.tone} />} title={p.name} sub={p.owner} trailing={<Tag>{p.status}</Tag>} />)}
      </ListScreen>
    </Board>
  )
}

export function DetailPanel({ id, onClose, onShowDashboard }: { id: string; onClose: () => void; onShowDashboard: () => void }) {
  const p = PROJECTS.find((x) => x.id === id) ?? PROJECTS[0]
  const [tab, setTab] = useState('about')
  const rest = PROJECTS.filter((x) => x.id !== p.id).slice(0, 3)
  return (
    <PanelFrame>
      <PanelHeader
        visual={<Avatar initial={p.initial} tone={p.tone} size="xl" />}
        smallVisual={<Avatar initial={p.initial} tone={p.tone} size="sm" />}
        kicker={p.status}
        title={p.name}
        stickySub={p.owner}
        actions={<>
          <Button icon={<IconPencil size={16} stroke={1.8} aria-hidden="true" />} onClick={() => toast('編集を開きました')}>編集する</Button>
          <IconButton label="共有する" onClick={() => toast('共有の窓を開きました')}><IconShare size={16} stroke={1.8} /></IconButton>
        </>}
        onClose={onClose}
      />
      <Tabs id="detail" label="詳細の表示" fit value={tab} onChange={setTab} tabs={[{ value: 'about', label: '概要' }, { value: 'team', label: '関連', count: rest.length }]} />
      <PanelBody>
        <div {...tabPanelProps('detail', tab)}>
          {tab === 'about' && <>
            <Section title="基本情報"><KeyValues rows={[['担当', p.owner], ['タスク', `${p.tasks}件`, { num: true }], ['メモ', p.note, { block: true }]]} /></Section>
            <Section title="更新の記録" count={`${UPDATES.length}件`}>{UPDATES.map(([date, text]) => <EntityRow key={date} lead={<IconBox><IconClock size={16} stroke={1.8} /></IconBox>} title={text} sub={date} />)}</Section>
          </>}
          {tab === 'team' && <Section title="関連する案件">{rest.map((x) => <EntityRow key={x.id} lead={<IconBox><IconListCheck size={16} stroke={1.8} /></IconBox>} title={x.name} sub={x.owner} trailing={<Tag variant={x.status === '完了' ? 'ok' : undefined}>{x.status}</Tag>} />)}</Section>}
        </div>
        <div className="cat-row"><LinkButton onClick={onShowDashboard}>ダッシュボードで見る</LinkButton></div>
      </PanelBody>
    </PanelFrame>
  )
}

function Band() {
  const [active, setActive] = useState<string | null>(null)
  const kpi = (key: string, label: string, value: number, icon: React.ReactNode, unit?: string) => <Kpi key={key} icon={icon} label={label} value={value} unit={unit} active={active === key} onClick={() => setActive(active === key ? null : key)} sub={<Delta value={value % 7} unit={unit} />} />
  const LABELS: Record<string, string> = { open: '進行中', done: '完了', tasks: 'タスク', rate: '完了の割合' }
  return <><KpiBand resetKey="dashboard" groups={[
    { key: 'main', items: [kpi('open', '進行中', 3, <IconClock size={18} stroke={1.8} />, '件'), kpi('done', '完了', 2, <IconChecks size={18} stroke={1.8} />, '件')] },
    { key: 'tasks', summary: <Kpi key="summary" icon={<IconListCheck size={18} stroke={1.8} />} label="タスク" value={127} unit="件" />, items: [kpi('tasks', 'タスク', 127, <IconListCheck size={18} stroke={1.8} />, '件'), kpi('rate', '完了の割合', 64, <IconChartLine size={18} stroke={1.8} />, '%')] },
  ]} />{active && <div className="cat-filter">絞り込み<Chip removeLabel="絞り込みを外す" removeTip="絞り込みから外す" onRemove={() => setActive(null)}>{LABELS[active]} のみ</Chip></div>}</>
}

export function DashboardPage() {
  const [tile, setTile] = useState<string | undefined>()
  return (
    <DashboardScreen>
      <ChartGrid tiles>
        <ChartCard title="今月の完了"><Stat value={52} unit="件" size="lg" after={<Sparkline label="完了の推移" unit="件" values={VALUES} />} /></ChartCard>
        <ChartCard title="完了したタスクの推移" meta="月ごと" span={2}><LineChart unit="件" xLabels={MONTHS.map((m) => m.slice(5))} series={[{ label: '完了', values: VALUES }, { label: '前の年', values: VALUES.map((v) => v - 8), soft: true }]} /></ChartCard>
        <ChartCard title="担当者ごとのタスク"><BarList items={PROJECTS.map((p) => ({ label: p.owner, value: p.tasks }))} /></ChartCard>
        <ChartCard title="状態の内訳" span={2}><StackColumns labels={MONTHS.map((m) => m.slice(5))} stacks={[{ label: '完了', values: VALUES }, { label: '進行中', values: VALUES.map((v) => v / 2 | 0) }]} current={5} /></ChartCard>
        <ChartCard title="進み方" span={2}><Funnel unit="件" ofPrev="前の段から" ofFirst="最初から" steps={[{ label: '受付', value: 120 }, { label: '着手', value: 84 }, { label: '完了', value: 52 }]} /></ChartCard>
        <ChartCard title="規模と進み具合" wide><TileMap label="プロジェクトの規模と進み具合" height={240} selected={tile} onSelect={setTile} scale={['低い', '高い']} items={PROJECTS.map((p, i) => ({ key: p.id, label: p.name, size: p.tasks, ratio: 0.15 * i + 0.1, value: `${p.tasks}件` }))} /></ChartCard>
      </ChartGrid>
    </DashboardScreen>
  )
}
DashboardPage.Band = Band

/** ログインの型。見本なので、送ると少し待って必ず失敗する */
export function LoginPage({ mark, onBack }: { mark: ReactNode; onBack: () => void }) {
  const [kind, setKind] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const timer = useRef(0)
  const submit = () => {
    setError(undefined)
    setLoading(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setLoading(false)
      setError('メールアドレスかパスワードが違います')
    }, 800)
  }
  return (
    <AuthScreen
      mark={mark}
      name="Ignite"
      title="ログイン"
      footer={
        <>
          <Segmented label="見本の形" value={kind} onChange={setKind} options={[{ value: 'basic', label: '基本' }, { value: 'alt', label: '外部認証あり' }]} />
          <LinkButton onClick={onBack}>カタログへ戻る</LinkButton>
        </>
      }
    >
      <LoginForm
        onSubmit={submit}
        loading={loading}
        error={error}
        remember
        onForgot={() => undefined}
        alternatives={kind === 'alt' ? (
          <>
            <Button icon={<ProviderLogo provider="google" />}>Google でログインする</Button>
            <Button icon={<ProviderLogo provider="apple" />}>Apple でログインする</Button>
            <Button icon={<ProviderLogo provider="okta" />}>Okta でログインする</Button>
          </>
        ) : undefined}
      />
    </AuthScreen>
  )
}

export function SettingsPage() {
  return (
    <SettingsScreen>
      <ThemeSettings />
      <AssistSettings />
      <SettingGroup title="このアプリについて">
        <SettingRow label="バージョン"><IconBox><IconChartLine size={16} stroke={1.8} /></IconBox></SettingRow>
        <SettingRow label="検索へ移る"><SettingKey>F</SettingKey></SettingRow>
        <SettingBody note="名前つきで届きます"><Tag>自由な中身</Tag></SettingBody>
      </SettingGroup>
    </SettingsScreen>
  )
}
