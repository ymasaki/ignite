import { IconCopy, IconDownload, IconPencil, IconPlus, IconSearch, IconSettings, IconTrash } from '@tabler/icons-react'
import { Accordion, AnimatedList, Appear, Avatar, AvatarGroup, Badge, Board, Button, Checkbox, Chip, Collapse, Combobox, ConfirmDialog, CopyText, Crumbs, DataTable, DatePicker, Dialog, EmptyState, EntityRow, ExternalLink, Expandable, focusFirstInvalid, FormField, Highlight, IconBox, IconButton, KeyValues, LinkButton, MarkPicker, Menu, MonthStepper, Notice, NumberField, Pagination, Popover, ProgressBar, Prose, RadioGroup, RollingNumber, ScreenBar, SearchField, Section, Segmented, Select, Skeleton, Spinner, Stepper, Steps, SubHeading, Switch, Tabs, Tag, TextArea, TextField, toast, useScrollFocus, type TableSort } from '@ymasaki/ignite'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [page, setPage] = useState(4)
  // データの更新で親が描き直されても、開いたメニューの今の項目が動かないことを確かめる
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <Page label="操作の部品">
        <Section level={2} title="ボタン">
          <div className="cat-row">
            <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />}>追加する</Button>
            <Button icon={<IconDownload size={16} stroke={1.8} />}>書き出す</Button>
            <Button active>押し込み</Button>
            <Button disabled>押せない</Button>
            <Button variant="danger" icon={<IconTrash size={16} stroke={1.8} />}>削除する</Button>
            <Button loading>送信中</Button>
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
            <Tag variant="ok">完了</Tag>
            <Tag variant="warn">要確認</Tag>
            <Tag variant="danger">失敗</Tag>
            {chips.map((c) => <Chip key={c} removeLabel={`${c} を外す`} removeTip="絞り込みから外す" onRemove={() => setChips(chips.filter((x) => x !== c))}>{c}</Chip>)}
            <Button>未読<Badge count={3} /></Button>
          </div>
        </Section>
        <Section level={2} title="移動">
          <div className="cat-stack">
            <Crumbs items={['プロジェクト', '進行中']} label={(x) => x} onPick={() => undefined} current="詳細" />
            <Pagination page={page} count={20} onChange={setPage} />
            <Steps label="登録の手順" steps={['入力', '確認', '完了']} current={1} />
          </div>
        </Section>
        <Section level={2} title="重ねて出す">
          <div className="cat-row">
            <Menu label="操作" items={[{ key: 'edit', label: '編集する', icon: <IconPencil size={16} stroke={1.8} />, onSelect: () => toast('編集を開きました') }, { key: 'copy', label: '複製する', icon: <IconCopy size={16} stroke={1.8} />, onSelect: () => toast('複製しました', { tone: 'ok' }) }, { key: 'off', label: '書き出す', disabled: true, onSelect: () => undefined }, { key: 'del', label: '削除する', icon: <IconTrash size={16} stroke={1.8} />, danger: true, separator: true, onSelect: () => toast('削除できませんでした', { tone: 'danger' }) }]} />
            <Menu label="その他の操作" iconOnly items={[{ key: 'a', label: '編集する', onSelect: () => undefined }]} />
            <Popover trigger={(open, toggle) => <Button active={open} aria-expanded={open} onClick={toggle} icon={<IconSearch size={16} stroke={1.8} />}>小さなパネル</Button>}>
              <div className="cat-detail"><KeyValues rows={[['担当', '佐藤 葵'], ['期限', '2026年11月']]} /></div>
            </Popover>
          </div>
        </Section>
    </Page>
  )
}

