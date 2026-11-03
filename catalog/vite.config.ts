import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const root = path.resolve(import.meta.dirname, '..')

// カタログは配布物ではなくソースを直接読む（部品を直したらすぐ見える）
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@ymasaki/ignite/styles.css', replacement: path.join(root, 'src/styles/index.css') },
      { find: '@ymasaki/ignite', replacement: path.join(root, 'src/index.ts') },
    ],
  },
  server: { port: 5199, strictPort: true, allowedHosts: [process.env.WEBDOCK_NAME ? `${process.env.WEBDOCK_NAME}.localhost` : 'ignite-catalog.localhost'] },
})
