import { defineConfig } from '@playwright/test'

// カタログを Ignite 自身の監査にかける（採用アプリと同じ監査）。同じポートの別のアプリを測らないよう、既存のサーバーは使わない
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.audit.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list']],
  outputDir: 'test-results-audit/artifacts',
  use: { baseURL: 'http://127.0.0.1:5198', locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  webServer: { command: 'npx vite --config vite.config.ts --host 127.0.0.1 --port 5198', cwd: import.meta.dirname, url: 'http://127.0.0.1:5198', reuseExistingServer: false },
})
