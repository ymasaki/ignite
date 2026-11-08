import { defineConfig } from '@playwright/test'
import { VERDICT_TITLE } from '../audit/index'
if (process.env.IGNITE_AUDIT_MANAGED !== '1' || !process.env.IGNITE_AUDIT_PORT) throw new Error('npm run audit:design を使用してください（共通ロックと監査サーバーが必要です）')

// 判定だけを選ぶ正規表現。grep はファイル名などを前に付けた名前と照合するので、末尾のテスト名で一致させる
const verdict = new RegExp(`(?:^|\\s)${VERDICT_TITLE}$`)

// カタログを Ignite 自身の監査にかける（採用アプリと同じ監査）。audit:design が空きポートで立てた専用サーバーだけを測る。
// 測定は worker に分けて並列に動かし、判定は測定がすべて終わってから記録を集計する（docs/catalog-audit.md）
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['**/*.audit.ts', '**/*.e2e.ts'],
  workers: Number(process.env.IGNITE_AUDIT_WORKERS) || 6,
  timeout: 60000,
  reporter: [['list']],
  outputDir: 'test-results-audit/artifacts',
  use: { baseURL: `http://127.0.0.1:${process.env.IGNITE_AUDIT_PORT}`, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  projects: [
    { name: 'measure', fullyParallel: true, grepInvert: verdict },
    { name: 'verdict', testMatch: '**/*.audit.ts', grep: verdict, dependencies: ['measure'] },
  ],
})
