import { defineConfig } from '@playwright/test'

// Ignite の監査だけを実行する設定（npm run ignite:audit）。
// 同じポートの別のアプリを測らないよう、既存のサーバーを使わず、ポートが塞がっていれば失敗させる
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.audit.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list']],
  outputDir: 'test-results-audit/artifacts',
  use: { baseURL: 'http://127.0.0.1:5317', locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  webServer: { command: 'npx vite --host 127.0.0.1 --port 5317 --strictPort', url: 'http://127.0.0.1:5317', reuseExistingServer: false },
})
