import { expect, test } from '@playwright/test'
import { measure, type LayoutMeasurement, type MeasureArgs } from '../../audit/measure'

const args: MeasureArgs = {
  FONT_SIZES: [16], FONT_WEIGHTS: ['400'], RADII: [0],
  SHELL: { overlayBelow: 800, sideMinBelow: 1000, drawerSideAt: 600, minBoard: 300, rail: 48 },
  rows: '.row', overflow: '.overflow', bars: '.bar', frames: '.frame',
}
const targets: Record<LayoutMeasurement, (where: string) => boolean> = {
  rows: (where) => where.includes(' → '),
  boardLeft: (where) => where === '内容の枠の左',
  boardRight: (where) => where === '内容の枠（詳細パネルを含む）の右',
  boardBottom: (where) => where === '内容の枠の下',
}

test('段組みの限定置換は対象の辺だけを除き、他の規則を維持する', async ({ page }) => {
  await page.setContent(`<style>
    body{margin:0;font-size:16px} .mainwrap{position:relative;width:500px;height:500px;--shell-x:16;--shell-top:16;--shell-gap:16;--shell-bottom:16}
    header.top{height:30px;padding-left:40px} .row{height:50px;margin-top:30px}
    .board{position:absolute;left:40px;top:200px;width:400px;height:200px}
    .bad{font-size:15px;border-radius:7px} .overflow{width:20px;white-space:nowrap;overflow:hidden}
    .bar{position:relative;height:40px} .bar button{position:absolute;left:0;top:0;width:40px;height:30px}
  </style><div class="mainwrap"><header class="top"><span>見出し</span></header><main class="shell-main">
    <div class="row">先頭</div><div class="row">次の段</div><div class="board"><span class="bad">文字</span>
    <div class="overflow">長い長い文字列</div><div class="bar"><button>一</button><button>二</button></div></div>
  </main></div>`)
  const baseline = await measure(page, args)
  for (const rule of ['文字の大きさ', '角丸', '横のはみ出し', '操作の重なり']) expect(baseline.some((f) => f.rule.startsWith(rule))).toBe(true)
  expect(baseline.some((f) => f.where.startsWith('ヘッダーの左端'))).toBe(true)
  for (const key of Object.keys(targets) as LayoutMeasurement[]) {
    const match = (f: typeof baseline[number]) => f.rule === '段組みの余白（5 章）' && targets[key](f.where)
    expect(baseline.filter(match).length).toBeGreaterThan(0)
    expect(await measure(page, { ...args, skipLayout: [key] })).toEqual(baseline.filter((f) => !match(f)))
  }
  expect(await measure(page, { ...args, skipLayout: [] })).toEqual(baseline)
})