export function DisplayPage() {
  const [sort, setSort] = useState<TableSort>({ column: 1, dir: 'desc' })
  const [picked, setPicked] = useState<string[]>([PROJECTS[0].id])
  const [more, setMore] = useState(true)
  const key = sort.column === 0 ? 'name' : 'tasks'
  const sorted = [...PROJECTS].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1))
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
          <div className="cat-stack">
            <DataTable label="プロジェクトの進み具合" columns={['名前', 'タスク', '完了の割合']} rows={PROJECTS.slice(0, 4).map((p, i) => [{ content: p.name }, { content: p.tasks }, { content: `${20 + i * 25}%`, ratio: 0.2 + i * 0.25 }])} />
            <DataTable label="並べ替えと選択" sort={sort} onSort={(c) => setSort({ column: c, dir: sort.column === c && sort.dir === 'asc' ? 'desc' : 'asc' })} rowKeys={sorted.map((p) => p.id)} selected={picked} onSelect={setPicked} columns={[{ label: '名前', sortable: true }, { label: 'タスク', sortable: true }]} rows={sorted.map((p) => [{ content: p.name }, { content: p.tasks }])} />
            <DataTable label="読み込み中の表" columns={['名前', 'タスク']} rows={[]} loading />
            <DataTable label="空の表" columns={['名前', 'タスク']} rows={[]} empty="該当するものがありません" />
          </div>
        </Section>
        <Section level={2} title="項目">
          <KeyValues rows={[['担当', '佐藤 葵'], ['状態', '進行中'], ['タスク', '42 件', { num: true }]]} />
          <SubHeading count={2}>小見出し</SubHeading>
          <EntityRow lead={<IconBox><IconSearch size={16} stroke={1.8} /></IconBox>} title={<Highlight text="検索語を強調する行" q="検索語" />} />
          <ScreenBar><Tag>内容の枠の上の帯</Tag></ScreenBar>
          <Prose>人が書いた本文はここに置く。</Prose>
          <Expandable lines={2}>開閉する本文の例。長い本文は最初の数行だけを見せて、残りは押すと開く。{'\n'}二行目。{'\n'}三行目。{'\n'}四行目。</Expandable>
        </Section>
        <Section level={2} title="状態">
          <div className="cat-stack">
            <Notice>同期が止まっています</Notice>
            <EmptyState title="該当するものがありません">絞り込みを変えてください</EmptyState>
            <Skeleton lines={2} />
            <Appear><Notice tone="info">新しい版があります</Notice></Appear>
          </div>
        </Section>
        <Section level={2} title="開閉">
          <Accordion defaultOpen={['a']} items={[{ key: 'a', title: '概要', meta: '3件', children: '開閉するまとまりの中身。' }, { key: 'b', title: '履歴', children: '二つ目の中身。' }]} />
          <div className="cat-row"><Switch label="補足を見せる" checked={more} onChange={setMore} /><RollingNumber value={more ? 12 : 3} /></div>
          <Collapse open={more}><Prose>押し下げて出る本文。</Prose></Collapse>
          <AnimatedList items={PROJECTS.slice(0, more ? 2 : 1)} keyOf={(p) => p.id}>{(p) => <EntityRow lead={<Avatar initial={p.initial} tone={p.tone} size="sm" />} title={p.name} sub={p.owner} />}</AnimatedList>
        </Section>
    </Page>
  )
}

const CITIES = ['札幌', '仙台', '東京', '横浜', '名古屋', '京都', '大阪', '神戸', '広島', '福岡', '那覇'].map((c) => ({ value: c, label: c }))

