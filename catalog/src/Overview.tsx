import { IconAccessible, IconArrowRight, IconBell, IconBrandGithub, IconDevices, IconEyeCheck, IconLayout, IconRocket, IconSparkles } from '@tabler/icons-react'
import { Board, Button, Checkbox, CodeBlock, EntityRow, IconBox, ProgressBar, Segmented, Stat, Steps, Switch, Tag, ThemeSettings, useScrollFocus, type Theme } from '@ymasaki/ignite'
import { useRef, useState, type ReactNode } from 'react'
import { version } from '../../package.json'
import { LOGO } from './logo'
import { PAGES, PART_COUNT } from './nav'

// カタログの入口。Ignite が何をしてくれるかを、本物の部品で見せる（見本の部品は押して試せる）
const GROUPS = ['基礎', '部品', '画面の型']
const REPO = 'https://github.com/ymasaki/ignite'
const ico = (I: typeof IconBell) => <I size={18} stroke={1.8} />

const PILLARS = [
  { icon: ico(IconLayout), title: '色は主要色だけ', lines: ['強調に使う色は主要色ひとつ。', 'ほかは灰色の濃さと余白で分ける。'] },
  { icon: ico(IconSparkles), title: '開閉と数字に動き', lines: ['開閉や数字の変化に動きを付ける。', '動きを減らす設定にすると止まる。'] },
  { icon: ico(IconEyeCheck), title: '見やすさを監査', lines: ['文字と背景のコントラストと', '文字の大きさを、画面ごとに測る。'] },
  { icon: ico(IconDevices), title: 'スマホの幅にも対応', lines: ['画面が狭くなると、', '部品が余白と並びを詰める。'] },
]

const STEPS = [
  { title: '取得する', code: `$ gh release download v${version} --repo github.com/ymasaki/ignite` },
  { title: '初期化する', code: '$ npx ignite init' },
  { title: '検査する', code: '$ npx ignite check\n$ npm run ignite:audit' },
]

/** LP の段の見出し。小さな印・大きな見出し・短い補足 */
function Lead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="cat-lead">
      <span className="cat-eyebrow">{eyebrow}</span>
      <span className="cat-lead-t" role="heading" aria-level={2}>{title}</span>
      {children && <span className="cat-lead-s">{children}</span>}
    </div>
  )
}

/** ヒーローの右に置く、本物の部品で組んだ小さな画面 */
function Showcase() {
  const [notify, setNotify] = useState(true)
  const [digest, setDigest] = useState(false)
  const [freq, setFreq] = useState<'day' | 'week' | 'month'>('week')
  const [step, setStep] = useState(1)
  return (
    <div className="cat-show">
      <div className="cat-mock">
        <div className="cat-mock-h">
          <IconBox>{ico(IconBell)}</IconBox>
          <span className="cat-mock-t">通知の設定</span>
          <Tag variant={notify ? 'ok' : 'default'}>{notify ? '受け取る' : '止めている'}</Tag>
        </div>
        <Switch label="新着を知らせる" checked={notify} onChange={setNotify} />
        <Checkbox label="週の要約も送る" checked={digest} onChange={setDigest} />
        <Segmented fill label="頻度" value={freq} onChange={setFreq} options={[{ value: 'day', label: '毎日' }, { value: 'week', label: '毎週' }, { value: 'month', label: '毎月' }]} />
        <div className="cat-end">
          <Button>取り消す</Button>
          <Button variant="primary">保存</Button>
        </div>
      </div>
      <div className="cat-mock sub">
        <Steps label="導入の進み" steps={['取得', '初期化', '検査']} current={step} />
        <ProgressBar label="導入の進み" value={Math.round(((step + 1) / 3) * 100)} showValue />
        <div className="cat-end">
          <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>戻る</Button>
          <Button variant="primary" disabled={step === 2} onClick={() => setStep((s) => Math.min(2, s + 1))}>次へ</Button>
        </div>
      </div>
    </div>
  )
}

