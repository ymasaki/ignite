// listen の成功と実際のポートを親へ通知する。HTTP応答で他者のサーバーを準備完了と誤認しない。
// ポートは固定せず、OSが選んだ空きポートを使う（他の監査・開発サーバーとぶつからない）。
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
const server = await createServer({
  configFile: fileURLToPath(new URL('../catalog/vite.config.ts', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, strictPort: true },
})
await server.listen()
process.send({ ready: true, port: server.httpServer.address().port })
