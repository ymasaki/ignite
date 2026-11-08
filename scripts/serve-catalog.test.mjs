// 依存を置かない一時コピーで、ショートカットの配信契約を確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, copyFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import http from 'node:http'

const request = (port, pathname, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: pathname, method }, res => {
    const chunks = []
    res.on('data', chunk => chunks.push(chunk))
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }))
  })
  req.on('error', reject)
  req.end()
})

test('ネイティブ依存なしで配信し、境界・競合・停止を守る', { timeout: 15000 }, async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'ignite-serve-'))
  let child
  const exited = new Map()
  const start = (port, env = {}) => {
    const serverProcess = spawn('bash', ['scripts/start-catalog.sh', ...(port === undefined ? [] : [String(port)])], { cwd: work, env: { ...process.env, ...env } })
    exited.set(serverProcess, once(serverProcess, 'exit'))
    return serverProcess
  }
  try {
    await mkdir(path.join(work, 'scripts'))
    await mkdir(path.join(work, 'catalog-dist/assets'), { recursive: true })
    for (const file of ['start-catalog.sh', 'serve-catalog.mjs']) await copyFile(new URL(file, import.meta.url), path.join(work, 'scripts', file))
    await writeFile(path.join(work, 'catalog-dist/index.html'), '<title>Ignite</title>')
    await writeFile(path.join(work, 'catalog-dist/assets/app.js'), 'export {}')
    await writeFile(path.join(work, 'catalog-dist/assets/app.css'), 'body{}')
    await writeFile(path.join(work, 'catalog-dist/favicon.svg'), '<svg/>')
    await writeFile(path.join(work, 'secret'), '秘密')
    await symlink(path.join(work, 'secret'), path.join(work, 'catalog-dist/link'))
    child = start(undefined, { PORT: '0', HOST: '127.0.0.1' })
    const port = await new Promise((resolve, reject) => {
      let output = ''
      let errors = ''
      child.stderr.on('data', chunk => { errors += chunk })
      child.stdout.on('data', chunk => {
        output += chunk
        const match = output.match(/127\.0\.0\.1:(\d+)/)
        if (match) resolve(Number(match[1]))
      })
      child.once('error', reject)
      child.once('exit', code => reject(new Error(`起動失敗: ${code}: ${errors}`)))
    })
    const index = await request(port, '/?skin=blue')
    assert.equal(index.status, 200)
    assert.equal(index.body, '<title>Ignite</title>')
    assert.match(index.headers['content-type'], /text\/html/)
    assert.equal(index.headers['cache-control'], 'no-store')
    for (const [url, type] of [['/assets/app.js', 'text/javascript'], ['/assets/app.css', 'text/css'], ['/favicon.svg', 'image/svg+xml']]) {
      const response = await request(port, url)
      assert.equal(response.status, 200)
      assert.ok(response.headers['content-type'].startsWith(type))
    }
    const head = await request(port, '/', 'HEAD')
    assert.equal(head.status, 200)
    assert.equal(head.body, '')
    assert.equal(head.headers['content-length'], index.headers['content-length'])
    for (const [url, status] of [['/missing', 404], ['/assets/', 404], ['/%ZZ', 400], ['/%00', 400], ['/../secret', 403], ['/%2e%2e/secret', 403], ['/link', 403]]) assert.equal((await request(port, url)).status, status, url)
    assert.equal((await request(port, '/', 'POST')).status, 405)
    // 明示引数がPORTより優先し、使用中ポートから自動で逃げない。
    const conflict = start(port, { PORT: '0', HOST: '127.0.0.1' })
    assert.equal((await exited.get(conflict))[0], 1)
    const invalid = start(undefined, { PORT: 'not-a-port', HOST: '127.0.0.1' })
    assert.equal((await exited.get(invalid))[0], 1)
    child.kill('SIGTERM')
    await exited.get(child)
    await assert.rejects(request(port, '/'), { code: 'ECONNREFUSED' })
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exited.get(child) }
    await rm(work, { recursive: true, force: true })
  }
})
