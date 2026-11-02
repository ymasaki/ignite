import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, checkNativeUi, checkCopy, checkCss, checkDate, checkFontFamily, checkFontLink, checkMedia, checkMediaSpacing, checkOverride, checkScreen, checkShellCss, checkShellJs, checkWords, run } from '../cli/check'

const lines = (ps: { line: number }[]) => ps.map((p) => p.line)

describe('ignite check の CSS の検査', () => {
  it('色・文字・太さ・角丸の直書きを止め、トークンと目盛りは通す', () => {
    expect(checkCss('a.css', '.a{color:var(--ink);font-size:var(--fs-13);font-weight:700;border-radius:10px}')).toEqual([])
    const css = ['.a{color:#fff}', '.b{background:rgba(0,0,0,.1)}', '.c{font-size:15px}', '.d{font-size:var(--fs-15)}', '.e{font-weight:500}', '.f{border-radius:7px}'].join('\n')
    expect(lines(checkCss('a.css', css))).toEqual([1, 2, 3, 4, 5, 6])
  })
  it('アバター色・コメント・design-ok は外す', () => {
    expect(checkCss('a.css', '.c1{background:#fff}\n/* #fff */\n.a{color:#000} /* design-ok: 理由 */')).toEqual([])
  })
  it('理由のない design-ok は効かない', () => {
    expect(checkCss('a.css', '.a{color:#000} /* design-ok: */')).toHaveLength(1)
  })
  it('区切りは表の値だけ（min-width は 1px 上も同じ区切り）', () => {
    expect(checkMedia('a.css', '@media (max-width:860px){}\n@media (min-width:861px){}\n@media (max-height:500px){}')).toEqual([])
    expect(lines(checkMedia('a.css', '@media (max-width:1000px){}'))).toEqual([1])
  })
  it('区切りの中で余白を段で変えない（clamp と 0 はよい）', () => {
    expect(checkMediaSpacing('a.css', '@media (max-width:600px){.a{padding:clamp(1px,2vw,3px);margin:0}}')).toEqual([])
    expect(lines(checkMediaSpacing('a.css', '.z{}\n@media (max-width:600px){\n.a{padding:8px}\n}'))).toEqual([3])
  })
  it('部品の見た目の上書きを止め、配置はよい', () => {
    expect(checkOverride('a.css', '.btn{margin-left:8px}')).toEqual([])
    expect(lines(checkOverride('a.css', '.x .btn{padding:0}'))).toEqual([1])
  })
  it('枠の部品そのものへの規則を止め、中身はよい', () => {
    expect(checkShellCss('a.css', '.side .mine{color:var(--ink)}')).toEqual([])
    expect(lines(checkShellCss('a.css', '.mainwrap{padding:0}'))).toEqual([1])
  })
})

describe('ignite check のコードの検査', () => {
  it('画面の素の要素・インラインの style を止める（コメントは外す）', () => {
    expect(lines(checkScreen('a.tsx', '<button>x</button>\n<div style={{ color: 1 }} />'))).toEqual([1, 2])
    expect(checkScreen('a.tsx', '// <button>\n<Button>x</Button>')).toEqual([])
  })
  it('長い文言を止める', () => {
    expect(checkCopy('a.tsx', `<Notice>${'あ'.repeat(33)}</Notice>`, 32)).toHaveLength(1)
    expect(checkCopy('a.tsx', `<Notice>${'あ'.repeat(32)}</Notice>`, 32)).toEqual([])
  })
  it('日付の直接の整形と、窓の幅の matchMedia を止める', () => {
    expect(checkDate('a.ts', 'd.toLocaleDateString()')).toHaveLength(1)
    expect(checkShellJs('a.ts', "matchMedia('(max-width: 600px)')")).toHaveLength(1)
    expect(checkShellJs('a.ts', "matchMedia('(prefers-color-scheme: dark)')")).toEqual([])
  })
  it('設定した語を止める', () => {
    expect(checkWords('a.ts', 'const a = "社員"', { pattern: '社員', message: 'x' })).toHaveLength(1)
  })
})

