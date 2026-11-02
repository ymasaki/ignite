// コードの字句分け（ui/Code.tsx が使う）。色分けのための軽い分け方で、構文は解釈しない。

export type CodeLanguage = 'plain' | 'ts' | 'json' | 'sql' | 'shell' | 'log'
export type CodeKind = 'comment' | 'string' | 'number' | 'keyword' | 'warn' | 'danger'
/** text と、色分けの種類（なければ地の文字）。wide は全角の字の並びで、半角 2 桁の幅にそろえる */
export interface CodeToken { text: string; kind?: CodeKind; wide?: boolean }

export const CODE_LANGUAGES: Record<CodeLanguage, string> = { plain: 'テキスト', ts: 'TypeScript', json: 'JSON', sql: 'SQL', shell: 'Shell', log: 'ログ' }

const words = (list: string) => list.trim().split(/\s+/).join('|')
const TS_WORDS = words('as async await break case catch class const continue default else export extends false finally for from function if implements import in instanceof interface let new null of return switch this throw true try type typeof undefined var void while')
const SQL_WORDS = words('all alter and as asc between by case create delete desc distinct drop else end exists false from group having in index inner insert into is join left like limit not null offset on or order outer primary right select set table then true union update values when where with')
const STRING = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/.source
const NUMBER = /\b\d[\d_]*(?:\.\d+)?\b/.source
const C_COMMENT = /\/\*[\s\S]*?\*\//.source

// 種類ごとの正規表現。上から順に試す
type Rule = [CodeKind, string]
const RULES: Partial<Record<CodeLanguage, { rules: Rule[]; flags?: string }>> = {
  ts: { rules: [['comment', `//.*|${C_COMMENT}`], ['string', `${STRING}|\`(?:\\\\.|[^\`\\\\])*\``], ['keyword', `\\b(?:${TS_WORDS})\\b`], ['number', NUMBER]] },
  json: { rules: [['keyword', `"(?:\\\\.|[^"\\\\\\n])*"(?=\\s*:)|\\b(?:true|false|null)\\b`], ['string', STRING], ['number', `-?${NUMBER}`]] },
  sql: { rules: [['comment', `--.*|${C_COMMENT}`], ['string', /'(?:''|[^'\n])*'/.source], ['keyword', `\\b(?:${SQL_WORDS})\\b`], ['number', NUMBER]], flags: 'i' },
  shell: { rules: [['comment', /(?<!\S)#.*|^[$>](?= )/.source], ['string', STRING], ['keyword', /(?<!\S)--?[A-Za-z][\w-]*/.source]] },
  log: { rules: [['comment', /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/.source], ['danger', /\b(?:FATAL|ERROR)\b/.source], ['warn', /\bWARN(?:ING)?\b/.source], ['keyword', /\b(?:INFO|DEBUG)\b/.source], ['string', STRING]] },
}

/** 全角の字（かな・漢字・ハングル・全角の記号）の並び。半角カナ（U+FF61〜）は半角なので除く */
const WIDE = /(?:(?![｡-ﾟ])[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}　-ヿ！-｠￠-￦])+/gu

function tokens(code: string, language: CodeLanguage): CodeToken[] {
  const set = RULES[language]
  if (!set) return [{ text: code }]
  const re = new RegExp(set.rules.map(([, src], i) => `(?<k${i}>${src})`).join('|'), `gm${set.flags ?? ''}`)
  const out: CodeToken[] = []
  let at = 0
  for (const m of code.matchAll(re)) {
    if (!m[0]) continue
    if (m.index > at) out.push({ text: code.slice(at, m.index) })
    const i = set.rules.findIndex((_, n) => m.groups![`k${n}`] !== undefined)
    out.push({ text: m[0], kind: set.rules[i][0] })
    at = m.index + m[0].length
  }
  if (at < code.length) out.push({ text: code.slice(at) })
  return out
}

/** 全角の字の並びを切り出す（同じ種類のまま） */
function splitWide(t: CodeToken): CodeToken[] {
  const out: CodeToken[] = []
  let at = 0
  for (const m of t.text.matchAll(WIDE)) {
    if (m.index > at) out.push({ ...t, text: t.text.slice(at, m.index) })
    out.push({ ...t, text: m[0], wide: true })
    at = m.index + m[0].length
  }
  if (at < t.text.length) out.push({ ...t, text: t.text.slice(at) })
  return out
}

/** コードを行ごとの字句に分ける。末尾の改行は行に数えない。字句をつなげると元の行に戻る */
export function codeLines(code: string, language: CodeLanguage = 'plain'): CodeToken[][] {
  const lines: CodeToken[][] = [[]]
  for (const t of tokens(code.replace(/\r\n?/g, '\n').replace(/\n+$/, ''), language)) {
    t.text.split('\n').forEach((text, i) => {
      if (i > 0) lines.push([])
      if (text) lines[lines.length - 1].push(...splitWide({ ...t, text }))
    })
  }
  return lines
}
