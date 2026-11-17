// カタログの表示の速さとメモリを、ウィンドウを開かない Chromium で測る。
// 使い方: node scripts/perf/catalog.mjs [--dist <ビルド済みカタログ>] [--runs 3] [--pages a,b] [--out 結果.json]
// --dist を省くと、この作業ツリーのカタログを一時ディレクトリへビルドして測る。
// 同じ端末・同じ引数で前後を測って比べる（時間は端末と負荷で変わるので、合否には使わない。回数・要素数は負荷に左右されにくい）。
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { build } from 'vite'

const PAGES = ['overview', 'setup', 'color', 'type', 'shape', 'motion', 'actions', 'forms', 'navigate', 'marks', 'data', 'feedback', 'charts', 'code', 'list', 'header', 'dashboard', 'login', 'responsive', 'settings']
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' }
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const WIDTHS = [1180, 900, 700, 420, 900, 1440]
const CPU_RATE = 4

function args() {
  const out = { runs: 3, pages: PAGES }
  const list = process.argv.slice(2)
  for (let i = 0; i < list.length; i += 2) {
    const [key, value] = [list[i], list[i + 1]]
    if (key === '--dist') out.dist = path.resolve(value)
    else if (key === '--runs') out.runs = Number(value)
    else if (key === '--pages') out.pages = value.split(',')
    else if (key === '--out') out.out = path.resolve(value)
    else throw new Error(`不明な引数: ${key}`)
  }
  return out
}

/** ビルド済みカタログだけを配る（ほかのパスは index.html） */
async function serve(dist) {
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const file = path.join(dist, path.normalize(name))
    const target = file.startsWith(dist) && path.extname(file) ? file : path.join(dist, 'index.html')
    try {
      const body = await readFile(target)
      res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) }
}

async function assetSizes(dist) {
  const dir = path.join(dist, 'assets')
  const sizes = { js: 0, jsGzip: 0, css: 0, cssGzip: 0 }
  for (const name of await readdir(dir)) {
    const kind = name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : null
    if (!kind) continue
    const body = await readFile(path.join(dir, name))
    sizes[kind] += (await stat(path.join(dir, name))).size
    sizes[`${kind}Gzip`] += gzipSync(body).length
  }
  return sizes
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

async function open(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', reducedMotion: 'no-preference' })
  const page = await context.newPage()
  await page.route((u) => u.hostname !== '127.0.0.1', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }))
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE })
  const read = async (gc = false) => {
    if (gc) for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage')
    const { metrics } = await cdp.send('Performance.getMetrics')
    return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
  }
  await page.goto(url, { waitUntil: 'load' })
  return { context, page, read }
}

const cost = (a, b) => ({
  scriptMs: (b.ScriptDuration - a.ScriptDuration) * 1000,
  layoutMs: (b.LayoutDuration - a.LayoutDuration) * 1000,
  styleMs: (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000,
  taskMs: (b.TaskDuration - a.TaskDuration) * 1000,
  layouts: b.LayoutCount - a.LayoutCount,
  styles: b.RecalcStyleCount - a.RecalcStyleCount,
})

/** 1 ページを開いて、初回の描画・何もしない間・幅の変更・色の切り替えの負荷と、保持するメモリを測る */
async function measurePage(browser, base, nav) {
  const { context, page, read } = await open(browser, `${base}/?nav=${nav}`)
  await wait(1500)
  const loaded = await read()
  const zero = Object.fromEntries(Object.keys(loaded).map((k) => [k, 0]))
  const result = { load: cost(zero, loaded) }
  await wait(2000)
  const idle = await read()
  result.idle = cost(loaded, idle)
  const kept = await read(true)
  result.heapMB = kept.JSHeapUsedSize / 1048576
  result.nodes = kept.Nodes
  result.listeners = kept.JSEventListeners
  result.domNodes = await page.evaluate(() => document.querySelectorAll('*').length)
  const beforeResize = await read()
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await wait(250)
  }
  result.resize = cost(beforeResize, await read())
  const beforeTheme = await read()
  for (const mode of ['dark', 'light', 'dark', 'light']) {
    await page.evaluate((m) => { document.documentElement.dataset.mode = m }, mode)
    await wait(250)
  }
  result.theme = cost(beforeTheme, await read())
  await context.close()
  return result
}

