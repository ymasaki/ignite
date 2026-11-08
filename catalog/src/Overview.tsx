import { IconAccessible, IconArrowRight, IconBell, IconBrandGithub, IconDevices, IconEyeCheck, IconLayout, IconPalette, IconRefresh, IconRocket, IconSparkles } from '@tabler/icons-react'
import { Avatar, Board, Button, Checkbox, CodeBlock, currentAssist, Delta, EntityRow, IconBox, LinkButton, ProgressBar, RollingNumber, Segmented, SettingGroup, SettingRow, setAssist, Sparkline, Stat, Steps, Switch, Tag, TextField, ThemeSettings, useScrollFocus, withFade, type Assist, type Theme } from '@ymasaki/ignite'
import { useRef, useState, type ReactNode } from 'react'
import { version } from '../../package.json'
import { HeroLogo } from './logo'
import { PAGES, PART_COUNT } from './nav'

// カタログの入口。Ignite が何をしてくれるかを、本物の部品で見せる（見本の部品は押して試せる）
const GROUPS = ['基礎', '部品', '画面の型']
const REPO = 'https://github.com/ymasaki/ignite'
const ico = (I: typeof IconBell) => <I size={18} stroke={1.8} />

/** 特徴の見出しと説明。demo は説明の隣に置く本物の部品の見本、go は詳しく見るページ */
type Feature = { icon: ReactNode; title: string; text: string[]; go: string; more: string; demo: ReactNode }

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

/** シンプル: 灰色の濃さと余白で分け、色は主要色ひとつだけ */
function SimpleDemo() {
  const [name, setName] = useState('山田 花子')
  return (
    <div className="cat-demo-card">
      <div className="cat-mock-h">
        <Avatar initial="山" />
        <span className="cat-mock-t">プロフィール</span>
        <Tag variant="ok">公開中</Tag>
      </div>
      <TextField label="表示名" value={name} onChange={setName} />
      <div className="cat-end">
        <Button>取り消す</Button>
        <Button variant="primary">保存</Button>
      </div>
    </div>
  )
}

