import { IconBell, IconChartBar, IconCheck, IconPencil, IconSearch, IconSettings, IconTrash, IconUsers } from '@tabler/icons-react'
import { AnimatedList, Appear, Avatar, Button, Code, Collapse, CopyText, EntityRow, Expandable, KeyValues, MonthStepper, Prose, RollingNumber, Skeleton, Stat, Switch } from '@ymasaki/ignite'
import { useState } from 'react'
import { MONTHS, PROJECTS } from './data'
import { Case, Cases, Page, Spec } from './kit'

const Swatch = ({ name }: { name: string }) => (
  <div className="cat-swatch">
    <i className="cat-chip" data-token={name} ref={(el) => el?.style.setProperty('background', `var(${name})`)} />
    <CopyText text={name} label="トークン" />
  </div>
)
const Swatches = ({ names }: { names: string[] }) => <div className="cat-swatches">{names.map((n) => <Swatch key={n} name={n} />)}</div>

export function ColorPage({ target }: { target?: string | null }) {
  const p = 'color'
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="brand"><Swatches names={['--pri', '--solid', '--link', '--pri-ink', '--pri-soft', '--pri-soft-2']} /></Spec>
      <Spec page={p} id="surface"><Swatches names={['--bg', '--panel', '--panel-2', '--hover', '--line', '--line-2']} /></Spec>
      <Spec page={p} id="state"><Swatches names={['--ok-ink', '--ok-soft', '--warn', '--warn-soft', '--danger', '--danger-soft']} /></Spec>
      <Spec page={p} id="ink"><Swatches names={['--ink', '--ink-2', '--ink-3']} /></Spec>
      <Spec page={p} id="scale">
        <div className="cat-ramp">{[1, 2, 3, 4, 5].map((n) => <i className="cat-ramp-i" key={n} ref={(el) => el?.style.setProperty('background', `var(--chart-${n})`)} />)}</div>
        <div className="cat-row">{[1, 2, 3, 4, 5].map((n) => <CopyText key={n} text={`--chart-${n}`} label="トークン" />)}</div>
      </Spec>
    </Page>
  )
}

const SIZES: [number, string][] = [[32, '主役の数字'], [24, '画面のタイトル'], [20, 'パネルの見出し'], [16, '固定ヘッダーの名前'], [14, '画面の本文'], [13, '部品の本文'], [12, '補足・件数'], [11, 'タグ・目盛り']]

export function TypePage({ target }: { target?: string | null }) {
  const p = 'type'
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="sizes">
        <div className="cat-stack">{SIZES.map(([s, use]) => <div className="cat-scale" key={s}><span className="cat-scale-v num">{s}</span><span className="cat-scale-t" ref={(el) => el?.style.setProperty('font-size', `var(--fs-${s})`)}>{use}</span></div>)}</div>
      </Spec>
      <Spec page={p} id="faces">
        <div className="cat-stack">
            <span className="cat-face"><span className="cat-face-l">LINE Seed JP</span><span>本文と見出し。English words mix naturally.</span></span>
            <span className="cat-face"><span className="cat-face-l">Inter</span><span className="cat-face-v num">¥1,234,567<small>円</small></span><span className="cat-face-v num">98.6%</span><span className="cat-face-v num">12,480<small>件</small></span></span>
            <span className="cat-face"><span className="cat-face-l">JetBrains Mono</span><span>設定の <Code>retryCount</Code> と <Code>npx ignite check</Code> を文中に置く</span></span>
          </div>
      </Spec>
      <Spec page={p} id="weights">
        <Cases cols={3}>
          <Case label="400 本文"><span className="cat-w400">読みやすい</span></Case>
          <Case label="600 補助"><span className="cat-w600">読みやすい</span></Case>
          <Case label="700 名前"><span className="cat-w700">読みやすい</span></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="sample">
        <div className="cat-stack">
          <span className="cat-t-sub">2026年10月の進み具合</span>
          <span className="cat-t-title">ウェブサイト刷新</span>
          <span className="cat-t-body">デザインを更新し、表示速度を改善する</span>
        </div>
      </Spec>
    </Page>
  )
}

