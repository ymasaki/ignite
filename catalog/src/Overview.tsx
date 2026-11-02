import { IconChecks, IconClock } from '@tabler/icons-react'
import { Avatar, AvatarGroup, BarList, Board, Button, CopyText, Delta, EntityRow, IconBox, Kpi, LineChart, Notice, ProgressBar, Section, Segmented, Sparkline, Stat, Tag, TextField, useScrollFocus } from '@ymasaki/ignite'
import { useRef, type ReactNode } from 'react'
import { VALUES } from './Charts'
import { PROJECTS, MONTHS } from './data'
import { PAGES, PART_COUNT } from './nav'

const noop = () => undefined
const THUMBS: Record<string, ReactNode> = {
  color: <><Tag variant="accent">主要色</Tag><Tag variant="ok">完了</Tag><Tag variant="warn">要確認</Tag><Tag variant="danger">失敗</Tag></>,
  type: <Stat value={32} unit="px" size="lg" />,
  shape: <><Tag>99</Tag><IconBox>12</IconBox><Avatar initial="佐" tone="c1" /></>,
  motion: <div className="cat-thumb-w"><ProgressBar label="進み具合" value={64} /></div>,
  actions: <><Button variant="primary">追加する</Button><Button>書き出す</Button></>,
  navigate: <Segmented label="切り替えの例" value="a" onChange={noop} options={[{ value: 'a', label: 'すべて', count: 6 }, { value: 'b', label: '進行中', count: 3 }]} />,
  forms: <div className="cat-thumb-w"><TextField label="名前" value="佐藤 葵" onChange={noop} /></div>,
  feedback: <div className="cat-thumb-w"><Notice tone="ok">すべて同期しました</Notice></div>,
  marks: <AvatarGroup label="メンバー" items={PROJECTS.map((p) => ({ key: p.id, initial: p.initial, tone: p.tone, tip: p.owner }))} max={4} />,
  data: <div className="cat-thumb-w"><EntityRow lead={<Avatar initial="佐" tone="c1" size="sm" />} title="ウェブサイト刷新" sub="佐藤 葵" /></div>,
  code: <Tag>retry.ts</Tag>,
  charts: <Sparkline label="完了の推移" values={VALUES} height={48} />,
  list: <div className="cat-thumb-w"><EntityRow lead={<Avatar initial="鈴" tone="c2" size="sm" />} title="請求の自動化" trailing={<Tag>進行中</Tag>} /></div>,
  dashboard: <Stat value={127} unit="件" />,
}

const GROUPS = ['基礎', '部品', '画面の型']

export function OverviewPage({ onOpen }: { onOpen: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, '概要')
  return (
    <Board>
      <div className="cat-wrap">
        <div className="cat" ref={ref}>
          <div className="cat-main">
            <div className="cat-hero cat-full">
              <div className="cat-hero-b">
                <div><span className="cat-hero-t">どのアプリでも、</span><span className="cat-hero-t">同じ見た目と使い勝手に</span></div>
                <div className="cat-hero-s">
                  <Stat label="部品" value={PART_COUNT} />
                  <Stat label="スキン" value={3} />
                  <Stat label="表示モード" value={3} />
                </div>
                <div className="cat-row"><CopyText text="npm i @ymasaki/ignite" label="導入の命令" /></div>
              </div>
              <div className="cat-show" inert>
                <div className="kpis">
                  <Kpi icon={<IconClock size={18} stroke={1.8} />} label="進行中" value={3} unit="件" sub={<Delta value={1} unit="件" />} />
                  <Kpi icon={<IconChecks size={18} stroke={1.8} />} label="完了" value={52} unit="件" sub={<Delta value={7} unit="件" />} />
                </div>
                <div className="cat-sheet"><LineChart unit="件" height={110} legend={false} xLabels={MONTHS.map((m) => m.slice(5))} series={[{ label: '完了', values: VALUES }]} /></div>
                <div className="cat-sheet"><BarList items={PROJECTS.slice(0, 3).map((p) => ({ label: p.owner, value: p.tasks }))} /></div>
              </div>
            </div>
            {GROUPS.map((g) => (
              <div className="cat-full" key={g}>
                <Section level={2} title={g} count={PAGES.filter((p) => p.group === g).length}>
                  <div className="cat-tiles">
                    {PAGES.filter((p) => p.group === g).map((p) => (
                      <div className="cat-tile" key={p.key}>
                        <div className="cat-thumb" inert>{THUMBS[p.key]}</div>
                        <EntityRow onClick={() => onOpen(p.key)} lead={<IconBox>{p.icon}</IconBox>} title={p.label} sub={p.specs.length ? `${p.specs.length}項目` : '画面の型'} />
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Board>
  )
}
