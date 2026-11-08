import { IconAccessible, IconArrowRight, IconBell, IconBrandGithub, IconDevices, IconLayout, IconPalette, IconRocket, IconSparkles } from '@tabler/icons-react'
import { Board, Button, Checkbox, CodeBlock, currentAssist, EntityRow, IconBox, LinkButton, ProgressBar, Segmented, SettingGroup, SettingRow, setAssist, Stat, Steps, Switch, Tag, ThemeSettings, useScrollFocus, withFade, type Assist, type Theme } from '@ymasaki/ignite'
import { useRef, useState, type ReactNode } from 'react'
import { version } from '../../package.json'
import { HeroLogo } from './logo'
import { PAGES, PART_COUNT } from './nav'

// カタログの入口。Ignite が何をしてくれるかを、本物の部品で見せる（見本の部品は押して試せる）
const GROUPS = ['基礎', '部品', '画面の型']
const REPO = 'https://github.com/ymasaki/ignite'
const TRY = 'cat-try'
const ico = (I: typeof IconBell) => <I size={18} stroke={1.8} />

/** 特徴。go は詳しく見る先（ページの key、または概要の中の段の id） */
const PILLARS = [
  { icon: ico(IconLayout), title: 'シンプルでモダン', text: ['クセがなく、ひと目で使い方がわかる。', 'それでいて、ちゃんとかっこいい。'], go: 'actions', more: '部品を見る' },
  { icon: ico(IconPalette), title: 'テーマで色を着せ替え', text: ['テーマカラーを選ぶだけで、画面全体の色がそろって変わる。', 'ライトとダークにも標準で対応。'], go: TRY, more: '試してみる' },
  { icon: ico(IconSparkles), title: '遊び心のあるアニメーション', text: ['開く、切り替わる、数字が動く。', 'ちょっとした動きに手ざわりがあって、触るのが楽しくなる。'], go: 'motion', more: '動きを見る' },
  { icon: ico(IconDevices), title: 'どんな幅にもフィット', text: ['レスポンシブの仕組みを標準装備。', 'PC からスマホまで、幅に合わせて UI がしなやかに組み変わる。'], go: 'responsive', more: 'レスポンシブ表示を見る' },
  { icon: ico(IconAccessible), title: '誰にでも見やすく', text: ['見づらさを感じる人にも届くように。', 'コントラストを強めたり、文字を大きくしたりもできる。'], go: TRY, more: '試してみる' },
]

const TEXT_OPTIONS: { value: Assist['text']; label: string }[] = [{ value: 'normal', label: '標準' }, { value: 'large', label: '大' }, { value: 'larger', label: '特大' }]
const CONTRAST_OPTIONS: { value: Assist['contrast']; label: string }[] = [{ value: 'auto', label: '端末に合わせる' }, { value: 'more', label: '強く' }]

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

/** 見やすさの補助のうち、違いがすぐ目に見える 2 つだけを試せる。全部の項目は AssistSettings（画面の型の設定）にある */
function AssistTry() {
  const [assist, set] = useState<Assist>(currentAssist)
  const change = (patch: Partial<Assist>) => {
    const next = { ...currentAssist(), ...patch }
    withFade(() => setAssist(next))
    set(next)
  }
  return (
    <SettingGroup title="見やすさ">
      <SettingRow label="コントラスト">
        <Segmented label="コントラスト" value={assist.contrast} onChange={(contrast) => change({ contrast })} options={CONTRAST_OPTIONS} />
      </SettingRow>
      <SettingRow label="文字の大きさ">
        <Segmented label="文字の大きさ" value={assist.text} onChange={(text) => change({ text })} options={TEXT_OPTIONS} />
      </SettingRow>
    </SettingGroup>
  )
}

export function OverviewPage({ theme, onTheme, onOpen }: { theme: Theme; onTheme: (t: Theme) => void; onOpen: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, '概要')
  // 概要の中の段へは、その場でスクロールする。それ以外はページを開く
  const go = (to: string) => (to === TRY ? document.getElementById(TRY)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : onOpen(to))
  return (
    <Board>
      <div className="cat-wrap">
        <div className="cat" ref={ref}>
          <div className="cat-main cat-lp cat-fx-wrap">
            <div className="cat-fx" aria-hidden="true"><span /><span /><span /><span /></div>
            <section className="cat-hero">
              <div className="cat-hero-b">
                <HeroLogo>
                  <Tag>v{version}</Tag>
                </HeroLogo>
                <span className="cat-hero-t" role="heading" aria-level={2}>使いやすさと楽しさを、<em>誰にでも</em></span>
                <div className="cat-hero-p">
                  <span>すっきり見やすくて、触るとちょっと楽しい。</span>
                  <span>Ignite は、そんな画面を React ですぐ形にできる</span>
                  <span>デザインシステムです。</span>
                </div>
                <div className="cat-row">
                  <Button variant="primary" icon={ico(IconRocket)} onClick={() => onOpen('setup')}>セットアップを始める</Button>
                  <Button icon={ico(IconArrowRight)} onClick={() => onOpen('actions')}>部品を見る</Button>
                  <Button icon={ico(IconBrandGithub)} onClick={() => window.open(REPO, '_blank', 'noopener,noreferrer')}>GitHub</Button>
                </div>
                <div className="cat-hero-s">
                  <Stat label="部品" value={PART_COUNT} />
                  <Stat label="テーマカラー" value={3} />
                  <Stat label="表示モード" value={3} />
                  <Stat label="外部の UI ライブラリ" value={0} />
                </div>
              </div>
              <Showcase />
            </section>

            <section className="cat-band">
              <Lead eyebrow="特徴" title="毎日さわる画面を、もっと気持ちよく" />
              <div className="cat-pillars">
                {PILLARS.map((p) => (
                  <div className="cat-pillar" key={p.title}>
                    <IconBox size="lg">{p.icon}</IconBox>
                    <span className="cat-pillar-t">{p.title}</span>
                    <span className="cat-pillar-s">{p.text.map((l) => <span key={l}>{l}</span>)}</span>
                    <LinkButton className="cat-pillar-go" onClick={() => go(p.go)}>{p.more}{ico(IconArrowRight)}</LinkButton>
                  </div>
                ))}
              </div>
            </section>

            <section className="cat-band cat-split" id={TRY}>
              <div className="cat-stack">
                <Lead eyebrow="試してみる" title="好きな色で、見やすい大きさで">
                  <span>選ぶと、このカタログ全体がすぐに変わる。</span>
                  <span>どのテーマでも、コントラストは監査で確かめている。</span>
                </Lead>
                <div className="cat-ramp" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <i className="cat-ramp-i" key={n} ref={(el) => el?.style.setProperty('background', `var(--chart-${n})`)} />)}</div>
              </div>
              <div className="cat-stack">
                <ThemeSettings value={theme} onChange={onTheme} />
                <AssistTry />
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