export function ShapePage({ target }: { target?: string | null }) {
  const p = 'shape'
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="radius">
        <div className="cat-cases cols3">{[[6, '印'], [8, '行'], [10, 'ボタン'], [12, 'カード'], [14, 'パネル'], [99, 'タグ']].map(([r, use]) => <div className={`cat-box cat-r${r}`} key={r}>{r} {use}</div>)}</div>
      </Spec>
      <Spec page={p} id="shadow">
        <div className="cat-cases cols2">
          <div className="cat-box cat-r12 cat-s1">選択中の地</div>
          <div className="cat-box cat-r12 cat-s0">カード</div>
          <div className="cat-box cat-r12 cat-sh">カードのホバー</div>
          <div className="cat-box cat-r12 cat-s2">重ねるもの</div>
        </div>
      </Spec>
      <Spec page={p} id="space">
        <div className="cat-stack">{[4, 8, 12, 16, 24, 32].map((s) => <div className="cat-gap" key={s}><span className="num">{s}</span><i className="cat-gap-b" ref={(el) => el?.style.setProperty('width', `${s * 4}px`)} /></div>)}</div>
      </Spec>
      <Spec page={p} id="icons">
        <div className="cat-icons">{[IconSearch, IconPencil, IconTrash, IconSettings, IconBell, IconUsers, IconChartBar, IconCheck].map((I, i) => <I key={i} size={18} stroke={1.8} aria-hidden="true" />)}</div>
      </Spec>
    </Page>
  )
}

export function MotionPage({ target }: { target?: string | null }) {
  const p = 'motion'
  const [more, setMore] = useState(true)
  const [count, setCount] = useState(2)
  const [month, setMonth] = useState(MONTHS[MONTHS.length - 1])
  const [loaded, setLoaded] = useState(false)
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="collapse">
        <div className="cat-sheet">
          <Switch label="補足を見せる" checked={more} onChange={setMore} />
          <Collapse open={more}><Prose>押し下げて出す本文。下の段がなめらかに動く</Prose></Collapse>
        </div>
      </Spec>
      <Spec page={p} id="list">
        <div className="cat-sheet">
          <div className="cat-row"><Button onClick={() => setCount(count === 3 ? 1 : count + 1)}>行を増やす</Button></div>
          <AnimatedList items={PROJECTS.slice(0, count)} keyOf={(x) => x.id}>{(x) => <EntityRow lead={<Avatar initial={x.initial} tone={x.tone} size="sm" />} title={x.name} sub={x.owner} />}</AnimatedList>
        </div>
      </Spec>
      <Spec page={p} id="rolling">
        <Cases>
          <Case label="数字"><RollingNumber value={MONTHS.indexOf(month) * 13 + 24} /></Case>
          <Case label="大きな数字"><Stat value={MONTHS.indexOf(month) * 13 + 24} unit="件" /></Case>
          <Case label="対象の月を変える"><MonthStepper value={month} months={MONTHS} onChange={setMonth} /></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="appear">
        <div className="cat-sheet">
          {loaded ? <Appear><KeyValues rows={[['担当', '佐藤 葵'], ['期限', '2026年11月']]} /></Appear> : <Skeleton lines={2} heading={false} />}
        </div>
        <div className="cat-row"><Button onClick={() => setLoaded(!loaded)}>{loaded ? '読み込みに戻す' : '読み込みを終える'}</Button></div>
      </Spec>
      <Spec page={p} id="expand">
        <div className="cat-sheet"><Expandable lines={2}>月末の請求を手で集計していた作業を、自動の取り込みに置き換える。{'\n'}対象は 4 つの窓口で、受付から支払いの確認までを 1 つの画面にまとめる。{'\n'}10 月に第 1 弾を出し、11 月に残りの窓口へ広げる。{'\n'}切り替えのあいだは、手作業の結果と毎日見比べる。</Expandable></div>
      </Spec>
    </Page>
  )
}
