import type { Page } from '@playwright/test'

// 実行日で文字幅やカレンダーの並びが変わらないよう、監査の時計だけ固定する。
export const CATALOG_TIME = '2026-11-08T12:00:00+09:00'
export async function setCatalogTime(page: Page): Promise<void> {
  await page.clock.setFixedTime(CATALOG_TIME)
}
