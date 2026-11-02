import { defineConfig } from '@playwright/test'
import net from 'node:net'

/** OS が選んだ空きポートを返す */
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo
      probe.close(() => resolve(port))
    })
  })

// 別の worktree の監査と同時に走れるよう、空きポートを使う。設定は工程ごとに読み直されるので、環境変数で同じポートを引き継ぐ
process.env.IGNITE_AUDIT_PORT ??= String(await freePort())
const port = process.env.IGNITE_AUDIT_PORT
const baseURL = `http://127.0.0.1:${port}`

// カタログを Ignite 自身の監査にかける（採用アプリと同じ監査）。同じポートの別のアプリを測らないよう、既存のサーバーは使わない
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['**/*.audit.ts', '**/*.e2e.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list']],
  outputDir: 'test-results-audit/artifacts',
  use: { baseURL, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  webServer: { command: `npx vite --config vite.config.ts --host 127.0.0.1 --port ${port}`, cwd: import.meta.dirname, url: baseURL, reuseExistingServer: false },
})