export function OverviewPage({ theme, onTheme, onOpen }: { theme: Theme; onTheme: (t: Theme) => void; onOpen: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, '概要')
  return (
    <Board>
      <div className="cat-wrap">
        <div className="cat" ref={ref}>
          <div className="cat-main cat-lp">
            <section className="cat-hero">
              <div className="cat-hero-b">
                <div className="cat-hero-brand">
                  {LOGO}
                  <span className="cat-hero-name">Ignite</span>
                </div>
                <div role="heading" aria-level={2}>
                  <span className="cat-hero-t">React アプリの画面を</span>
                  <span className="cat-hero-t em">同じ部品と決まりでそろえる</span>
                </div>
                <div className="cat-hero-p">
                  <span>ボタン・入力欄・表・グラフなど {PART_COUNT} の部品を React で使える。</span>
                  <span>決まりに沿っているかは、ignite check と監査で確かめる。</span>
                </div>
                <div className="cat-row">
                  <Button variant="primary" icon={ico(IconRocket)} onClick={() => onOpen('setup')}>セットアップを始める</Button>
                  <Button icon={ico(IconArrowRight)} onClick={() => onOpen('actions')}>部品を見る</Button>
                  <Button icon={ico(IconBrandGithub)} onClick={() => window.open(REPO, '_blank', 'noopener,noreferrer')}>GitHub</Button>
                </div>
                <div className="cat-hero-s">
                  <Stat label="部品" value={PART_COUNT} />
                  <Stat label="スキン" value={3} />
                  <Stat label="表示モード" value={3} />
                  <Stat label="外部の UI ライブラリ" value={0} />
                </div>
              </div>
              <Showcase />
            </section>

            <section className="cat-band">
              <Lead eyebrow="特徴" title="部品が持っている決まり">
                部品を使えば、アプリの CSS で決めなくても次の点がそろう。
              </Lead>
              <div className="cat-pillars">
                {PILLARS.map((p) => (
                  <div className="cat-pillar" key={p.title}>
                    <IconBox size="lg">{p.icon}</IconBox>
                    <span className="cat-pillar-t">{p.title}</span>
                    <span className="cat-pillar-s">{p.lines.map((l) => <span key={l}>{l}</span>)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="cat-band cat-split">
              <Lead eyebrow="テーマ" title="スキンと表示モードを切り替える">
                選ぶと、このカタログ全体の色がすぐ変わる。
              </Lead>
              <div className="cat-stack">
                <ThemeSettings value={theme} onChange={onTheme} />
                <div className="cat-ramp">{[1, 2, 3, 4, 5].map((n) => <i className="cat-ramp-i" key={n} ref={(el) => el?.style.setProperty('background', `var(--chart-${n})`)} />)}</div>
                <div className="cat-row cat-note">{ico(IconAccessible)}<span>どのスキンでもコントラストを監査で確かめている</span></div>
              </div>
            </section>

            <section className="cat-band">
              <Lead eyebrow="はじめかた" title="取得から検査までの手順" />
              <div className="cat-steps">
                {STEPS.map((s, i) => (
                  <div className="cat-step" key={s.title}>
                    <span className="cat-step-n num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="cat-pillar-t">{s.title}</span>
                    <CodeBlock language="shell" label={s.title} wrap code={s.code} />
                  </div>
                ))}
              </div>
              <div className="cat-row"><Button icon={ico(IconArrowRight)} onClick={() => onOpen('setup')}>手順をすべて見る</Button></div>
            </section>

            <section className="cat-band">
              <Lead eyebrow="カタログ" title="部品と画面の型を見る" />
              {GROUPS.map((g) => (
                <div className="cat-group" key={g}>
                  <span className="cat-group-t" role="heading" aria-level={3}>{g}</span>
                  <div className="cat-tiles">
                    {PAGES.filter((p) => p.group === g).map((p) => <EntityRow key={p.key} onClick={() => onOpen(p.key)} lead={<IconBox>{p.icon}</IconBox>} title={p.label} sub={p.specs.length ? `${p.specs.length}項目` : '画面の型'} />)}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </Board>
  )
}
