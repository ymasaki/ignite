import { IconBookmark, IconCopy, IconDownload, IconFilter, IconPencil, IconPlus, IconRefresh, IconSearch, IconSettings, IconShare, IconTrash } from '@tabler/icons-react'
import { Accordion, Button, CopyText, Crumbs, ExternalLink, IconButton, KeyValues, LinkButton, Menu, MonthStepper, Pagination, Popover, ProviderLogo, Segmented, Stepper, Steps, Tabs, toast } from '@ymasaki/ignite'
import { useEffect, useState } from 'react'
import { MONTHS } from './data'
import { Case, Cases, Page, Spec } from './kit'

const I = { size: 16, stroke: 1.8 }

/** データの更新で親が描き直されても、開いた一覧の今の項目が動かないことを確かめる */
export function useTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
}

export function ActionsPage({ target }: { target?: string | null }) {
  const p = 'actions'
  useTick()
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="button">
        <Cases>
          <Case label="主"><Button variant="primary" icon={<IconPlus {...I} />}>追加する</Button></Case>
          <Case label="通常"><Button icon={<IconDownload {...I} />}>書き出す</Button></Case>
          <Case label="危険"><Button variant="danger" icon={<IconTrash {...I} />}>削除する</Button></Case>
          <Case label="押し込み"><Button active icon={<IconFilter {...I} />}>絞り込み中</Button></Case>
          <Case label="処理中"><Button loading>送信中</Button></Case>
          <Case label="押せない"><Button disabled>保存する</Button></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="icon">
        <Cases>
          <Case label="標準"><div className="cat-row"><IconButton label="設定を開く"><IconSettings {...I} /></IconButton><IconButton label="共有する"><IconShare {...I} /></IconButton><IconButton label="保存する"><IconBookmark {...I} /></IconButton></div></Case>
          <Case label="ヘッダー"><IconButton size="lg" label="更新する"><IconRefresh size={18} stroke={1.8} /></IconButton></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="text">
        <Cases>
          <Case label="文字のボタン"><LinkButton>詳しく見る</LinkButton></Case>
          <Case label="外部のページ"><ExternalLink href="https://example.com/">利用の案内</ExternalLink></Case>
          <Case label="値をコピー"><div className="cat-parts"><CopyText text="ignite" label="名前" /></div></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="provider">
        <div className="cat-row">
          <Button icon={<ProviderLogo provider="google" />}>Google でログインする</Button>
          <Button icon={<ProviderLogo provider="apple" />}>Apple でログインする</Button>
          <Button icon={<ProviderLogo provider="microsoft" />}>Microsoft でログインする</Button>
          <Button icon={<ProviderLogo provider="github" />}>GitHub でログインする</Button>
          <Button icon={<ProviderLogo provider="okta" />}>Okta でログインする</Button>
        </div>
      </Spec>
      <Spec page={p} id="menu">
        <div className="cat-row">
          <Menu label="操作" items={[{ key: 'edit', label: '編集する', icon: <IconPencil {...I} />, onSelect: () => toast('編集を開きました') }, { key: 'copy', label: '複製する', icon: <IconCopy {...I} />, onSelect: () => toast('複製しました', { tone: 'ok' }) }, { key: 'off', label: '書き出す', disabled: true, onSelect: () => undefined }, { key: 'del', label: '削除する', icon: <IconTrash {...I} />, danger: true, separator: true, onSelect: () => toast('削除できませんでした', { tone: 'danger' }) }]} />
          <Menu label="その他の操作" iconOnly items={[{ key: 'a', label: '編集する', onSelect: () => undefined }]} />
        </div>
      </Spec>
      <Spec page={p} id="popover">
        <div className="cat-row">
          <Popover trigger={(open, toggle) => <Button active={open} aria-expanded={open} onClick={toggle} icon={<IconSearch {...I} />}>担当を見る</Button>}>
            <div className="cat-detail"><KeyValues rows={[['担当', '佐藤 葵'], ['期限', '2026年11月']]} /></div>
          </Popover>
        </div>
      </Spec>
    </Page>
  )
}

export function NavigatePage({ target }: { target?: string | null }) {
  const p = 'navigate'
  const [seg, setSeg] = useState('all')
  const [tab, setTab] = useState('a')
  const [month, setMonth] = useState(MONTHS[MONTHS.length - 1])
  const [week, setWeek] = useState('w2')
  const [page, setPage] = useState(4)
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="segmented"><div className="cat-row"><Segmented label="状態で絞り込む" value={seg} onChange={setSeg} options={[{ value: 'all', label: 'すべて', count: 6 }, { value: 'open', label: '進行中', count: 3 }, { value: 'done', label: '完了', count: 2 }]} /></div></Spec>
      <Spec page={p} id="tabs"><Tabs label="表示の切り替え" value={tab} onChange={setTab} tabs={[{ value: 'a', label: '概要' }, { value: 'b', label: '履歴', count: 12 }, { value: 'c', label: 'メンバー', count: 4 }]} /></Spec>
      <Spec page={p} id="stepper">
        <Cases>
          <Case label="対象の月"><MonthStepper value={month} months={MONTHS} onChange={setMonth} /></Case>
          <Case label="対象の週"><Stepper label="対象の週" prevLabel="前の週" nextLabel="次の週" value={week} onChange={setWeek} options={[{ value: 'w2', label: '第 2 週' }, { value: 'w1', label: '第 1 週' }]} /></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="pagination"><Pagination page={page} count={20} onChange={setPage} /></Spec>
      <Spec page={p} id="crumbs"><Crumbs items={['プロジェクト', '進行中']} label={(x) => x} onPick={() => undefined} current="ウェブサイト刷新" /></Spec>
      <Spec page={p} id="steps"><Steps label="登録の手順" steps={['入力', '確認', '完了']} current={1} /></Spec>
      <Spec page={p} id="accordion">
        <div className="cat-sheet"><Accordion defaultOpen={['a']} items={[{ key: 'a', title: '概要', meta: '3件', children: 'デザインを更新し、表示速度を改善する' }, { key: 'b', title: '履歴', children: '10 月に第 1 弾を公開した' }]} /></div>
      </Spec>
    </Page>
  )
}
