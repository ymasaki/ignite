import { IconAdjustments, IconBell, IconChartBar, IconForms, IconLayoutGrid, IconList, IconPalette } from '@tabler/icons-react'
import { AppShell, Brand, SettingsButton, SideNav, useShell } from '@ymasaki/ignite'
import { useEffect, useState, type ReactNode } from 'react'
import { ControlsPage, DisplayPage, FeedbackPage, FormsPage, FoundationsPage } from './Parts'
import { DashboardPage, DetailPanel, ListPage, SettingsPage } from './Screens'

type Nav = 'foundations' | 'controls' | 'forms' | 'feedback' | 'display' | 'list' | 'dashboard'
type Route = Nav | 'settings'

const NAV: { key: Nav; label: string; icon: ReactNode }[] = [
  { key: 'foundations', label: '基礎', icon: <IconPalette size={18} stroke={1.8} /> },
  { key: 'controls', label: '操作の部品', icon: <IconAdjustments size={18} stroke={1.8} /> },
  { key: 'forms', label: 'フォームの部品', icon: <IconForms size={18} stroke={1.8} /> },
  { key: 'feedback', label: '知らせと確認', icon: <IconBell size={18} stroke={1.8} /> },
  { key: 'display', label: '表示の部品', icon: <IconLayoutGrid size={18} stroke={1.8} /> },
  { key: 'list', label: '一覧の型', icon: <IconList size={18} stroke={1.8} /> },
  { key: 'dashboard', label: 'ダッシュボードの型', icon: <IconChartBar size={18} stroke={1.8} /> },
]
const TITLES: Record<Route, string> = { foundations: '基礎', controls: '操作の部品', forms: 'フォームの部品', feedback: '知らせと確認', display: '表示の部品', list: '一覧の型', dashboard: 'ダッシュボードの型', settings: '設定' }

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
  return (
    <AppShell
      side={(closeSide, state) => (
        <>
          <Brand name="Ignite" small="デザインシステム" onClick={() => go({ nav: 'foundations', open: null })} />
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
