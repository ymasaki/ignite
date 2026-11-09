import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateLogin } from '../src/ui/Auth'
import { filterOptions, parseNumber, stepNumber } from '../src/ui/Form'
import { addDays, addMonths, clampDate, monthGrid } from '../src/ui/calendar'
import { pageItems } from '../src/ui/Navigation'
import { codeLines } from '../src/ui/codeTokens'
import { toastDuration } from '../src/ui/Toast'

const root = path.resolve(import.meta.dirname, '..')
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8')

// 大文字で始まり小文字が続く出力が部品。型と定数（SKINS など）を除く
const parts = [...read('src/index.ts').matchAll(/export \{([^}]*)\}/g)].flatMap((m) => m[1].split(',')).map((s) => s.trim()).filter((s) => /^[A-Z][a-z]/.test(s))

describe('部品の一覧（AGENTS.md「部品を足す・変えるときは一緒に直す」）', () => {
  const design = read('DESIGN.md')
  // 目録（nav.tsx）は名前を並べるだけなので数えない。実際に描いているファイルだけを見る
  const catalog = fs.readdirSync(path.join(root, 'catalog/src')).filter((f) => f.endsWith('.tsx') && f !== 'nav.tsx').map((f) => read(`catalog/src/${f}`)).join('\n')
  // カタログでは単独で見せられないもの（理由つき）
  const NOT_IN_CATALOG: Record<string, string> = {
    Drawer: 'AppShell が重ねた詳細パネルとして描く（一覧の型を狭い幅で開くと見える）',
    Toaster: 'AppShell が置く',
    FitBar: '帯の幅に合わせて組むので、Stepper などの修飾の組み合わせとして使う',
  }
  it('部品を 50 個より多く拾えている', () => expect(parts.length).toBeGreaterThan(50))
  it.each(parts)('%s は DESIGN.md に書いてある', (p) => expect(design).toContain(p))
  it.each(parts.filter((p) => !(p in NOT_IN_CATALOG)))('%s はカタログにある', (p) => expect(catalog).toMatch(new RegExp(`\\b${p}\\b`)))
})

describe('コードの字句分け', () => {
  const kinds = (code: string, lang: Parameters<typeof codeLines>[1]) => codeLines(code, lang).flat().filter((t) => t.kind).map((t) => [t.kind, t.text])
  it('字句をつなげると元のコードに戻る（改行は行で表す）', () => {
    const code = 'const a = "売上" // メモ\n\n/* 複数\n行 */ a'
    expect(codeLines(code, 'ts').map((l) => l.map((t) => t.text).join('')).join('\n')).toBe(code)
  })
  it('末尾の改行は行に数えず、CRLF は 1 つの改行にする', () => {
    expect(codeLines('a\r\nb\n\n')).toHaveLength(2)
  })
  it('複数行のコメントは行をまたいで同じ種類にする', () => {
    expect(codeLines('/* a\nb */', 'ts').map((l) => l[0].kind)).toEqual(['comment', 'comment'])
  })
  it('文字列やコメントの中の語はキーワードにしない', () => {
    expect(kinds('"return" // if', 'ts')).toEqual([['string', '"return"'], ['comment', '// if']])
  })
  it('言語ごとの字句', () => {
    expect(kinds('{"a": "b", "c": 1, "d": null}', 'json')).toEqual([['keyword', '"a"'], ['string', '"b"'], ['keyword', '"c"'], ['number', '1'], ['keyword', '"d"'], ['keyword', 'null']])
    expect(kinds("select 'it''s' -- x", 'sql')).toEqual([['keyword', 'select'], ['string', "'it''s'"], ['comment', '-- x']])
    expect(kinds('$ npm run a#b --yes # note', 'shell')).toEqual([['comment', '$'], ['keyword', '--yes'], ['comment', '# note']])
    expect(kinds('2026-11-02 09:14:03 ERROR x', 'log')).toEqual([['comment', '2026-11-02 09:14:03'], ['danger', 'ERROR']])
  })
  it('全角の字だけを wide にする（半角カナは含めない）', () => {
    expect(codeLines('ab売上（ｶﾅ').flat().map((t) => [t.text, !!t.wide])).toEqual([['ab', false], ['売上（', true], ['ｶﾅ', false]])
  })
})

describe('数の入力', () => {
  it('全角の数字・区切り・負の数を読み、読めなければ null', () => {
    expect(parseNumber('１２３')).toBe(123)
    expect(parseNumber('1,200')).toBe(1200)
    expect(parseNumber('－５．５')).toBe(-5.5)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })
  it('増減で端数を出さず、範囲に収める', () => {
    expect(stepNumber(0.1, 0.2, 0.1)).toBe(0.3)
    expect(stepNumber(10, 1, 1, 0, 10)).toBe(10)
    expect(stepNumber(null, 1, 1, 5)).toBe(6)
    expect(stepNumber(0, 1e-7, 1e-7)).toBe(1e-7)
  })
})

describe('ログインの検証', () => {
  it('空はエラーの文を返し、見出しの語を使う', () => {
    expect(validateLogin({ identifier: ' ', password: '' }, 'ユーザー名', 'text')).toEqual({ identifier: 'ユーザー名を入れてください', password: 'パスワードを入れてください' })
  })
  it('メールアドレスは形だけを見る。text では見ない', () => {
    expect(validateLogin({ identifier: 'abc', password: 'x' }, 'メールアドレス', 'email').identifier).toBe('メールアドレスの形で入れてください')
    expect(validateLogin({ identifier: 'a@b', password: 'x' }, 'メールアドレス', 'email')).toEqual({ identifier: undefined, password: undefined })
    expect(validateLogin({ identifier: 'abc', password: 'x' }, 'ユーザー名', 'text').identifier).toBeUndefined()
  })
})

describe('候補の絞り込み', () => {
  it('大文字・小文字を区別しない。空なら全部', () => {
    const o = [{ value: 'a', label: 'Tokyo' }, { value: 'b', label: 'Osaka' }]
    expect(filterOptions(o, 'tok').map((x) => x.value)).toEqual(['a'])
    expect(filterOptions(o, ' ')).toHaveLength(2)
  })
})

describe('カレンダー', () => {
  it('月は 6 週 42 日で、週の始まりで始まる', () => {
    const g = monthGrid('2026-10')
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-09-27')
    expect(monthGrid('2026-10', 1)[0]).toBe('2026-09-28')
  })
  it('月末は丸める。うるう年も数える', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(clampDate('2026-01-01', '2026-02-01')).toBe('2026-02-01')
    expect(clampDate('2026-03-01', undefined, '2026-02-01')).toBe('2026-02-01')
  })
})

describe('ページ送り', () => {
  it('最初・最後・前後を残して間を詰める', () => {
    expect(pageItems(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20])
    expect(pageItems(1, 20)).toEqual([1, 2, '…', 20])
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, '…', 20])
    expect(pageItems(2, 3)).toEqual([1, 2, 3])
  })
})

describe('知らせ', () => {
  it('失敗は残し、取り消せる知らせは長く出す', () => {
    expect(toastDuration({ tone: 'danger' })).toBeNull()
    expect(toastDuration({})).toBe(5000)
    expect(toastDuration({ action: { label: '戻す', onClick: () => undefined } })).toBe(8000)
    expect(toastDuration({ tone: 'danger', duration: 3000 })).toBe(3000)
  })
})