/** 画面の移動をくり返して、残り続けるメモリ・要素・リスナーの増え方を測る */
async function measureCycles(browser, base, pages) {
  const { context, page, read } = await open(browser, `${base}/?nav=overview`)
  const cycle = async () => {
    for (const nav of [...pages, 'overview']) {
      await page.evaluate((n) => { history.pushState(null, '', `?nav=${n}`); dispatchEvent(new PopStateEvent('popstate')) }, nav)
      await wait(120)
    }
    await wait(1200)
  }
  await cycle()
  const first = await read(true)
  const start = await read()
  const rounds = 4
  for (let i = 0; i < rounds; i++) await cycle()
  const moved = cost(start, await read())
  const last = await read(true)
  await context.close()
  return {
    heapMB: last.JSHeapUsedSize / 1048576,
    heapGrowthKBPerRound: (last.JSHeapUsedSize - first.JSHeapUsedSize) / 1024 / rounds,
    nodesGrowthPerRound: (last.Nodes - first.Nodes) / rounds,
    listenersGrowthPerRound: (last.JSEventListeners - first.JSEventListeners) / rounds,
    navigate: Object.fromEntries(Object.entries(moved).map(([k, v]) => [k, v / rounds])),
  }
}

function fold(samples) {
  const out = {}
  for (const key of Object.keys(samples[0])) {
    const values = samples.map((s) => s[key])
    out[key] = typeof values[0] === 'object' ? fold(values) : median(values)
  }
  return out
}

const { dist: given, runs, pages, out } = args()
const built = given ? null : await mkdtemp(path.join(tmpdir(), 'ignite-perf-catalog-'))
if (built) await build({ root: path.resolve(import.meta.dirname, '../../catalog'), logLevel: 'error', build: { outDir: built, emptyOutDir: true } })
const dist = given ?? built
const server = await serve(dist)
const browser = await chromium.launch({ headless: true })
const report = { cpuRate: CPU_RATE, runs, assets: await assetSizes(dist), pages: {} }
try {
  for (const nav of pages) {
    const samples = []
    for (let i = 0; i < runs; i++) samples.push(await measurePage(browser, server.url, nav))
    report.pages[nav] = fold(samples)
    const p = report.pages[nav]
    console.log(`${nav.padEnd(11)} 初回 task ${p.load.taskMs.toFixed(0).padStart(5)}ms (script ${p.load.scriptMs.toFixed(0)} / layout ${p.load.layoutMs.toFixed(0)} / style ${p.load.styleMs.toFixed(0)})  待機 task ${p.idle.taskMs.toFixed(0).padStart(4)}ms layout ${p.idle.layouts} style ${p.idle.styles}  幅 ${p.resize.taskMs.toFixed(0).padStart(5)}ms  色 ${p.theme.taskMs.toFixed(0).padStart(4)}ms  heap ${p.heapMB.toFixed(2)}MB  要素 ${p.domNodes}  listener ${p.listeners}`)
  }
  const cycles = []
  for (let i = 0; i < runs; i++) cycles.push(await measureCycles(browser, server.url, pages))
  report.cycles = fold(cycles)
  const sum = (pick) => Object.values(report.pages).reduce((total, p) => total + pick(p), 0)
  report.total = { loadTaskMs: sum((p) => p.load.taskMs), idleTaskMs: sum((p) => p.idle.taskMs), resizeTaskMs: sum((p) => p.resize.taskMs), themeTaskMs: sum((p) => p.theme.taskMs), heapMB: sum((p) => p.heapMB), listeners: sum((p) => p.listeners) }
  console.log('合計', JSON.stringify(report.total))
  console.log('移動のくり返し', JSON.stringify(report.cycles))
  console.log('配布', JSON.stringify(report.assets))
} finally {
  await browser.close()
  await server.close()
  if (built) await rm(built, { recursive: true, force: true })
}
if (out) await writeFile(out, `${JSON.stringify(report, null, 2)}\n`)
