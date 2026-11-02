import { IconHome } from '@tabler/icons-react'
import { AppShell, Board, Brand, ListScreen, SearchField, SettingsButton, SettingsScreen, SideNav, ThemeSettings, AssistSettings } from '../ui'
import { SampleRow } from '../ui'
import { useState } from 'react'

const NAV = [{ key: 'home' as const, label: 'ホーム', icon: <IconHome size={18} stroke={1.8} /> }]
const ROWS = [{ id: '1', name: '最初の項目', initial: '最', ready: true }]

export function App() {
  const [nav, setNav] = useState(new URLSearchParams(location.search).get('nav') === 'settings' ? 'settings' : 'home')
  const [q, setQ] = useState('')
  const rows = ROWS.filter((r) => r.name.includes(q))
  return (
    <AppShell
      side={(close, state) => (
        <>
          <Brand name="アプリ" />
          <SideNav items={NAV} current={nav === 'home' ? 'home' : null} collapsed={state.collapsed} onSelect={() => { setNav('home'); close() }} />
          <SettingsButton current={nav === 'settings'} collapsed={state.collapsed} onClick={() => { setNav('settings'); close() }} />
        </>
      )}
      title={nav === 'home' ? 'ホーム' : '設定'}
    >
      {nav === 'home' ? (
        <Board>
          <ListScreen layout="tiles" count={`${rows.length}件`} tools={<SearchField label="項目を探す" placeholder="名前" value={q} onChange={setQ} />}>
            {rows.map((r) => <SampleRow key={r.id} item={r} />)}
          </ListScreen>
        </Board>
      ) : (
        <SettingsScreen>
          <ThemeSettings />
          <AssistSettings />
        </SettingsScreen>
      )}
    </AppShell>
  )
}
