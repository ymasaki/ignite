import { expect, test } from './test'
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

const panArgs = { ...args, panRegions: [{ viewport: '.viewport', content: '.viewport > .canvas' }] }
async function panFixture(page: import('@playwright/test').Page, extra = '', content = '<button class="moving">パン内容</button>') {
  await page.setViewportSize({ width: 800, height: 600 })
  await page.setContent(`<style>
    body{margin:0;font-size:16px} .outer{position:absolute;left:50px;top:50px;width:350px;height:300px}
    .viewport{position:relative;width:250px;height:250px;overflow:hidden}
    .canvas{position:absolute;width:600px;height:200px;transform:translate(150px,0) scale(1.1);transform-origin:0 0}
    button{font:inherit;width:160px;height:30px} .moving{position:absolute;left:0;top:10px}
    ${extra}
  </style><div class="outer"><div class="viewport"><div class="canvas">${content}</div>
    <button class="mini" style="position:absolute;left:210px;top:160px">固定操作</button>
  </div></div><div style="position:absolute;left:500px;top:50px;width:40px;overflow:hidden"><button class="outside">外部</button></div>`)
}
const clips = (findings: Awaited<ReturnType<typeof measure>>) => findings.filter((f) => f.expected === '中身が枠に切られない')

test('パン境界だけ受理し、兄弟固定操作・外部・内部クリップを保つ', async ({ page }) => {
  await panFixture(page, '', '<button class="moving">パン内容</button><div style="position:absolute;top:70px;width:30px;overflow:hidden"><button class="inside">内部不正</button></div>')
  const baseline = await measure(page, args)
  expect(await measure(page, { ...args, panRegions: [] })).toEqual(baseline)
  expect(clips(baseline).some((f) => f.where.includes('moving'))).toBe(true)
  const measured = await measure(page, panArgs)
  expect(clips(measured).some((f) => f.where.includes('moving'))).toBe(false)
  for (const name of ['mini', 'outside', 'inside']) expect(clips(measured).some((f) => f.where.includes(name))).toBe(true)
  // 別規則は変えない。
  expect(measured.filter((f) => f.rule !== '横のはみ出し（5 章）')).toEqual(baseline.filter((f) => f.rule !== '横のはみ出し（5 章）'))
})

for (const position of ['fixed', 'sticky']) {
  for (const self of [true, false]) test(`パン内の${self ? '自身' : '祖先'}が${position}なら切れを検出`, async ({ page }) => {
    await panFixture(page, '', self
      ? `<button class="moving" style="position:${position}">固定</button>`
      : `<div style="position:${position}"><button class="moving">固定</button></div>`)
    expect(clips(await measure(page, panArgs)).some((f) => f.where.includes('moving'))).toBe(true)
  })
}

test('viewportがvisibleなら外祖先による内容クリップを免除しない', async ({ page }) => {
  await panFixture(page, '.viewport{overflow:visible}.outer{width:300px;overflow:hidden}')
  expect(clips(await measure(page, panArgs)).some((f) => f.where.includes('moving'))).toBe(true)
})

for (const boundary of ['ancestor', 'window']) test(`子が窓外でもviewportの${boundary}クリップを検出`, async ({ page }) => {
  await panFixture(page, `.canvas{transform:translate(2000px,0)}${boundary === 'ancestor' ? '.outer{width:200px;overflow:hidden}' : '.outer{left:650px}'}`)
  expect((await measure(page, panArgs)).some((f) => f.expected === 'パンの枠が切られない')).toBe(true)
})

test('誤った所属や同一要素指定ではパンとして受理しない', async ({ page }) => {
  await panFixture(page)
  for (const content of ['.outside', '.viewport', '.missing']) {
    expect(clips(await measure(page, { ...args, panRegions: [{ viewport: '.viewport', content }] })).some((f) => f.where.includes('moving'))).toBe(true)
  }
})


test('複数の枠はそれぞれの内容だけを受理する', async ({ page }) => {
  await panFixture(page)
  await page.evaluate(() => {
    const other = document.querySelector('.outer')!.cloneNode(true) as HTMLElement
    other.style.top = '350px'
    other.querySelector('.viewport')!.classList.add('second')
    document.body.append(other)
  })
  const findings = clips(await measure(page, panArgs))
  expect(findings.filter((f) => f.where.includes('moving'))).toHaveLength(0)
  expect(findings.filter((f) => f.where.includes('mini'))).toHaveLength(2)
})


test('カレンダーの幅: 表と余白を越える外枠だけを検出する', async ({ page }) => {
  await page.setContent(`<style>
    .popover-body{box-sizing:border-box;width:278px;padding:12px;border:1px solid}
    .cal table{width:252px}
  </style><div class="datepicker"><div class="popover-body"><div class="cal"><table><tbody><tr><td>1</td></tr></tbody></table></div></div></div>`)
  const widths = async () => (await measure(page, args)).filter(f => f.rule === 'カレンダーの幅（7 章）')
  expect(await widths()).toEqual([])
  await page.locator('.popover-body').evaluate(el => { (el as HTMLElement).style.minWidth = '600px' })
  expect(await widths()).toHaveLength(1)
  await page.locator('.datepicker').evaluate(el => el.classList.remove('datepicker'))
  expect(await widths()).toEqual([])
})

test('グラフの確認口を Tab から外す・読み上げから隠す違反を検出する', async ({ page }) => {
  await page.setContent('<div data-chart-tip="受付 3件" tabindex="0" aria-label="受付 3件">3</div><svg aria-hidden="true"><path data-chart-tip="円の区分" /></svg>')
  const graphFindings = async () => (await measure(page, args)).filter(f => f.rule.startsWith('グラフの値の確認'))
  expect(await graphFindings()).toEqual([])
  await page.locator('div').evaluate(el => el.tabIndex = -1)
  expect(await graphFindings()).toHaveLength(1)
  await page.locator('div').evaluate(el => { el.tabIndex = 0; el.setAttribute('aria-hidden', 'true') })
  expect(await graphFindings()).toHaveLength(1)
})
