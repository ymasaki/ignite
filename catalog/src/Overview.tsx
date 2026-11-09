import { IconArrowRight, IconBell, IconBrandGithub, IconEyeCheck, IconRocket, IconChartBar, IconHome, IconMenu2, IconSettings, IconUsers } from '@tabler/icons-react'
import { AvatarGroup, BarList, Board, Button, Checkbox, CodeBlock, ColumnChart, currentAssist, DatePicker, Delta, EntityRow, FormField, Gauge, IconBox, LinkButton, NumberField, reducedMotion, RollingNumber, Segmented, SettingGroup, SettingRow, setAssist, Stat, Switch, Tag, ThemeSettings, useScrollFocus, withFade, type Assist, type Theme } from '@ymasaki/ignite'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { version } from '../../package.json'
import { HeroLogo } from './logo'
import { PAGES, PART_COUNT } from './nav'

// カタログの入口。Ignite が何をしてくれるかを、本物の部品で見せる
const GROUPS = ['基礎', '部品', '画面の型']
const REPO = 'https://github.com/ymasaki/ignite'
const ico = (I: typeof IconBell) => <I size={18} stroke={1.8} />

/** 特徴の行。左に見出し・説明、右に本物の部品の見本（demo）。go は詳しく見るページ */
type Feature = { title: string; text: string[]; go: string; more: string; demo: ReactNode }

const TEXT_OPTIONS: { value: Assist['text']; label: string }[] = [{ value: 'normal', label: '標準' }, { value: 'large', label: '大' }, { value: 'larger', label: '特大' }]
const CONTRAST_OPTIONS: { value: Assist['contrast']; label: string }[] = [{ value: 'auto', label: '端末に合わせる' }, { value: 'more', label: '強く' }]

const STEPS = [
  { title: '取得する', code: `$ gh release download v${version} --repo github.com/ymasaki/ignite` },
  { title: '初期化する', code: '$ npx ignite init' },
  { title: '検査する', code: '$ npx ignite check\n$ npm run ignite:audit' },
]

/** LP の段の見出し。小さな印・大きな見出し・短い補足と、右端に段全体への操作（action） */
function Lead({ eyebrow, title, children, action }: { eyebrow: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="cat-lead">
      <div className="cat-lead-b">
        <span className="cat-eyebrow">{eyebrow}</span>
        <span className="cat-lead-t" role="heading" aria-level={2}>{title}</span>
        {children && <span className="cat-lead-s">{children}</span>}
      </div>
      {action}
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

type View = 'list' | 'board' | 'cal'
const VIEWS: { value: View; label: string }[] = [{ value: 'list', label: 'リスト' }, { value: 'board', label: 'ボード' }, { value: 'cal', label: 'カレンダー' }]
const TEAM = [{ key: 'k', initial: '鈴', tip: '鈴木' }, { key: 't', initial: '田', tip: '田中' }, { key: 'h', initial: '高', tip: '高橋' }, { key: 'y', initial: '山', tip: '山本' }, { key: 'i', initial: '伊', tip: '伊藤' }, { key: 'w', initial: '渡', tip: '渡辺' }].map((m, i) => ({ ...m, tone: `c${i + 1}` }))

/**
 * シンプル: 個人の設定。トグルボタン・説明付きのチェックボックス・スイッチ・日付・重ねた顔アイコンを、
 * 余白と罫線で分けて並べる。操作は主要色、顔アイコンは見分けやすいよう色分けし、入りきらない人は「+N」にまとめる
 */
function SimpleDemo() {
  const [away, setAway] = useState(false)
  const [notify, setNotify] = useState(true)
  const [view, setView] = useState<View>('board')
  const [digest, setDigest] = useState(true)
  const [share, setShare] = useState(false)
  const [date, setDate] = useState<string | null>('2026-11-20')
  return (
    <div className="cat-demo-card cat-demo-me">
      <Segmented fill label="表示" value={view} onChange={setView} options={VIEWS} />
      <div className="cat-demo-opts">
        <Checkbox label="週のまとめを受け取る" checked={digest} onChange={setDigest} />
        <Checkbox label="予定をチームに公開" checked={share} onChange={setShare} />
        <Switch label="おやすみモード" checked={away} onChange={setAway} />
        <Switch label="新しいメッセージを知らせる" checked={notify} onChange={setNotify} />
      </div>
      <div className="cat-demo-meet">
        <FormField label="次の面談"><DatePicker value={date} onChange={setDate} today="2026-11-09" /></FormField>
        <AvatarGroup stack size="md" max={4} items={TEAM} label="同じチーム" />
      </div>
    </div>
  )
}

/** テーマ: 選ぶとページ全体が切り替わる。見本はテーマの設定だけにし、効き目はページそのもので見せる */
function ThemeDemo({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
  return <ThemeSettings value={theme} onChange={onTheme} />
}

const CHARTS = [{ value: 'column', label: '縦棒' }, { value: 'bar', label: '横棒' }, { value: 'gauge', label: 'メーター' }] as const
type ChartKind = (typeof CHARTS)[number]['value']
const DAYS = ['月', '火', '水', '木', '金', '土', '日']
const TICK_MS = 2400
/** 訪問の基準値。毎回この近くへ引き戻しながら揺らすので、長く開いていても上限・下限に張り付かない */
const BASE_DAYS = [152, 188, 171, 204, 196, 232, 137]
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/**
 * 決まった間隔で fn を呼ぶ。見本が画面の外・タブが裏・動きを減らす設定のあいだは呼ばない
 * （見ていないところで数字を回さない。監査やテストの撮影中に勝手に動き続けないためでもある）
 */
function useTicker(on: boolean, ref: RefObject<HTMLElement | null>, fn: () => void) {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const el = ref.current
    if (!on || !el) return
    let seen = false
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting })
    io.observe(el)
    const t = window.setInterval(() => { if (seen && !document.hidden && !reducedMotion()) latest.current() }, TICK_MS)
    return () => (window.clearInterval(t), io.disconnect())
  }, [on, ref])
}

