// Ignite の監査。画面を足したら screens にも足す（docs/adopting.md）
import { defineIgniteAudit } from '@ymasaki/ignite/audit'

defineIgniteAudit({
  screens: [
    { name: 'ホーム', path: '/' },
    { name: '設定', path: '/?nav=settings' },
  ],
})
