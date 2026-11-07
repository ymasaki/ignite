import type { Page } from '@playwright/test'

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

/** 外部の取得結果に左右されず、端末の書体と固定の画像で監査する。 */
export async function prepareOfflinePage(page: Page): Promise<void> {
  await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }))
}
