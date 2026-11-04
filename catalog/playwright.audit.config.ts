import { defineConfig } from '@playwright/test'
if (process.env.IGNITE_AUDIT_MANAGED !== '1' || !process.env.IGNITE_AUDIT_PORT) throw new Error('npm run audit:design を使用してください（共通ロックと監査サーバーが必要です）')

// カタログを Ignite 自身の監査にかける（採用アプリと同じ監査）。audit:design が空きポートで立てた専用サーバーだけを測る
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['**/*.audit.ts', '**/*.e2e.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list']],
  outputDir: 'test-results-audit/artifacts',
  use: { baseURL: `http://127.0.0.1:${process.env.IGNITE_AUDIT_PORT}`, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
})
