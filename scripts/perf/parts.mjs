// 部品を数百個並べた負荷の見本（scripts/perf/parts/）を、ウィンドウを開かない Chromium で測る。
// 使い方: node scripts/perf/parts.mjs [--cases rolling,tree] [--runs 3] [--out 結果.json] [--src 別の作業ツリー]
// 回数（レイアウト・スタイルの計算・描き直し）と要素数は負荷に左右されにくい。時間は同じ端末で前後を比べる目安にする。
import { chromium } from '@playwright/test'
import react from '@vitejs/plugin-react'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'

const here = import.meta.dirname
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

function args() {
  const out = { runs: 3, cases: null, src: path.resolve(here, '../..') }
  const list = process.argv.slice(2)
  for (let i = 0; i < list.length; i += 2) {
    const [key, value] = [list[i], list[i + 1]]
    if (key === '--runs') out.runs = Number(value)
    else if (key === '--cases') out.cases = value.split(',')
    else if (key === '--out') out.out = path.resolve(value)
    else if (key === '--src') out.src = path.resolve(value)
    else throw new Error(`不明な引数: ${key}`)
  }
  return out
}

/** 見本を、測る対象の作業ツリー（--src）の部品でビルドする。見本そのものはいつもこの作業ツリーのものを使う */
async function buildParts(src, outDir) {
  await build({
    root: path.join(here, 'parts'),
    configFile: false,
    logLevel: 'error',
    plugins: [react()],
    resolve: {
      alias: [
        { find: '@ymasaki/ignite/styles.css', replacement: path.join(src, 'src/styles/index.css') },
        { find: '@ymasaki/ignite', replacement: path.join(src, 'src/index.ts') },
      ],
    },
    build: { outDir, emptyOutDir: true },
  })
}

async function serve(dist) {
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const file = path.join(dist, path.normalize(name))
    const target = file.startsWith(dist) && path.extname(file) ? file : path.join(dist, 'index.html')
    try {
      res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(await readFile(target))
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) }
}

const cost = (a, b) => ({
  layouts: b.LayoutCount - a.LayoutCount,
  styles: b.RecalcStyleCount - a.RecalcStyleCount,
  scriptMs: (b.ScriptDuration - a.ScriptDuration) * 1000,
  layoutMs: (b.LayoutDuration - a.LayoutDuration) * 1000,
  styleMs: (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000,
  taskMs: (b.TaskDuration - a.TaskDuration) * 1000,
})

const step = (page, times, pause = 120) => async () => {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.perfStep?.())
    await wait(pause)
  }
}
const widths = (page, list, pause = 200) => async () => {
  for (const width of list) {
    await page.setViewportSize({ width, height: 900 })
    await wait(pause)
  }
}
const idle = (ms) => () => wait(ms)
const theme = (page) => async () => {
  for (const mode of ['dark', 'light', 'dark', 'light']) {
    await page.evaluate((m) => { document.documentElement.dataset.mode = m }, mode)
    await wait(200)
  }
}

/** 見本ごとの、開いたあとに測る操作 */
const ACTIONS = {
  rolling: (page) => ({ 値の変更: step(page, 3, 900), 色の切り替え: theme(page) }),
  tree: (page) => ({ 幅の変更: widths(page, [1300, 1200, 1100, 1000, 1100, 1440], 350), 選択の変更: step(page, 6) }),
  collapse: (page) => ({ 幅の変更: widths(page, [1200, 1000, 1440]) }),
  table: (page) => ({
    スクロール: async () => {
      for (let i = 1; i <= 60; i++) {
        await page.evaluate((top) => { document.querySelector('.data-table-scroll').scrollTop = top }, i * 150)
        await wait(30)
      }
    },
  }),
  mutating: (page) => ({ 中身の差し替え: step(page, 40, 40) }),
  charts: (page) => ({ 幅の変更: widths(page, [1300, 1200, 1100, 1000, 1100, 1440]) }),
  skeleton: () => ({ 待機: idle(2000) }),
  wave: () => ({ 待機: idle(2000) }),
  shell: (page) => ({ 幅の変更: widths(page, Array.from({ length: 40 }, (_, i) => 1439 - i), 40) }),
}

async function measureCase(browser, base, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  const read = async (gc = false) => {
    if (gc) for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage')
    return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  }
  await page.goto(`${base}/?case=${name}`, { waitUntil: 'load' })
  await wait(1200)
  const loaded = await read()
  const result = { 初回: cost(Object.fromEntries(Object.keys(loaded).map((k) => [k, 0])), loaded) }
  const kept = await read(true)
  result.要素 = await page.evaluate(() => document.querySelectorAll('#root *').length)
  result.ヒープKB = Math.round(kept.JSHeapUsedSize / 1024)
  result.DOMノード = kept.Nodes
  for (const [label, run] of Object.entries(ACTIONS[name](page))) {
    const before = await read()
    const renders = await page.evaluate(() => window.perfRenders)
    await run()
    result[label] = { ...cost(before, await read()), renders: (await page.evaluate(() => window.perfRenders)) - renders }
  }
  await context.close()
  return result
}

function fold(samples) {
  const out = {}
  for (const key of Object.keys(samples[0])) {
    const values = samples.map((s) => s[key])
    out[key] = typeof values[0] === 'object' ? fold(values) : median(values)
  }
  return out
}

const show = (c) => `layout ${String(c.layouts).padStart(4)}回 ${c.layoutMs.toFixed(0).padStart(4)}ms / style ${String(c.styles).padStart(4)}回 ${c.styleMs.toFixed(0).padStart(4)}ms / script ${c.scriptMs.toFixed(0).padStart(4)}ms / task ${c.taskMs.toFixed(0).padStart(5)}ms${c.renders ? ` / 描き直し ${c.renders}回` : ''}`

const { runs, cases, out, src } = args()
const dist = await mkdtemp(path.join(tmpdir(), 'ignite-perf-parts-'))
const report = { runs, cases: {} }
try {
  await buildParts(src, dist)
  const server = await serve(dist)
  const browser = await chromium.launch({ headless: true })
  try {
    for (const name of cases ?? Object.keys(ACTIONS)) {
      const samples = []
      for (let i = 0; i < runs; i++) samples.push(await measureCase(browser, server.url, name))
      const r = (report.cases[name] = fold(samples))
      console.log(`■ ${name}  要素 ${r.要素} / DOMノード ${r.DOMノード} / ヒープ ${r.ヒープKB}KB`)
      for (const [label, value] of Object.entries(r)) if (typeof value === 'object') console.log(`  ${label.padEnd(8, '　')} ${show(value)}`)
    }
  } finally {
    await browser.close()
    await server.close()
  }
} finally {
  await rm(dist, { recursive: true, force: true })
}
if (out) await writeFile(out, `${JSON.stringify(report, null, 2)}\n`)
