import { BarList, Board, CopyText, EntityRow, IconBox, LineChart, LinkButton, Stat, useScrollFocus } from '@ymasaki/ignite'
import { useRef } from 'react'
import { VALUES } from './Charts'
import { PROJECTS, MONTHS } from './data'
import { Row } from './kit'
import { PAGES, PART_COUNT } from './nav'

const GROUPS = ['基礎', '部品', '画面の型']

export function OverviewPage({ onOpen }: { onOpen: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, '概要')
  return (
    <Board>
      <div className="cat-wrap">
        <div className="cat" ref={ref}>
          <div className="cat-main">
            <div className="cat-hero">
              <div className="cat-hero-b">
                <div><span className="cat-hero-t">どのアプリでも、</span><span className="cat-hero-t">同じ見た目と使い勝手に</span></div>
                <div className="cat-hero-s">
                  <Stat label="部品" value={PART_COUNT} />
                  <Stat label="スキン" value={3} />
                  <Stat label="表示モード" value={3} />
                </div>
                <div className="cat-row"><CopyText text="npm i @ymasaki/ignite" label="導入の命令" /><LinkButton onClick={() => onOpen('setup')}>セットアップの手順</LinkButton></div>
              </div>
              <div className="cat-show" inert>
                <LineChart unit="件" height={150} legend={false} xLabels={MONTHS.map((m) => m.slice(5))} series={[{ label: '完了', values: VALUES }]} />
                <BarList items={PROJECTS.slice(0, 3).map((p) => ({ label: p.owner, value: p.tasks }))} />
              </div>
            </div>
            {GROUPS.map((g) => (
              <Row key={g} title={g}>
                <div className="cat-tiles">
                  {PAGES.filter((p) => p.group === g).map((p) => <EntityRow key={p.key} onClick={() => onOpen(p.key)} lead={<IconBox>{p.icon}</IconBox>} title={p.label} sub={p.specs.length ? `${p.specs.length}項目` : '画面の型'} />)}
                </div>
              </Row>
            ))}
          </div>
        </div>
      </div>
    </Board>
  )
}
