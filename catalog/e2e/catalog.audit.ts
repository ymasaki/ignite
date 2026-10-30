import path from 'node:path'
import { defineIgniteAudit } from '../../audit/index'


defineIgniteAudit({
  outDir: path.join(import.meta.dirname, '../test-results-audit'),
  screens: [
    { name: '基礎', path: '/?nav=foundations' },
    { name: '操作の部品', path: '/?nav=controls' },
    { name: 'フォームの部品', path: '/?nav=forms' },
    { name: 'フォームの部品（エラー）', path: '/?nav=forms', act: (page) => page.getByRole('button', { name: '保存する' }).click() },
    { name: '知らせと確認', path: '/?nav=feedback' },
    { name: '窓', path: '/?nav=feedback', act: (page) => page.getByRole('button', { name: '窓を開く' }).click() },
    { name: '削除の確認', path: '/?nav=feedback&mode=dark', act: (page) => page.getByRole('button', { name: '削除する' }).click() },
    { name: '知らせ', path: '/?nav=feedback', act: async (page) => { await page.getByRole('button', { name: '完了を知らせる' }).click(); await page.getByRole('button', { name: '失敗を知らせる' }).click() } },
    { name: 'カレンダー', path: '/?nav=forms', act: (page) => page.getByRole('button', { name: /^期限/ }).click() },
    { name: '候補の一覧', path: '/?nav=forms&skin=blue', act: (page) => page.getByRole('combobox', { name: '拠点' }).click() },
    { name: '操作の一覧', path: '/?nav=controls', act: (page) => page.getByRole('button', { name: '操作', exact: true }).click() },
    { name: '表示の部品', path: '/?nav=display' },
    { name: '一覧の型', path: '/?nav=list' },
    { name: '一覧の型（詳細）', path: '/?nav=list&open=p1' },
    { name: 'ダッシュボードの型', path: '/?nav=dashboard' },
    { name: '設定の型', path: '/?nav=settings' },
    { name: '一覧の型（ダーク）', path: '/?nav=list&mode=dark' },
    { name: 'ダッシュボードの型（ブルー）', path: '/?nav=dashboard&skin=blue' },
    { name: '操作の部品（グリーン）', path: '/?nav=controls&skin=green' },
    { name: '一覧の型（文字 特大）', path: '/?nav=list', assist: { text: 'larger' } },
    { name: '設定の型（コントラスト 強く）', path: '/?nav=settings&mode=dark', assist: { contrast: 'more', underline: true, focus: true } },
  ],
  states: [{ name: '一覧: 状態を切り替える', path: '/?nav=list', before: '.lscreen-bar', act: (page) => page.getByRole('group', { name: '状態で絞り込む' }).getByRole('button', { name: '完了' }).click(), after: '.lscreen-bar' }],
  reveals: [{ name: 'プロジェクトの詳細', path: '/?nav=list&open=p1' }],
  hoverScreens: [{ name: 'プルダウンの一覧', path: '/?nav=controls', act: async (page) => { await page.getByRole('button', { name: /^並び順/ }).click(); await page.waitForTimeout(300) } }],
})
