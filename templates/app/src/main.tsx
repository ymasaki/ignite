import '@ymasaki/ignite/styles.css'
import './styles/app.css'
import { startAssist, startTheme } from '@ymasaki/ignite'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

void startTheme(Object.fromEntries(new URLSearchParams(location.search)))
startAssist()
createRoot(document.getElementById('root')!).render(<App />)
