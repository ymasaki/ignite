import { IconDownload, IconPlus, IconSearch, IconSettings, IconTrash } from '@tabler/icons-react'
import { Avatar, AvatarGroup, Badge, Board, Button, Chip, CopyText, DataTable, EmptyState, EntityRow, ExternalLink, Expandable, IconBox, IconButton, KeyValues, LinkButton, MarkPicker, MonthStepper, Notice, Popover, Prose, SearchField, Section, Segmented, Select, Skeleton, Stepper, SubHeading, Tabs, Tag, TextArea, TextField, useScrollFocus } from '@ymasaki/ignite'
import { useRef, useState, type ReactNode } from 'react'
import { MONTHS, PROJECTS } from './data'

/** 面の中をスクロールするカタログのページ */
function Page({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, label)
  return <Board><div className="cat" ref={ref}>{children}</div></Board>
}

const COLORS = ['--pri', '--pri-soft', '--pri-ink', '--solid', '--link', '--bg', '--panel', '--line', '--ink', '--ink-2', '--ink-3', '--ok-ink', '--warn', '--chart-1', '--chart-3', '--chart-5']
const SIZES = [11, 12, 13, 14, 16, 20, 24, 32]

export function FoundationsPage() {
  return (
    <Page label="基礎">
        <Section level={2} title="色">
          <div className="cat-grid">{COLORS.map((c) => <span className="cat-swatch" key={c}><i className="cat-chip" data-token={c} ref={(el) => el?.style.setProperty('background', `var(${c})`)} />{c}</span>)}</div>
        </Section>
        <Section level={2} title="文字の目盛り">
          <div className="cat-stack">{SIZES.map((s) => <span className="cat-scale" key={s} ref={(el) => el?.style.setProperty('font-size', `var(--fs-${s})`)}>{s}px 読みやすい文字</span>)}</div>
        </Section>
    </Page>
  )
}

export function ControlsPage() {
  const [seg, setSeg] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState('recent')
  const [tab, setTab] = useState('a')
  const [name, setName] = useState('')
  const [memo, setMemo] = useState('')
  const [month, setMonth] = useState(MONTHS[MONTHS.length - 1])
  const [week, setWeek] = useState('w2')
  const [mark, setMark] = useState(1)
  const [chips, setChips] = useState(['進行中', '佐藤 葵'])
  return (
    <Page label="操作の部品">
        <Section level={2} title="ボタン">
          <div className="cat-row">
            <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />}>追加する</Button>
            <Button icon={<IconDownload size={16} stroke={1.8} />}>書き出す</Button>
            <Button active>押し込み</Button>
            <Button disabled>押せない</Button>
            <IconButton label="設定を開く"><IconSettings size={16} stroke={1.8} /></IconButton>
            <IconButton label="削除する"><IconTrash size={16} stroke={1.8} /></IconButton>
            <LinkButton>文字のボタン</LinkButton>
            <ExternalLink href="https://example.com/">外部のページ</ExternalLink>
            <CopyText text="ignite" label="名前をコピーする" />
          </div>
        </Section>
        <Section level={2} title="切り替え">
          <div className="cat-stack">
            <div className="cat-row"><Segmented label="状態で絞り込む" value={seg} onChange={setSeg} options={[{ value: 'all', label: 'すべて', count: 6 }, { value: 'open', label: '進行中', count: 3 }, { value: 'done', label: '完了', count: 2 }]} /></div>
            <Tabs label="表示の切り替え" value={tab} onChange={setTab} tabs={[{ value: 'a', label: '概要' }, { value: 'b', label: '履歴', count: 12 }, { value: 'c', label: 'メンバー', count: 4 }]} />
          </div>
        </Section>
        <Section level={2} title="入力">
          <div className="cat-grid">
            <SearchField label="プロジェクトを探す" placeholder="名前・担当者" value={q} onChange={setQ} />
            <Select label="並び順" value={sel} onChange={setSel} options={[{ value: 'recent', label: '更新が新しい順' }, { value: 'name', label: '名前の順', meta: 'A→Z' }]} />
            <TextField label="名前" placeholder="名前" value={name} onChange={setName} />
            <TextArea label="メモ" placeholder="メモ" value={memo} onChange={setMemo} rows={2} />
          </div>
        </Section>
        <Section level={2} title="送り">
          <div className="cat-row">
            <MonthStepper value={month} months={MONTHS} onChange={setMonth} />
            <Stepper label="対象の週" prevLabel="前の週" nextLabel="次の週" value={week} onChange={setWeek} options={[{ value: 'w2', label: '第 2 週' }, { value: 'w1', label: '第 1 週' }]} />
            <MarkPicker label="印の色" value={mark} onChange={setMark} />
          </div>
        </Section>
        <Section level={2} title="タグ">
          <div className="cat-row">
            <Tag>標準</Tag>
            <Tag variant="accent">強調</Tag>
            <Tag variant="dashed">点線</Tag>
            {chips.map((c) => <Chip key={c} removeLabel={`${c} を外す`} removeTip="絞り込みから外す" onRemove={() => setChips(chips.filter((x) => x !== c))}>{c}</Chip>)}
            <Button>未読<Badge count={3} /></Button>
          </div>
        </Section>
        <Section level={2} title="重ねて出す">
          <div className="cat-row">
            <Popover trigger={(open, toggle) => <Button active={open} aria-expanded={open} onClick={toggle} icon={<IconSearch size={16} stroke={1.8} />}>小さなパネル</Button>}>
              <div className="cat-detail"><KeyValues rows={[['担当', '佐藤 葵'], ['期限', '2026年11月']]} /></div>
            </Popover>
          </div>
        </Section>
    </Page>
  )
}

