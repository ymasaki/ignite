// listen の成功を親へ通知する。HTTP応答で他者のサーバーを準備完了と誤認しない。
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
const server = await createServer({
  configFile: fileURLToPath(new URL('../catalog/vite.config.ts', import.meta.url)),
  server: { host: '127.0.0.1', port: 5198, strictPort: true },
})
await server.listen()
process.send({ ready: true })
