import { defineIgniteAudit } from '@ymasaki/ignite/audit'
import { measureSampleState } from './extensions'

defineIgniteAudit({
  screens: [
    { name: 'ホーム', path: '/', layout: { replace: [], measure: measureSampleState } },
    { name: '設定', path: '/?nav=settings' },
  ],
})