export function DisplayPage() {
  return (
    <Page label="表示の部品">
        <Section level={2} title="顔アイコン">
          <div className="cat-row">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => <Avatar key={size} initial="佐" tone="c1" size={size} />)}
            <IconBox><IconSettings size={16} stroke={1.8} /></IconBox>
            <AvatarGroup label="メンバー" items={PROJECTS.map((p) => ({ key: p.id, initial: p.initial, tone: p.tone, tip: p.owner }))} max={4} />
          </div>
        </Section>
        <Section level={2} title="一覧の行" count={3}>
          <div className="cat-stack">
            {PROJECTS.slice(0, 3).map((p) => <EntityRow key={p.id} lead={<Avatar initial={p.initial} tone={p.tone} />} title={p.name} sub={p.owner} trailing={<Tag>{p.status}</Tag>} />)}
          </div>
        </Section>
        <Section level={2} title="表">
          <DataTable label="プロジェクトの進み具合" columns={['名前', 'タスク', '完了の割合']} rows={PROJECTS.slice(0, 4).map((p, i) => [{ content: p.name }, { content: p.tasks }, { content: `${20 + i * 25}%`, ratio: 0.2 + i * 0.25 }])} />
        </Section>
        <Section level={2} title="項目">
          <KeyValues rows={[['担当', '佐藤 葵'], ['状態', '進行中'], ['タスク', '42 件', { num: true }]]} />
          <SubHeading count={2}>小見出し</SubHeading>
          <Prose>人が書いた本文はここに置く。</Prose>
          <Expandable lines={2}>開閉する本文の例。長い本文は最初の数行だけを見せて、残りは押すと開く。{'\n'}二行目。{'\n'}三行目。{'\n'}四行目。</Expandable>
        </Section>
        <Section level={2} title="状態">
          <div className="cat-stack">
            <Notice>同期が止まっています</Notice>
            <EmptyState title="該当するものがありません">絞り込みを変えてください</EmptyState>
            <Skeleton lines={2} />
          </div>
        </Section>
    </Page>
  )
}