/** テーマ: 選ぶとページ全体が切り替わる。隣の部品で、主要色がどこに効くかを見せる */
function ThemeDemo({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
  const [on, setOn] = useState(true)
  return (
    <div className="cat-demo-split">
      <ThemeSettings value={theme} onChange={onTheme} />
      <div className="cat-demo-card">
        <Switch label="新着を知らせる" checked={on} onChange={setOn} />
        <ProgressBar label="進み" value={68} showValue />
        <div className="cat-end">
          <Tag variant="ok">受け取る</Tag>
          <Button variant="primary">保存</Button>
        </div>
      </div>
    </div>
  )
}

/** アニメーション: 数字が転がり、スイッチと開閉が弾む */
function MotionDemo() {
  const [n, setN] = useState(1280)
  const [prev, setPrev] = useState(1180)
  const [hist, setHist] = useState([9, 12, 10, 14, 13, 16, 15])
  const [on, setOn] = useState(false)
  const bump = () => {
    const next = Math.max(800, n + Math.round((Math.random() - 0.35) * 300))
    setPrev(n)
    setN(next)
    setHist((h) => [...h.slice(1), Math.round(next / 80)])
  }
  return (
    <div className="cat-demo-card">
      <span className="cat-demo-l">今週の訪問</span>
      <div className="cat-demo-num">
        <span className="cat-face-v num"><RollingNumber value={n} /></span>
        <Delta value={n - prev} />
      </div>
      <Sparkline label="訪問の推移" values={hist} />
      <Switch label="自動で更新する" checked={on} onChange={setOn} />
      <div className="cat-end"><Button variant="primary" icon={ico(IconRefresh)} onClick={bump}>数字を変える</Button></div>
    </div>
  )
}

const WIDTHS = [{ value: 'pc', label: 'PC' }, { value: 'tab', label: 'タブレット' }, { value: 'sp', label: 'スマホ' }] as const
type Width = (typeof WIDTHS)[number]['value']

/** レスポンシブ: 枠の幅を変えると、中の部品が並びを組み変える */
function ResponsiveDemo() {
  const [w, setW] = useState<Width>('pc')
  return (
    <div className="cat-demo-col">
      <Segmented fill label="画面の幅" value={w} onChange={setW} options={[...WIDTHS]} />
      <div className="cat-demo-stage">
        <div className={`cat-demo-frame ${w}`}>
          <div className="cat-demo-grid">
            <Stat label="訪問" value={1280} />
            <Stat label="登録" value={86} />
            <Stat label="継続率" value={92} unit="%" />
            <Stat label="問い合わせ" value={14} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** アクセシビリティ: 選ぶとページ全体の文字とコントラストが変わる */
function AssistDemo() {
  return (
    <div className="cat-demo-col">
      <AssistTry />
      <span className="cat-row cat-note">{ico(IconEyeCheck)}<span>どのテーマでも、コントラストは監査で確かめている</span></span>
    </div>
  )
}

export function OverviewPage({ theme, onTheme, onOpen }: { theme: Theme; onTheme: (t: Theme) => void; onOpen: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, '概要')
  const features: Feature[] = [
    { icon: ico(IconLayout), title: 'シンプルでモダン', text: ['クセがなく、ひと目で使い方がわかる。', '色は主要色ひとつ。ほかは灰色の濃さと余白で分ける。', 'それでいて、ちゃんとかっこいい。'], go: 'actions', more: '部品を見る', demo: <SimpleDemo /> },
    { icon: ico(IconPalette), title: 'テーマで色を着せ替え', text: ['テーマカラーを選ぶだけで、画面全体の色がそろって変わる。', 'ライトとダークにも標準で対応。', '選ぶと、このカタログの色がすぐに変わる。'], go: 'color', more: '色を見る', demo: <ThemeDemo theme={theme} onTheme={onTheme} /> },
    { icon: ico(IconSparkles), title: '遊び心のあるアニメーション', text: ['数字は転がって変わり、スイッチは弾んで切り替わる。', 'ちょっとした動きに手ざわりがあって、触るのが楽しくなる。'], go: 'motion', more: '動きを見る', demo: <MotionDemo /> },
    { icon: ico(IconDevices), title: 'どんな幅にもフィット', text: ['レスポンシブの仕組みを標準装備。', 'PC からスマホまで、幅に合わせて UI がしなやかに組み変わる。', '幅を変えると、並びが組み変わる。'], go: 'responsive', more: 'レスポンシブ表示を見る', demo: <ResponsiveDemo /> },
    { icon: ico(IconAccessible), title: '誰にでも見やすく', text: ['見づらさを感じる人にも届くように。', 'コントラストを強めたり、文字を大きくしたりできる。', '選ぶと、このページ全体に効く。'], go: 'settings', more: '設定の画面を見る', demo: <AssistDemo /> },
  ]
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
                  <span>Ignite は、そんな画面をすぐ形にできる</span>
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
              <Lead eyebrow="特徴" title="毎日さわる画面を、もっと気持ちよく">
                <span>見本は、どれも本物の部品。押して試せる。</span>
              </Lead>
              <div className="cat-feats">
                {features.map((f) => (
                  <div className="cat-feat" key={f.title}>
                    <div className="cat-feat-b">
                      <IconBox size="lg">{f.icon}</IconBox>
                      <span className="cat-feat-t" role="heading" aria-level={3}>{f.title}</span>
                      <span className="cat-feat-s">{f.text.map((l) => <span key={l}>{l}</span>)}</span>
                      <LinkButton className="cat-pillar-go" onClick={() => onOpen(f.go)}>{f.more}{ico(IconArrowRight)}</LinkButton>
                    </div>
                    <div className="cat-feat-demo">{f.demo}</div>
                  </div>
                ))}
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
