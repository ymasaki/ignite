import { IconAdjustments, IconBell, IconChartBar, IconForms, IconLayoutGrid, IconList, IconLogin2, IconPalette } from '@tabler/icons-react'
import { AppShell, Brand, SettingsButton, SideNav, useShell } from '@ymasaki/ignite'
import { useEffect, useState, type ReactNode } from 'react'
import { ControlsPage, DisplayPage, FeedbackPage, FormsPage, FoundationsPage } from './Parts'
import { DashboardPage, DetailPanel, ListPage, LoginPage, SettingsPage } from './Screens'

type Nav = 'foundations' | 'controls' | 'forms' | 'feedback' | 'display' | 'list' | 'dashboard' | 'login'
type Route = Nav | 'settings'

// Ignite のロゴ（docs/logo/ignite-mark.svg と同じ形）。`.brand-mark` が `--pri` で塗るのでスキンに従う
const LOGO = (
  <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <path fill="currentColor" d="M31.69 4C29.58 7.22 28.58 11.67 29.47 16.11C30.25 21.11 34.58 24.72 38.47 26.22C41.25 27.33 44.03 28.89 45.81 31.56C46.92 26.11 46.25 20 44.14 15.33C49.58 21.67 52.47 28.33 52.36 35.56C52.25 42.78 49.03 47.22 44.03 52.78C43.92 47.22 42.64 38.33 37.47 33.61C39.25 37.22 39.58 43.89 38.47 48.89C37.64 52.22 35.14 55.56 32.08 59.33C26.81 60.44 22.36 60 18.47 57.78C14.03 55 11.53 49.44 11.58 43.89C11.69 36.67 14.03 31.11 17.47 24.72C16.58 31.67 16.25 40 18.47 45C20.42 49.17 24.86 51.67 29.03 51.28C30.03 47.22 30.03 42.78 28.58 37.78C27.08 33.33 23.47 28.33 23.36 21.67C23.36 15 26.81 9.44 31.69 4Z" />
  </svg>
)

const NAV: { key: Nav; label: string; icon: ReactNode }[] = [
  { key: 'foundations', label: '基礎', icon: <IconPalette size={18} stroke={1.8} /> },
  { key: 'controls', label: '操作の部品', icon: <IconAdjustments size={18} stroke={1.8} /> },
  { key: 'forms', label: 'フォームの部品', icon: <IconForms size={18} stroke={1.8} /> },
  { key: 'feedback', label: '知らせと確認', icon: <IconBell size={18} stroke={1.8} /> },
  { key: 'display', label: '表示の部品', icon: <IconLayoutGrid size={18} stroke={1.8} /> },
  { key: 'list', label: '一覧の型', icon: <IconList size={18} stroke={1.8} /> },
  { key: 'dashboard', label: 'ダッシュボードの型', icon: <IconChartBar size={18} stroke={1.8} /> },
  { key: 'login', label: 'ログインの型', icon: <IconLogin2 size={18} stroke={1.8} /> },
]
const TITLES: Record<Route, string> = { foundations: '基礎', controls: '操作の部品', forms: 'フォームの部品', feedback: '知らせと確認', display: '表示の部品', list: '一覧の型', dashboard: 'ダッシュボードの型', login: 'ログインの型', settings: '設定' }

const read = () => {
  const p = new URLSearchParams(location.search)
  const nav = p.get('nav') as Route | null
  return { nav: nav && nav in TITLES ? nav : ('foundations' as Route), open: p.get('open') }
}

/** URL を状態の正本にする（監査が URL で画面を開く） */
function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  const go = (next: { nav?: Route; open?: string | null }) => {
    const p = new URLSearchParams(location.search)
    if (next.nav) p.set('nav', next.nav)
    if (next.open) p.set('open', next.open)
    else p.delete('open')
    history.pushState(null, '', `?${p}`)
    setRoute(read())
  }
  return { ...route, go }
}

/** 詳細の中から主役を変える操作の例（狭い幅では詳細を畳んで結果を見せる） */
function PanelContent({ id, onClose, go }: { id: string; onClose: () => void; go: (nav: Route) => void }) {
  const { revealMain } = useShell()
  return <DetailPanel id={id} onClose={onClose} onShowDashboard={() => { go('dashboard'); revealMain() }} />
}

export function App() {
  const { nav, open, go } = useRoute()
  const [collapsed, setCollapsed] = useState(false)
  const close = () => go({ open: null })
  // ログインはアプリの枠の外に置く画面なので、カタログでも枠を出さない
  if (nav === 'login') return <LoginPage mark={LOGO} onBack={() => go({ nav: 'foundations', open: null })} />
  return (
    <AppShell
      side={(closeSide, state) => (
        <>
          <Brand mark={LOGO} name="Ignite" small="デザインシステム" onClick={() => go({ nav: 'foundations', open: null })} />
          <SideNav items={NAV} current={nav === 'settings' ? null : nav} collapsed={state.collapsed} onSelect={(key) => { go({ nav: key, open: null }); closeSide() }} />
        </>
      )}
      foot={<SettingsButton current={nav === 'settings'} onClick={() => go({ nav: 'settings', open: null })} />}
      collapse={{ collapsed, onChange: setCollapsed }}
      title={TITLES[nav]}
      aux={nav === 'dashboard' ? <DashboardPage.Band /> : undefined}
      panel={{ open: !!open, onClose: close, id: open ?? undefined, peek: { title: 'プロジェクトの詳細' }, content: open ? <PanelContent id={open} onClose={close} go={(n) => go({ nav: n })} /> : null }}
    >
      {nav === 'foundations' && <FoundationsPage />}
      {nav === 'controls' && <ControlsPage />}
      {nav === 'forms' && <FormsPage />}
      {nav === 'feedback' && <FeedbackPage />}
      {nav === 'display' && <DisplayPage />}
      {nav === 'list' && <ListPage selected={open} onOpen={(id) => go({ open: id })} />}
      {nav === 'dashboard' && <DashboardPage />}
      {nav === 'settings' && <SettingsPage />}
    </AppShell>
  )
}