/** 枠の中の最初のエラーへ移す例 */
function ErrorCase({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return <div className="cat-stack" ref={ref}>{children}<div className="cat-row"><LinkButton onClick={() => ref.current && focusFirstInvalid(ref.current)}>{label}のエラーへ移る</LinkButton></div></div>
}

export function FormsPage() {
  const [name, setName] = useState('')
  const [city, setCity] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(3)
  const [rate, setRate] = useState<number | null>(0.5)
  const [date, setDate] = useState<string | null>('2026-10-15')
  const [plan, setPlan] = useState<string | null>('a')
  const [mail, setMail] = useState(true)
  const [news, setNews] = useState(false)
  const [live, setLive] = useState(true)
  const [role, setRole] = useState('edit')
  const [sent, setSent] = useState(false)
  const [channel, setChannel] = useState<string | null>(null)
  return (
    <Page label="フォームの部品">
        <Section level={2} title="入力欄の枠">
          <div className="cat-form">
            <FormField label="名前" required hint="画面に出る名前" error={sent && !name ? '名前を入れてください' : undefined}><TextField value={name} onChange={setName} placeholder="佐藤 葵" /></FormField>
            <FormField label="権限"><Select value={role} onChange={setRole} options={[{ value: 'edit', label: '編集できる' }, { value: 'view', label: '見るだけ' }]} /></FormField>
            <FormField label="通知先" group required error={sent && !channel ? '通知先を選んでください' : undefined}><RadioGroup value={channel} onChange={setChannel} inline options={[{ value: 'mail', label: 'メール' }, { value: 'chat', label: 'チャット' }]} /></FormField>
            <FormField label="メモ" hint="200 字まで"><TextArea value="" onChange={() => undefined} maxLength={200} rows={2} /></FormField>
            <div className="cat-row"><Button variant="primary" onClick={() => { setSent(true); if (name && channel) toast('保存しました', { tone: 'ok' }); else requestAnimationFrame(() => focusFirstInvalid()) }}>保存する</Button></div>
          </div>
        </Section>
        <Section level={2} title="選ぶ">
          <div className="cat-form">
            <FormField label="拠点" hint="打って絞り込む"><Combobox value={city} onChange={setCity} options={CITIES} placeholder="拠点の名前" /></FormField>
            <FormField label="期限"><DatePicker value={date} onChange={setDate} clearable min="2026-01-01" max="2027-12-31" today="2026-10-30" /></FormField>
            <FormField label="プラン" group><RadioGroup value={plan} onChange={setPlan} options={[{ value: 'a', label: '標準', hint: '月 100 件まで' }, { value: 'b', label: '大容量', hint: '月 1,000 件まで' }, { value: 'c', label: '無制限', disabled: true }]} /></FormField>
            <RadioGroup label="表示" inline value="list" onChange={() => undefined} options={[{ value: 'list', label: '一覧' }, { value: 'grid', label: '格子' }]} />
            <div className="cat-stack">
              <Checkbox label="メールで受け取る" checked={mail} onChange={setMail} />
              <Checkbox label="お知らせを受け取る" hint="月に 1 回" checked={news} onChange={setNews} />
              <Checkbox label="一部を選んだ状態" checked={false} indeterminate onChange={() => undefined} />
              <Checkbox label="選べない項目" checked disabled onChange={() => undefined} />
            </div>
            <div className="cat-stack">
              <Switch label="すぐに通知する" checked={live} onChange={setLive} />
              <Switch label="切の状態" checked={false} onChange={() => undefined} />
              <Switch label="切り替えられない項目" checked disabled onChange={() => undefined} />
            </div>
          </div>
        </Section>
        <Section level={2} title="エラーの状態">
          <div className="cat-form">
            <ErrorCase label="スイッチ"><FormField label="同意" error="同意してください"><Switch checked={false} onChange={() => undefined} /></FormField></ErrorCase>
            <ErrorCase label="プルダウン"><FormField label="担当" error="担当を選んでください"><Select value="none" onChange={() => undefined} options={[{ value: 'none', label: '未選択' }]} /></FormField></ErrorCase>
            <ErrorCase label="日付"><FormField label="開始日" error="開始日を選んでください"><DatePicker value={null} onChange={() => undefined} /></FormField></ErrorCase>
          </div>
        </Section>
        <Section level={2} title="数">
          <div className="cat-form">
            <FormField label="人数"><NumberField value={count} onChange={setCount} min={0} max={10} unit="名" /></FormField>
            <div className="cat-row"><LinkButton onClick={() => setCount(5)}>人数を 5 にする</LinkButton></div>
            <FormField label="割合"><NumberField value={rate} onChange={setRate} min={0} max={1} step={0.1} /></FormField>
          </div>
        </Section>
    </Page>
  )
}

export function FeedbackPage() {
  const [dialog, setDialog] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [plain, setPlain] = useState(false)
  const [long, setLong] = useState(false)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [role, setRole] = useState('edit')
  const remove = () => {
    setBusy(true)
    setTimeout(() => { setBusy(false); setConfirm(false); toast('1件削除しました', { action: { label: '元に戻す', onClick: () => toast('元に戻しました', { tone: 'ok' }) } }) }, 400)
  }
  return (
    <Page label="知らせと確認">
        <Section level={2} title="確認">
          <div className="cat-row">
            <Button onClick={() => setDialog(true)}>窓を開く</Button>
            <Button onClick={() => setPlain(true)}>確定を確かめる</Button>
            <Button variant="danger" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setConfirm(true)}>削除する</Button>
            <Button onClick={() => setLong(true)}>長い本文の窓</Button>
          </div>
          <Dialog open={long} onClose={() => setLong(false)} title="利用の条件">{Array.from({ length: 40 }, (_, i) => <Prose key={i}>{i + 1} 番目の条件。</Prose>)}</Dialog>
          <Dialog open={dialog} onClose={() => setDialog(false)} title="名前を変える" footer={<><Button onClick={() => setDialog(false)}>やめる</Button><Button variant="primary" onClick={() => setDialog(false)}>変更する</Button></>}>
            <div className="cat-row">
              <LinkButton onClick={() => { setDialog(false); setTimeout(() => setDialog(true), 40) }}>閉じてすぐ開き直す</LinkButton>
              <LinkButton onClick={() => { toast('名前を控えました'); setTimeout(() => setDialog(false), 30) }}>知らせてから閉じる</LinkButton>
            </div>
            <FormField label="新しい名前"><TextField value={text} onChange={setText} /></FormField>
            <FormField label="権限"><Select value={role} onChange={setRole} options={[{ value: 'edit', label: '編集できる' }, { value: 'view', label: '見るだけ' }]} /></FormField>
          </Dialog>
          <ConfirmDialog open={plain} title="この内容で公開しますか" confirmLabel="公開する" onConfirm={() => { setPlain(false); toast('公開しました', { tone: 'ok' }) }} onCancel={() => setPlain(false)} />
          <ConfirmDialog open={confirm} danger loading={busy} title="このプロジェクトを削除しますか" confirmLabel="削除する" onConfirm={remove} onCancel={() => setConfirm(false)}>タスクもすべて消えます</ConfirmDialog>
        </Section>
        <Section level={2} title="知らせ">
          <div className="cat-stack">
            <Notice>同期が止まっています</Notice>
            <Notice tone="danger">保存できませんでした</Notice>
            <Notice tone="ok">すべて同期しました</Notice>
            <Notice tone="info">新しい版があります</Notice>
            <div className="cat-row">
            <Button onClick={() => toast('保存しました', { tone: 'ok' })}>完了を知らせる</Button>
            <Button onClick={() => toast('通信できませんでした', { tone: 'danger' })}>失敗を知らせる</Button>
            <Button onClick={() => toast('1件アーカイブしました', { action: { label: '元に戻す', onClick: () => undefined } })}>取り消せる知らせ</Button>
            </div>
          </div>
        </Section>
        <Section level={2} title="進み具合">
          <div className="cat-stack">
            <div className="cat-row"><Spinner /><Spinner size="lg" /></div>
            <ProgressBar label="取り込み" value={64} showValue />
            <ProgressBar label="準備" value={null} />
          </div>
        </Section>
    </Page>
  )
}
