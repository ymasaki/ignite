import { IconHome } from '@tabler/icons-react'
import { AppShell, Avatar, Board, Brand, EntityRow, ListScreen, SearchField, SettingsButton, SettingsScreen, SideNav, ThemeSettings, AssistSettings } from '@ymasaki/ignite'
import { useState } from 'react'

const NAV = [{ key: 'home' as const, label: 'ホーム', icon: <IconHome size={18} stroke={1.8} /> }]
const ROWS = [{ id: '1', name: '最初の項目', initial: '最' }]

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
        </>
      )}
      foot={<SettingsButton current={nav === 'settings'} onClick={() => setNav('settings')} />}
      title={nav === 'home' ? 'ホーム' : '設定'}
    >
      {nav === 'home' ? (
        <Board>
          <ListScreen layout="tiles" count={`${rows.length}件`} tools={<SearchField label="項目を探す" placeholder="名前" value={q} onChange={setQ} />}>
            {rows.map((r) => <EntityRow key={r.id} lead={<Avatar initial={r.initial} />} title={r.name} />)}
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
