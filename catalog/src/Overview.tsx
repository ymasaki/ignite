import { IconArrowRight, IconBell, IconBrandGithub, IconEyeCheck, IconRefresh, IconRocket, IconChartBar, IconHome, IconMenu2, IconSettings, IconUsers } from '@tabler/icons-react'
import { Avatar, Button, CodeBlock, currentAssist, Delta, EntityRow, IconBox, LinkButton, ProgressBar, RollingNumber, Segmented, SettingGroup, SettingRow, setAssist, Sparkline, Stat, Switch, Tag, TextField, ThemeSettings, useScrollFocus, withFade, type Assist, type Theme } from '@ymasaki/ignite'
import { useRef, useState, type ReactNode } from 'react'
import { version } from '../../package.json'
import { HeroLogo } from './logo'
import { PAGES, PART_COUNT } from './nav'

// カタログの入口。Ignite が何をしてくれるかを、本物の部品で見せる
const GROUPS = ['基礎', '部品', '画面の型']
const REPO = 'https://github.com/ymasaki/ignite'
const ico = (I: typeof IconBell) => <I size={18} stroke={1.8} />

/** 特徴のカード。上に見出し・説明、線の下に本物の部品の見本（demo）。go は詳しく見るページ、wide は格子の横いっぱい */
type Feature = { title: string; text: string[]; go: string; more: string; demo: ReactNode; wide?: boolean }

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
  const [scope, setScope] = useState<'all' | 'team' | 'me'>('team')
  return (
    <div className="cat-demo-card">
      <div className="cat-mock-h">
        <Avatar initial="山" />
        <span className="cat-mock-t">プロフィール</span>
        <Tag variant="ok">公開中</Tag>
      </div>
      <TextField label="表示名" value={name} onChange={setName} />
      <Segmented fill label="公開範囲" value={scope} onChange={setScope} options={[{ value: 'all', label: '全員' }, { value: 'team', label: 'チーム' }, { value: 'me', label: '自分だけ' }]} />
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

const DEMO_NAV = [{ icon: IconHome, label: 'ホーム' }, { icon: IconChartBar, label: 'レポート' }, { icon: IconUsers, label: 'メンバー' }, { icon: IconSettings, label: '設定' }]

/**
 * レスポンシブ: 枠の幅を変えると、中の小さなアプリ画面が組み変わる（枠の幅で決まる container query）。
 * 広いと文字付きの左メニュー、狭まるとアイコンだけ、スマホの幅ではメニューのボタンになり数字が縦に並ぶ。枠の高さは変えない
 */
function ResponsiveDemo() {
  const [w, setW] = useState<Width>('pc')
  return (
    <div className="cat-demo-col">
      <Segmented fill label="画面の幅" value={w} onChange={setW} options={[...WIDTHS]} />
      <div className="cat-demo-stage">
        <div className={`cat-demo-frame ${w}`}>
          <div className="cat-demo-app">
            <div className="cat-demo-side" aria-hidden="true">
              {DEMO_NAV.map((n, i) => (
                <span className={`cat-demo-nav${i === 0 ? ' on' : ''}`} key={n.label}><n.icon size={16} stroke={1.8} /><span className="cat-demo-nav-l">{n.label}</span></span>
              ))}
            </div>
            <div className="cat-demo-main">
              <span className="cat-demo-top"><IconMenu2 className="cat-demo-menu" size={16} stroke={1.8} aria-hidden="true" />ホーム</span>
              <div className="cat-demo-grid">
                <Stat label="訪問" value={1280} />
                <Stat label="登録" value={86} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** アクセシビリティ: 選ぶとページ全体の文字とコントラストが変わる */
function AssistDemo() {
  return (
    <div className="cat-demo-card">
      <AssistTry />
      <span className="cat-row cat-note">{ico(IconEyeCheck)}<span>どのテーマでも、コントラストは監査で確かめている</span></span>
    </div>
  )
}

export function OverviewPage({ theme, onTheme, onOpen }: { theme: Theme; onTheme: (t: Theme) => void; onOpen: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFocus(ref, '概要')
  const features: Feature[] = [
    { title: 'シンプルでモダン', text: ['クセがなく、ひと目で使い方がわかる。', '色は主要色ひとつ、あとは灰色と余白で分ける。'], go: 'actions', more: '部品を見る', demo: <SimpleDemo /> },
    { title: '遊び心のあるアニメーション', text: ['数字は転がり、スイッチは弾む。', '小さな動きの手ざわりで、触るのが楽しくなる。'], go: 'motion', more: '動きを見る', demo: <MotionDemo /> },
    { title: 'テーマで色を着せ替え', text: ['テーマカラーを選ぶだけで、全体の色がそろって変わる。', 'ライトとダークにも標準で対応。'], go: 'color', more: '色を見る', demo: <ThemeDemo theme={theme} onTheme={onTheme} />, wide: true },
    { title: 'どんな幅にもフィット', text: ['PC からスマホまで、', '幅に合わせて UI がしなやかに組み変わる。'], go: 'responsive', more: 'レスポンシブ表示を見る', demo: <ResponsiveDemo /> },
    { title: '誰にでも見やすく', text: ['見づらさを感じる人にも届くように。', 'コントラストと文字の大きさを、このページで試せる。'], go: 'settings', more: '設定の画面を見る', demo: <AssistDemo /> },
  ]
  return (
    <section className="cat-bare">
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
            </section>

            <section className="cat-band">
              <Lead eyebrow="特徴" title="毎日さわる画面を、もっと気持ちよく" />
              <div className="cat-features">
                {features.map((f) => (
                  <div className={`cat-card cat-feature${f.wide ? ' wide' : ''}`} key={f.title}>
                    <div className="cat-feature-b">
                      <span className="cat-feature-t" role="heading" aria-level={3}>{f.title}</span>
                      <span className="cat-feature-s">{f.text.map((l) => <span key={l}>{l}</span>)}</span>
                      <LinkButton className="cat-pillar-go" onClick={() => onOpen(f.go)}>{f.more}{ico(IconArrowRight)}</LinkButton>
                    </div>
                    <div className="cat-feature-demo">{f.demo}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="cat-band">
              <Lead eyebrow="はじめかた" title="取得から検査までの手順" />
              <div className="cat-steps">
                {STEPS.map((s, i) => (
                  <div className="cat-card cat-step" key={s.title}>
                    <div className="cat-step-h">
                      <span className="cat-step-n num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="cat-pillar-t" role="heading" aria-level={3}>{s.title}</span>
                    </div>
                    <CodeBlock language="shell" label={s.title} wrap code={s.code} />
                  </div>
                ))}
              </div>
              <div className="cat-row"><Button icon={ico(IconArrowRight)} onClick={() => onOpen('setup')}>手順をすべて見る</Button></div>
            </section>

            <section className="cat-band">
              <Lead eyebrow="カタログ" title="部品と画面の型を見る" />
              <div className="cat-groups">
                {GROUPS.map((g) => {
                  const pages = PAGES.filter((p) => p.group === g)
                  return (
                    <div className={`cat-card cat-group${g === '部品' ? ' wide' : ''}`} key={g}>
                      <div className="cat-group-h">
                        <span className="cat-group-t" role="heading" aria-level={3}>{g}</span>
                        <span className="cat-group-n num">{pages.length}ページ</span>
                      </div>
                      <div className="cat-tiles">
                        {pages.map((p) => <EntityRow key={p.key} onClick={() => onOpen(p.key)} lead={<IconBox>{p.icon}</IconBox>} title={p.label} sub={p.specs.length ? `${p.specs.length}項目` : '画面の型'} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  )
}
