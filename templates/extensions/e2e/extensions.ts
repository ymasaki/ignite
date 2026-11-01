import type { Page } from '@playwright/test'
import type { AuditFinding } from '@ymasaki/ignite/audit'

/** アプリ固有の状態と表示の対応だけを測る。共通の見た目の規則は Ignite に任せる */
export async function measureSampleState(page: Page): Promise<AuditFinding[]> {
  return page.locator('.appx-state').evaluateAll((nodes) => nodes.flatMap((node) => {
    const expected = node.getAttribute('data-appx-ready') === 'true' ? '準備済み' : '下書き'
    const actual = node.textContent?.trim() ?? ''
    return actual === expected ? [] : [{ rule: 'アプリの状態表示', where: '.appx-state', expected, actual }]
  }))
}
