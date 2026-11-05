import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const root = path.resolve(import.meta.dirname, '..')

// カタログは配布物ではなくソースを直接読む（部品を直したらすぐ見える）
// GitHub Pages ではサイトが /ignite/ の下に置かれる。手元の配信は既定の / のまま
export default defineConfig({
  root: import.meta.dirname,
  base: process.env.CATALOG_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@ymasaki/ignite/styles.css', replacement: path.join(root, 'src/styles/index.css') },
      { find: '@ymasaki/ignite', replacement: path.join(root, 'src/index.ts') },
    ],
  },
  build: { outDir: '../catalog-dist', emptyOutDir: true },
  server: { port: 5199, strictPort: true },
  preview: { host: '127.0.0.1', port: 5199, strictPort: true },
})