describe('ignite check の振り分け', () => {
  const files = new Map([
    ['src/app/A.tsx', '<button />'],
    ['src/ui/B.tsx', '<button />'],
    ['src/styles/theme.css', ':root{--x:#123456}'],
    ['src/styles/a.css', '.a{color:#123456}'],
    ['src/app/A.test.ts', 'd.toLocaleDateString()'],
    ['src/fake/data.ts', 'd.toLocaleDateString()'],
  ])
  it('画面だけ素の要素を止め、テーマは色を許し、テストと ignore を飛ばす', () => {
    const { problems } = run(files, { ...DEFAULT_CONFIG, ignore: ['src/fake'] })
    expect(problems.map((p) => p.path)).toEqual(['src/app/A.tsx', 'src/styles/a.css'])
  })
  it('コミットの検査では、既存の部品の上書きは警告で、足した行だけ止める', () => {
    const css = new Map([['src/styles/a.css', '.btn{padding:0}\n.chip{padding:0}']])
    const { problems, warnings } = run(css, DEFAULT_CONFIG, () => new Set([2]))
    expect(lines(problems)).toEqual([2])
    expect(lines(warnings)).toEqual([1])
  })
  it('Ignite 自身の検査では上書きと枠の検査を外す', () => {
    const css = new Map([['src/styles/a.css', '.btn{padding:0}\n.side{width:1px}']])
    expect(run(css, { ...DEFAULT_CONFIG, self: true }).problems).toEqual([])
  })
})

describe('書体の注意', () => {
  it('書体の直書きを見つけ、トークン・inherit・design-ok は通す', () => {
    expect(checkFontFamily('a.css', '.a{font-family:var(--font-code)}\n.b{font-family:inherit}\n.c{font-family:serif} /* design-ok: 印刷用 */')).toEqual([])
    expect(lines(checkFontFamily('a.css', '.z{}\n.a{font-family:"Noto Sans JP",sans-serif}'))).toEqual([2])
  })
  it('書体の直書きは注意だけで止めない（既存のアプリの書き方を止めない。docs/releasing.md）', () => {
    const r = run(new Map([['src/styles/a.css', '.a{font-family:serif}']]), DEFAULT_CONFIG)
    expect(r.problems).toEqual([])
    expect(r.warnings).toHaveLength(1)
  })
  it('index.html が書体を読まないと注意する。自前で配るときは design-ok で外せる', () => {
    expect(checkFontLink('index.html', '<head></head>')).toHaveLength(1)
    expect(checkFontLink('index.html', '<link href="https://fonts.googleapis.com/css2?family=Inter&family=LINE+Seed+JP:wght@400">')).toEqual([])
    expect(checkFontLink('index.html', '<!-- design-ok: 自前で配る -->')).toEqual([])
  })
  it('見本の index.html は書体を読む', () => {
    expect(checkFontLink('index.html', fs.readFileSync(path.resolve(import.meta.dirname, '../templates/app/index.html'), 'utf8'))).toEqual([])
  })
})

describe('ブラウザ標準の UI の注意', () => {
  it('alert・confirm・<dialog>・標準の入力を見つけ、部品や design-ok は通す', () => {
    const bad = ['confirm("消す？")', 'window.alert("x")', '<dialog open>', '<progress value={1} />', '<input type="checkbox" />']
    bad.forEach((line) => expect(checkNativeUi('a.tsx', line), line).toHaveLength(1))
    for (const ok of ['<ConfirmDialog open title="x" />', 'onConfirm()', 'x.confirm()', '<input type="text" />', 'alert("x") // design-ok: 開発用']) expect(checkNativeUi('a.tsx', ok), ok).toEqual([])
  })
  it('注意は止めない（既存のアプリの書き方を止めない。docs/releasing.md）', () => {
    const r = run(new Map([['src/app/A.tsx', 'export const a = () => confirm("x")\n']]), { ...DEFAULT_CONFIG, screens: ['src/app'] })
    expect(r.problems).toEqual([])
    expect(r.warnings).toHaveLength(1)
  })
  it('1.1 で足した部品の上書きは注意だけで、アプリの同じ名前のクラスを止めない', () => {
    expect(checkOverride('a.css', '.progress{height:8px}')).toEqual([])
    const r = run(new Map([['src/styles/a.css', '.progress{height:8px}\n.dialog{padding:0}\n']]), { ...DEFAULT_CONFIG, styles: ['src/styles'] })
    expect(r.problems).toEqual([])
    expect(r.warnings).toHaveLength(2)
  })
})
