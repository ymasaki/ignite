// ビルド済みカタログを、ビルドツールのネイティブ依存を読まずに配信する。
import http from 'node:http'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = await realpath(fileURLToPath(new URL('../catalog-dist/', import.meta.url)))
const port = Number(process.argv[2] ?? process.env.PORT ?? 5199)
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('ポート番号が不正です')
const host = process.env.HOST ?? '127.0.0.1'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const inside = file => file.startsWith(root + path.sep)
const server = http.createServer(async (req, res) => {
  const reply = status => { res.writeHead(status); res.end() }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return reply(405)
  }
  try {
    const pathname = decodeURIComponent(req.url.split('?')[0])
    if (!pathname.startsWith('/') || pathname.includes('\0')) return reply(400)
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!inside(file)) return reply(403)
    const resolved = await realpath(file)
    if (!inside(resolved)) return reply(403)
    if (!(await stat(resolved)).isFile()) return reply(404)
    const body = await readFile(resolved)
    res.writeHead(200, {
      'Content-Type': types[path.extname(resolved)] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch (error) {
    reply(error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500)
  }
})
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
server.listen(port, host, () => console.log(`カタログ: http://${host}:${server.address().port}/`))
