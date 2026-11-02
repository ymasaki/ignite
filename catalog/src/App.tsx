import { IconPalette } from '@tabler/icons-react'
import { AppShell, Brand, Combobox, currentTheme, IconButton, Popover, Segmented, setTheme, SettingsButton, SideNav, useShell, type Mode, type Skin } from '@ymasaki/ignite'
import { useEffect, useState } from 'react'
import { ChartsPage } from './Charts'
import { CodePage } from './Code'
import { ActionsPage, NavigatePage } from './Controls'
import { DataPage, MarksPage } from './Display'
import { FeedbackPage } from './Feedback'
import { FormsPage } from './Forms'
import { ColorPage, MotionPage, ShapePage, TypePage } from './Foundations'
import { pageOf, PAGES } from './nav'
import { OverviewPage } from './Overview'
import { DashboardPage, DetailPanel, ListPage, LoginPage, SettingsPage } from './Screens'

// Ignite のロゴ（docs/logo/ignite-mark.svg と同じ形）。`.brand-mark` が `--pri` で塗るのでスキンに従う
const LOGO = (
  <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <path fill="currentColor" d="M31.69 4C29.58 7.22 28.58 11.67 29.47 16.11C30.25 21.11 34.58 24.72 38.47 26.22C41.25 27.33 44.03 28.89 45.81 31.56C46.92 26.11 46.25 20 44.14 15.33C49.58 21.67 52.47 28.33 52.36 35.56C52.25 42.78 49.03 47.22 44.03 52.78C43.92 47.22 42.64 38.33 37.47 33.61C39.25 37.22 39.58 43.89 38.47 48.89C37.64 52.22 35.14 55.56 32.08 59.33C26.81 60.44 22.36 60 18.47 57.78C14.03 55 11.53 49.44 11.58 43.89C11.69 36.67 14.03 31.11 17.47 24.72C16.58 31.67 16.25 40 18.47 45C20.42 49.17 24.86 51.67 29.03 51.28C30.03 47.22 30.03 42.78 28.58 37.78C27.08 33.33 23.47 28.33 23.36 21.67C23.36 15 26.81 9.44 31.69 4Z" />
  </svg>
)

const NAV = PAGES.map(({ key, label, icon, group }) => ({ key, label, icon, group }))
// 検索の候補。部品の名前と標本の見出しのどちらでも絞れるよう、両方を名前に入れる
const FIND = PAGES.flatMap((p) => p.specs.flatMap((s) => (s.parts?.length ? s.parts : [s.title]).map((name) => ({ value: `${p.key}/${s.id}/${name}`, label: name === s.title ? name : `${name} ${s.title}`, meta: p.label }))))
const PAGE_VIEWS = { color: ColorPage, type: TypePage, shape: ShapePage, motion: MotionPage, actions: ActionsPage, navigate: NavigatePage, forms: FormsPage, feedback: FeedbackPage, marks: MarksPage, data: DataPage, code: CodePage, charts: ChartsPage }

const read = () => {
  const p = new URLSearchParams(location.search)
  const nav = p.get('nav') ?? ''
  return { nav: pageOf(nav) || nav === 'settings' ? nav : 'overview', open: p.get('open'), spec: p.get('spec') }
}

/** URL を状態の正本にする（監査が URL で画面を開く） */
function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  const go = (next: { nav?: string; open?: string | null; spec?: string | null }) => {
    const p = new URLSearchParams(location.search)
    if (next.nav) p.set('nav', next.nav)
    if (next.open) p.set('open', next.open)
    else p.delete('open')
    if (next.spec) p.set('spec', next.spec)
    else p.delete('spec')
    history.pushState(null, '', `?${p}`)
    setRoute(read())
  }
  return { ...route, go }
}

/** 詳細の中から主役を変える操作の例（狭い幅では詳細を畳んで結果を見せる） */
function PanelContent({ id, onClose, go }: { id: string; onClose: () => void; go: (nav: string) => void }) {
  const { revealMain } = useShell()
  return <DetailPanel id={id} onClose={onClose} onShowDashboard={() => { go('dashboard'); revealMain() }} />
}

/** テーマをその場で試す。画面を移らずに、見ている部品の色が変わる */
function ThemePicker() {
  const [theme, set] = useState(currentTheme)
  const change = (next: Partial<typeof theme>) => { const t = { ...theme, ...next }; setTheme(t); set(t) }
  return (
    <Popover trigger={(open, toggle) => <IconButton size="lg" label="テーマを変える" tip="テーマ" aria-expanded={open} onClick={toggle}><IconPalette size={18} stroke={1.8} /></IconButton>}>
      <div className="cat-theme">
        <Segmented fill label="テーマカラー" value={theme.skin} onChange={(skin: Skin) => change({ skin })} options={[{ value: 'red', label: '赤' }, { value: 'blue', label: '青' }, { value: 'green', label: '緑' }]} />
        <Segmented fill label="表示モード" value={theme.mode} onChange={(mode: Mode) => change({ mode })} options={[{ value: 'light', label: 'ライト' }, { value: 'dark', label: 'ダーク' }, { value: 'auto', label: '自動' }]} />
      </div>
    </Popover>
  )
}

export function App() {
  const { nav, open, spec, go } = useRoute()
  const [collapsed, setCollapsed] = useState(false)
  const close = () => go({ open: null })
  const View = PAGE_VIEWS[nav as keyof typeof PAGE_VIEWS]
  // ログインはアプリの枠の外に置く画面なので、カタログでも枠を出さない
  if (nav === 'login') return <LoginPage mark={LOGO} onBack={() => go({ nav: 'overview' })} />
  return (
    <AppShell
      side={(closeSide, state) => (
        <>
          <Brand mark={LOGO} name="Ignite" small="デザインシステム" onClick={() => go({ nav: 'overview' })} />
          <SideNav items={NAV} current={nav === 'settings' ? null : nav} collapsed={state.collapsed} onSelect={(key) => { go({ nav: key }); closeSide() }} />
        </>
      )}
      foot={<SettingsButton current={nav === 'settings'} onClick={() => go({ nav: 'settings' })} />}
      collapse={{ collapsed, onChange: setCollapsed }}
      title={nav === 'settings' ? '設定' : pageOf(nav)?.label}
      search={<div className="cat-search"><Combobox label="部品を探す" placeholder="部品を探す" value={null} onChange={(v) => { if (v) { const [n, s] = v.split('/'); go({ nav: n, spec: s }) } }} options={FIND} /></div>}
      actions={<ThemePicker />}
      aux={nav === 'dashboard' ? <DashboardPage.Band /> : undefined}
      panel={{ open: !!open, onClose: close, id: open ?? undefined, peek: { title: 'プロジェクトの詳細' }, content: open ? <PanelContent id={open} onClose={close} go={(n) => go({ nav: n })} /> : null }}
    >
      {nav === 'overview' && <OverviewPage onOpen={(key) => go({ nav: key })} />}
      {View && <View key={nav} target={spec} />}
      {nav === 'list' && <ListPage selected={open} onOpen={(id) => go({ open: id })} />}
      {nav === 'dashboard' && <DashboardPage />}
      {nav === 'settings' && <SettingsPage />}
    </AppShell>
  )
}