/** アニメーション: 数字がひとりでに転がり、グラフは切り替えると伸びる。＋−で目標を変えると残りの数字も回る */
function MotionDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [data, setData] = useState({ days: BASE_DAYS, delta: 100 })
  const [auto, setAuto] = useState(true)
  const [goal, setGoal] = useState<number | null>(1400)
  const [chart, setChart] = useState<ChartKind>('column')
  const total = sum(data.days)
  useTicker(auto, ref, () => setData(({ days }) => {
    // 動きが見てわかるよう大きめに揺らす（1 日あたり ±90 ほど。基準値へ 4 割引き戻すので、張り付かない）
    const next = days.map((v, i) => Math.min(290, Math.max(40, Math.round(v + (Math.random() - 0.5) * 180 + (BASE_DAYS[i] - v) * 0.4))))
    return { days: next, delta: sum(next) - sum(days) }
  }))
  const target = goal ?? 0
  return (
    <div className="cat-demo-card" ref={ref}>
      <div className="cat-demo-head">
        <div className="cat-demo-stat">
          <span className="cat-demo-l">今週の訪問</span>
          <span className="cat-demo-num">
            <span className="cat-demo-v num"><RollingNumber value={total} /></span>
            <Delta value={data.delta} />
          </span>
          <span className="cat-demo-l">{total < target ? '目標まで あと ' : '目標を '}<span className="num"><RollingNumber value={Math.abs(target - total)} /></span>{total < target ? '' : ' 上回った'}</span>
        </div>
        <Segmented label="グラフの種類" value={chart} onChange={setChart} options={[...CHARTS]} />
      </div>
      <div className="cat-demo-chart" key={chart}>
        {chart === 'column' && <ColumnChart unit="件" labels={DAYS} series={[{ label: '訪問', values: data.days }]} current={6} height={170} />}
        {chart === 'bar' && <BarList max={300} items={DAYS.map((d, i) => ({ label: d, value: data.days[i] }))} />}
        {chart === 'gauge' && <Gauge label="目標の達成率" value={target ? Math.round((total / target) * 100) : null} unit="%" target={100} max={120} size={190} />}
      </div>
      <div className="cat-demo-foot">
        <Switch label="自動で更新する" checked={auto} onChange={setAuto} />
        <FormField label="週の目標"><NumberField value={goal} onChange={setGoal} min={500} max={3000} step={100} unit="件" /></FormField>
      </div>
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
    { title: 'シンプルでモダン', text: ['クセがなく、ひと目で使い方がわかる。', '操作は主要色ひとつ、状態や人は色で見分ける。'], go: 'actions', more: '部品を見る', demo: <SimpleDemo /> },
    { title: 'テーマで色を着せ替え', text: ['テーマカラーを選ぶだけで、全体の色がそろって変わる。', 'ライトとダークにも標準で対応。'], go: 'color', more: '色を見る', demo: <ThemeDemo theme={theme} onTheme={onTheme} /> },
    { title: '遊び心のあるアニメーション', text: ['数字は転がり、スイッチは弾む。', '小さな動きの手ざわりで、触るのが楽しくなる。'], go: 'motion', more: '動きを見る', demo: <MotionDemo /> },
    { title: 'どんな幅にもフィット', text: ['PC からスマホまで、', '幅に合わせて UI がしなやかに組み変わる。'], go: 'responsive', more: 'レスポンシブ表示を見る', demo: <ResponsiveDemo /> },
    { title: '誰にでも見やすく', text: ['見づらさを感じる人にも届くように。', 'コントラストと文字の大きさを、このページで試せる。'], go: 'settings', more: '設定の画面を見る', demo: <AssistDemo /> },
  ]
  return (
    <Board>
      <div className="cat-wrap">
        <div className="cat" ref={ref}>
          <div className="cat-main cat-lp">
            <section className="cat-hero">
              <div className="cat-fx" aria-hidden="true"><span /><span /><span /><span /></div>
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
                  <div className="cat-feature" key={f.title}>
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
              <Lead eyebrow="はじめかた" title="取得から検査までの手順" action={<Button icon={ico(IconArrowRight)} onClick={() => onOpen('setup')}>手順をすべて見る</Button>} />
              <div className="cat-steps">
                {STEPS.map((s, i) => (
                  <div className="cat-step" key={s.title}>
                    <div className="cat-step-h">
                      <span className="cat-step-n num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="cat-pillar-t" role="heading" aria-level={3}>{s.title}</span>
                    </div>
                    <CodeBlock language="shell" label={s.title} wrap code={s.code} />
                  </div>
                ))}
              </div>
            </section>

            <section className="cat-band">
              <Lead eyebrow="カタログ" title="部品と画面の型を見る" />
              <div className="cat-groups">
                {GROUPS.map((g) => {
                  const pages = PAGES.filter((p) => p.group === g)
                  return (
                    <div className={`cat-group${g === '部品' ? ' wide' : ''}`} key={g}>
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
    </Board>
  )
}
