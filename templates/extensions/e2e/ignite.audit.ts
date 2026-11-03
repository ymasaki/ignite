import { defineIgniteAudit } from '@ymasaki/ignite/audit'
import { measureSampleState } from './extensions'

defineIgniteAudit({
  // パン描画がある場合だけ指定。固定操作はcontentの外へ置く。
  panRegions: [{ viewport: '.diagram-viewport', content: '.diagram-viewport > .diagram-content' }],
  screens: [
    { name: 'ホーム', path: '/', layout: { replace: [], measure: measureSampleState } },
    { name: '設定', path: '/?nav=settings' },
  ],
})
