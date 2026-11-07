import { test as base } from '@playwright/test'
import { setCatalogTime } from './clock'
import { prepareOfflinePage } from '../../audit/network'

export { expect } from '@playwright/test'
// 部品の操作確認も画面監査と同じ外部通信の条件で実行する。
export const test = base.extend({
  page: async ({ page }, use) => {
    await setCatalogTime(page)
    await prepareOfflinePage(page)
    await use(page)
  },
})
