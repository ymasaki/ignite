import { execFileSync } from 'node:child_process'
import { defineConfig } from '@playwright/test'

// Ignite の監査だけを実行する設定（npm run ignite:audit）。
// ほかの監査や開発サーバーとぶつからないよう、毎回空いているポートを選んで専用の一時サーバーを立てる。
// worker も設定を読み直すので、最初に選んだ番号を環境変数に残して同じ番号を使う。
// 同じポートの別のアプリを測らないよう、既存のサーバーは使わず、選んだポートが塞がれていれば失敗させる。
const port = (process.env.IGNITE_AUDIT_PORT ||= execFileSync(process.execPath, ['-e',
  "const s=require('node:net').createServer().listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close()})",
]).toString().trim())
const url = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.audit.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list']],
  outputDir: 'test-results-audit/artifacts',
  use: { baseURL: url, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  webServer: { command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`, url, reuseExistingServer: false },
})
