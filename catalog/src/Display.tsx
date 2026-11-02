import { IconBuilding, IconFolder, IconSearch } from '@tabler/icons-react'
import { Avatar, AvatarGroup, Badge, Button, Chip, DataTable, EntityRow, Highlight, IconBox, KeyValues, MarkPicker, Prose, ScreenBar, Section, Segmented, SubHeading, Tag, type TableSort } from '@ymasaki/ignite'
import { useState } from 'react'
import { PROJECTS } from './data'
import { Case, Cases, Page, Spec } from './kit'

export function MarksPage({ target }: { target?: string | null }) {
  const p = 'marks'
  const [mark, setMark] = useState(1)
  const [chips, setChips] = useState(['進行中', '佐藤 葵'])
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="avatar" wide>
        <Cases>{(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => <Case key={size} label={size}><Avatar initial="佐" tone="c1" size={size} /></Case>)}</Cases>
      </Spec>
      <Spec page={p} id="avatars">
        <Cases>
          <Case label="メンバー"><AvatarGroup label="メンバー" items={PROJECTS.map((x) => ({ key: x.id, initial: x.initial, tone: x.tone, tip: x.owner }))} max={4} /></Case>
          <Case label="人以外"><div className="cat-row"><IconBox><IconFolder size={16} stroke={1.8} /></IconBox><IconBox size="lg"><IconBuilding size={18} stroke={1.8} /></IconBox></div></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="tag">
        <Cases>
          <Case label="標準"><Tag>保留</Tag></Case>
          <Case label="強調"><Tag variant="accent">新着</Tag></Case>
          <Case label="未確定"><Tag variant="dashed">下書き</Tag></Case>
          <Case label="良い"><Tag variant="ok">完了</Tag></Case>
          <Case label="注意"><Tag variant="warn">要確認</Tag></Case>
          <Case label="悪い"><Tag variant="danger">失敗</Tag></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="chip">
        <Cases>
          <Case label="絞り込みの差分"><div className="cat-row">{chips.map((c) => <Chip key={c} removeLabel={`${c} を外す`} removeTip="絞り込みから外す" onRemove={() => setChips(chips.filter((x) => x !== c))}>{c}</Chip>)}{!chips.length && <Button onClick={() => setChips(['進行中', '佐藤 葵'])}>元に戻す</Button>}</div></Case>
          <Case label="未処理の数"><Button>未読<Badge count={3} /></Button></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="markpicker" center><div className="cat-row"><MarkPicker label="印の色" value={mark} onChange={setMark} /></div></Spec>
    </Page>
  )
}

export function DataPage({ target }: { target?: string | null }) {
  const p = 'data'
  const [sort, setSort] = useState<TableSort>({ column: 1, dir: 'desc' })
  const [picked, setPicked] = useState<string[]>([PROJECTS[0].id])
  const [scope, setScope] = useState('all')
  const key = sort.column === 0 ? 'name' : 'tasks'
  const sorted = [...PROJECTS].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1))
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="rows" wide>
        <div className="cat-sheet">
          <div className="cat-tight">
            {PROJECTS.slice(0, 3).map((x) => <EntityRow key={x.id} lead={<Avatar initial={x.initial} tone={x.tone} />} title={x.name} sub={x.owner} trailing={<Tag>{x.status}</Tag>} />)}
            <EntityRow lead={<IconBox><IconSearch size={16} stroke={1.8} /></IconBox>} title={<Highlight text="検索語を強調する行" q="検索語" />} />
          </div>
        </div>
      </Spec>
      <Spec page={p} id="table" wide plain>
        <DataTable label="プロジェクトの進み具合" columns={['名前', 'タスク', '完了の割合']} rows={PROJECTS.slice(0, 4).map((x, i) => [{ content: x.name }, { content: x.tasks }, { content: `${20 + i * 25}%`, ratio: 0.2 + i * 0.25 }])} />
        <DataTable label="並べ替えと選択" sort={sort} onSort={(c) => setSort({ column: c, dir: sort.column === c && sort.dir === 'asc' ? 'desc' : 'asc' })} rowKeys={sorted.map((x) => x.id)} selected={picked} onSelect={setPicked} columns={[{ label: '名前', sortable: true }, { label: 'タスク', sortable: true }]} rows={sorted.map((x) => [{ content: x.name }, { content: x.tasks }])} />
      </Spec>
      <Spec page={p} id="tablestate" wide plain>
        <Cases cols={2}>
          <Case label="読み込み中" fill><DataTable label="読み込み中の表" columns={['名前', 'タスク']} rows={[]} loading /></Case>
          <Case label="空" fill><DataTable label="空の表" columns={['名前', 'タスク']} rows={[]} empty="該当するものがありません" /></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="kv" wide>
        <div className="cat-sheet">
          <Section title="概要"><KeyValues rows={[['担当', '佐藤 葵'], ['状態', '進行中'], ['タスク', '42 件', { num: true }]]} /></Section>
          <SubHeading count={2}>メモ</SubHeading>
          <Prose>デザインを更新し、表示速度を改善する</Prose>
        </div>
      </Spec>
      <Spec page={p} id="bar" wide plain>
        <ScreenBar count="6件"><Segmented label="対象で絞り込む" value={scope} onChange={setScope} options={[{ value: 'all', label: 'すべて' }, { value: 'mine', label: '自分の担当' }]} /></ScreenBar>
      </Spec>
    </Page>
  )
}
