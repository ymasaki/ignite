// DESIGN.md の決まりのうち、ソースを読んで機械で確かめられるものを検査する（ignite check）。
// 描いた結果を測るのは監査（@ymasaki/ignite/audit）。ここはソースの書き方を見る。
// どうしても外れる行は、その行に `design-ok: 理由` を書くと検査から外れる（理由は必須。レビューで見る）。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface ForbiddenWords {
  /** 正規表現の文字列 */
  pattern: string
  flags?: string
  message: string
  /** 検査しないファイル・フォルダ（root からの相対） */
  allow?: string[]
}

/** ignite.config.json。パスはすべて root からの相対で、ファイルかフォルダを書く */
export interface CheckConfig {
  /** 検査するソースのフォルダ */
  source: string[]
  /** 画面（素の要素・インラインの style・長い文言を止める） */
  screens: string[]
  /** アプリの部品（長い文言を止める。素の要素は書いてよい） */
  parts: string[]
  /** 画面の配置と部品の CSS */
  styles: string[]
  /** トークンの定義（色を直接書いてよい） */
  themes: string[]
  /** テスト・ダミーデータなど、検査しないファイル・フォルダ */
  ignore: string[]
  /** アプリの語など、ソースに直書きしない語 */
  forbiddenWords: ForbiddenWords[]
  /** 1 つの文言の上限（全角の文字数） */
  maxText: number
  /** Ignite 自身を検査するとき true（部品の上書き・枠の検査を外す） */
  self: boolean
}

export const DEFAULT_CONFIG: CheckConfig = { source: ['src'], screens: ['src/app', 'src/screens', 'src/pages'], parts: ['src/ui', 'src/components'], styles: ['src/styles'], themes: ['src/styles/theme.css'], ignore: [], forbiddenWords: [], maxText: 32, self: false }

export interface Problem {
  path: string
  line: number
  message: string
}

const FONT_SIZES = [11, 12, 13, 14, 16, 20, 24, 32]
const FONT_WEIGHTS = new Set(['400', '600', '700', 'normal', 'bold', 'inherit'])
const RADII = new Set(['0', '3px', '6px', '8px', '10px', '12px', '14px', '99px', '50%', 'inherit'])
// 素のまま書かない要素と、代わりに使う部品
const RAW_TAGS: Record<string, string> = {
  button: 'Button / IconButton / LinkButton',
  input: 'SearchField / TextField / Checkbox / NumberField',
  select: 'Select / Combobox',
  textarea: 'TextArea',
  h1: 'AppShell の title',
  h2: 'Section / SubHeading',
  h3: 'Section / SubHeading',
  h4: 'SubHeading',
  h5: 'SubHeading',
  h6: 'SubHeading',
  p: 'Notice / EmptyState / KeyValues / Prose',
  article: 'EntityRow',
  table: 'DataTable',
  a: 'ExternalLink / LinkButton',
}
// DESIGN.md 5 章「画面の骨組みの区切り」のうちメディアクエリに書く値（★ の幅は shellLayout が計算するので書かない）。min-width は区切りの 1px 上も同じ区切り
const BREAK_WIDTHS = new Set([860, 720, 600])
const BREAK_HEIGHTS = new Set([500])
const MEDIA_SIZE = /\((min|max)-(width|height)\s*:\s*(\d+)px\)/g
// Ignite の部品。アプリの CSS でこれらの見た目を上書きしない
const DS_PARTS = /\.(seg|tabs|stepper|select-btn|sel-[\w-]+|btn|icon-btn|chip|tag|badge|kpi(?:-[\w]+)?|erow|er-[\w]+|section-h|subhead|notice|drawer|popover-body|field|sfield|check|linkbtn|crumbs|kv|empty-state|av|section|section-[\w]+|skel|skel-[\w]+|side-foot)(?![\w-])/
// 1.1 で足した部品。アプリに同じ名前の独自のクラスがあるかもしれないので、次の major までは注意にとどめる
const NEW_PARTS = /\.(check-[\w]+|switch|sw-[\w]+|numfield|nf-[\w]+|form-field|ff-[\w]+|cal|cal-[\w]+|dialog|dlg-[\w]+|toast|toasts|pagination|pg-[\w]+|accordion|ac-[\w]+|steps|st-[\w]+|spinner|progress)(?![\w-])/
const LOOK_PROPS = /(?<![\w-])(padding(?:-\w+)?|font-size|font-weight|color|background(?:-color)?|border(?:-(?:top|right|bottom|left|color|width))?|width|height|border-radius|box-shadow|opacity)\s*:/g
// AppShell が持つ枠の部品。アプリの CSS はこれらを対象（セレクタの最後の要素）にしない（中身の状態に合わせた規則はよい）
const SHELL_PARTS = /\.(app|mainwrap|side|side-handle|side-scrim|pslot|panel)(?![\w-])[^\s>+~]*$/
const SIZE_MEDIA_JS = /matchMedia\(\s*['"`][^'"`]*(?:width|height)/
const DATE_FMT = /\bIntl\.DateTimeFormat\b|\.toLocale(?:Date|Time)?String\(/
const OK = /design-ok:\s*[^\s*]/
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/
const JP = /[\u3040-\u30ff\u3400-\u9fff\uff01-\uff5e]/g
const SPACING = /(?<![\w-])(padding(?:-\w+)?|margin(?:-\w+)?|gap|row-gap|column-gap)\s*:\s*([^;}]*)/g
const NARROW_MEDIA = /@media[^{]*\(max-(?:width|height)\s*:[^{]*\{/g

/** コメントを同じ数の改行に置き換える（行番号を保つ） */
const stripCssComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat(m.split('\n').length - 1))
const okAt = (raw: string[], line: number) => OK.test(raw[line - 1] ?? '')

export function checkCss(file: string, text: string): Problem[] {
  const out: Problem[] = []
  const raw = text.split('\n')
  stripCssComments(text).split('\n').forEach((line, idx) => {
    const i = idx + 1
    if (okAt(raw, i)) return
    // アバター色（.c1〜.c6）だけは色を直接書いてよい（DESIGN.md 2 章）
    if (COLOR.test(line) && !/\.c[1-6]\b/.test(line)) out.push({ path: file, line: i, message: '色を直接書かない。tokens.css（アプリ固有はアプリのテーマ）の変数を使う' })
    for (const m of line.matchAll(/font-size:\s*([0-9.]+)px/g)) out.push({ path: file, line: i, message: `文字の大きさは px で書かず、目盛りのトークン var(--fs-${m[1]}) で書く（目盛り ${FONT_SIZES.join('/')}）` })
    for (const m of line.matchAll(/font-size:\s*var\(--fs-(\d+)\)/g)) {
      if (!FONT_SIZES.includes(Number(m[1]))) out.push({ path: file, line: i, message: `文字の大きさ --fs-${m[1]} は目盛り ${FONT_SIZES.join('/')} にない` })
    }
    for (const m of line.matchAll(/font-weight:\s*([^;}\s]+)/g)) {
      if (!FONT_WEIGHTS.has(m[1])) out.push({ path: file, line: i, message: `文字の太さ ${m[1]} は 400 / 600 / 700 だけ` })
    }
    for (const m of line.matchAll(/border-radius:\s*([^;}]+)/g)) {
      const bad = m[1].trim().split(/\s+/).filter((v) => !RADII.has(v) && !v.startsWith('var('))
      if (bad.length) out.push({ path: file, line: i, message: `角丸 ${bad.join(' ')} は目盛り（6 / 8 / 10 / 12 / 14 / 99px / 50%）にない` })
    }
  })
  return out
}

/** @media・matchMedia・useMedia の幅と高さは、区切りの表の値だけ */
export function checkMedia(file: string, text: string): Problem[] {
  const out: Problem[] = []
  const raw = text.split('\n')
  const body = file.endsWith('.css') ? stripCssComments(text) : text
  body.split('\n').forEach((line, idx) => {
    if (!/@media|matchMedia|useMedia/.test(line) || okAt(raw, idx + 1)) return
    for (const [, kind, axis, v] of line.replaceAll(': ', ':').matchAll(MEDIA_SIZE)) {
      const allowed = axis === 'width' ? BREAK_WIDTHS : BREAK_HEIGHTS
      const n = kind === 'min' && allowed.has(Number(v) - 1) ? Number(v) - 1 : Number(v)
      if (!allowed.has(n)) out.push({ path: file, line: idx + 1, message: `区切り ${kind}-${axis}:${v}px は DESIGN.md 5 章の表（${[...allowed].join(' / ')}）にない。部品の中はコンテナクエリで、骨組みなら先に表を直す` })
    }
  })
  return out
}

/** 窓の区切りで余白の値を段で変えていないか（DESIGN.md 5 章「外側の余白」）。区切りで変えてよいのは組み方だけ */
export function checkMediaSpacing(file: string, text: string): Problem[] {
  const out: Problem[] = []
  const body = stripCssComments(text)
  const raw = text.split('\n')
  for (const m of body.matchAll(NARROW_MEDIA)) {
    const open = m.index + m[0].length
    let depth = 1
    let end = open
    while (depth && end < body.length) {
      if (body[end] === '{') depth++
      if (body[end] === '}') depth--
      end++
    }
    const inner = body.slice(open, end - 1)
    for (const r of inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const bad = [...r[2].matchAll(SPACING)].filter(([, , v]) => /(?<![\w.-])(?!0px)[0-9.]+px/.test(v) && !v.includes('clamp(')).map(([, p]) => p)
      if (!bad.length) continue
      const start = open + r.index + (r[1].length - r[1].trimStart().length)
      const line = body.slice(0, start).split('\n').length
      if (okAt(raw, line)) continue
      out.push({ path: file, line, message: `区切りで余白（${[...new Set(bad)].sort().join(' ')}）の値を段で変えない。clamp() でなめらかに変える（組み方が変わって現れる部品なら design-ok で理由を書く）` })
    }
  }
  return out
}

/** アプリの CSS が Ignite の部品の見た目（余白・文字・色・枠）を上書きしていないか。幅・位置（配置）はよい */
export function checkOverride(file: string, text: string, parts: RegExp = DS_PARTS): Problem[] {
  const out: Problem[] = []
  const body = stripCssComments(text)
  const raw = text.split('\n')
  for (const m of body.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    const [, sel, decl] = m
    const part = sel.match(parts)
    const props = [...decl.matchAll(LOOK_PROPS)].map((p) => p[1])
    if (!part || !props.length) continue
    const line = body.slice(0, m.index + (sel.length - sel.trimStart().length)).split('\n').length
    if (okAt(raw, line)) continue
    out.push({ path: file, line, message: `Ignite の部品（${part[0]}）の見た目（${[...new Set(props)].sort().join(' ')}）を上書きしない。Ignite に修飾を足すかアプリの部品を作る` })
  }
  return out
}

/** アプリの CSS が枠の部品そのものの見た目・大きさを書いていないか */
export function checkShellCss(file: string, text: string): Problem[] {
  const out: Problem[] = []
  const body = stripCssComments(text)
  const raw = text.split('\n')
  for (const m of body.matchAll(/([^{}@;]+)\{[^{}]*\}/g)) {
    const line = body.slice(0, m.index + (m[1].length - m[1].trimStart().length)).split('\n').length
    if (okAt(raw, line)) continue
    const sel = m[1].split(',').map((s) => s.trim()).find((s) => SHELL_PARTS.test(s))
    if (sel) out.push({ path: file, line, message: `アプリの枠の部品（${sel}）を CSS で書かない。大きさへの対応は AppShell（sizes・shellLayout）で` })
  }
  return out
}

/** コメントを空にした行（行番号は保つ） */
function codeLines(text: string): string[] {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat(m.split('\n').length - 1)).replace(/\{\/\*.*?\*\/\}/g, '')
  return noBlock.split('\n').map((ln) => ln.replace(/(^|\s)\/\/.*$/, ''))
}

export function checkShellJs(file: string, text: string): Problem[] {
  return text.split('\n').flatMap((line, i) => (SIZE_MEDIA_JS.test(line) && !OK.test(line) ? [{ path: file, line: i + 1, message: '窓の幅・高さを matchMedia で見ない。枠は AppShell、部品の中はコンテナクエリか useFitStep で決める' }] : []))
}

export function checkScreen(file: string, text: string): Problem[] {
  const out: Problem[] = []
  const raw = text.split('\n')
  codeLines(text).forEach((line, idx) => {
    const i = idx + 1
    if (okAt(raw, i)) return
    for (const m of line.matchAll(/<([a-z][a-z0-9]*)[\s>/]/g)) {
      if (RAW_TAGS[m[1]]) out.push({ path: file, line: i, message: `<${m[1]}> を画面で直接書かない。${RAW_TAGS[m[1]]} を使う` })
    }
    if (line.includes('style={{')) out.push({ path: file, line: i, message: 'インラインの style を書かない。CSS か部品の props で表す' })
  })
  return out
}

/** 行の中の文言（文字列リテラルと JSX のテキスト） */
function texts(line: string): string[] {
  const found = [...line.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g)].map((m) => m[1] || m[2] || m[3]).filter(Boolean)
  found.push(...[...line.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]))
  const stripped = line.trim()
  if (stripped && !/[<>{}=;()]/.test(stripped) && stripped.match(JP)) found.push(stripped)
  return found
}

export function checkCopy(file: string, text: string, maxText: number): Problem[] {
  const out: Problem[] = []
  const raw = text.split('\n')
  codeLines(text).forEach((line, idx) => {
    if (okAt(raw, idx + 1)) return
    for (const t of texts(line)) {
      const s = t.replace(/\$\{[^}]*\}/g, '')
      const jp = s.match(JP)?.length ?? 0
      const n = jp + Math.floor((s.match(/[A-Za-z0-9]/g)?.length ?? 0) / 2)
      if (jp && n > maxText) out.push({ path: file, line: idx + 1, message: `文言が長すぎる（${n} 字 > ${maxText}）。説明文を書かず、見出し・ラベル・件数・状態だけにする: ${s.trim().slice(0, 24)}…` })
    }
  })
  return out
}

export function checkDate(file: string, text: string): Problem[] {
  const raw = text.split('\n')
  return codeLines(text).flatMap((line, i) => (!OK.test(raw[i] ?? '') && DATE_FMT.test(line) ? [{ path: file, line: i + 1, message: '日付を直接整形しない。fmtDate / fmtDateTime / fmtMonth / fmtAsOf を使う（DESIGN.md 9 章）' }] : []))
}

// 部品で置き換えられるブラウザ標準の UI。既存の書き方を止めないよう、次の major までは警告にとどめる（docs/releasing.md）
const NATIVE_UI: [RegExp, string][] = [
  [/(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\(/, 'alert / confirm / prompt を使わない。ConfirmDialog か toast を使う'],
  [/<dialog[\s>]/, '<dialog> を直接書かない。Dialog を使う'],
  [/<progress[\s>]/, '<progress> を直接書かない。ProgressBar を使う'],
  [/<input[^>]*type=["'](?:checkbox|radio|date|number|range)["']/, 'ブラウザ標準の入力を直接書かない。Checkbox / RadioGroup / DatePicker / NumberField を使う'],
]

/** 部品で置き換えられるブラウザ標準の UI（画面の .tsx） */
export function checkNativeUi(file: string, text: string): Problem[] {
  const raw = text.split('\n')
  return codeLines(text).flatMap((line, i) => (OK.test(raw[i] ?? '') ? [] : NATIVE_UI.filter(([re]) => re.test(line)).map(([, message]) => ({ path: file, line: i + 1, message }))))
}

export function checkWords(file: string, text: string, rule: ForbiddenWords): Problem[] {
  const re = new RegExp(rule.pattern, rule.flags)
  return text.split('\n').flatMap((line, i) => (!OK.test(line) && re.test(line) ? [{ path: file, line: i + 1, message: rule.message }] : []))
}

const within = (file: string, roots: string[]) => roots.some((r) => file === r || file.startsWith(r.replace(/\/$/, '') + '/'))
const isTest = (file: string) => /\.(test|spec|audit|perf)\.tsx?$/.test(file) || file.endsWith('.d.ts')

/** added があるとき（コミットされる差分の行番号を返す）、既存の部品の上書きは警告にして、新しく足した行だけを止める */
export function run(files: Map<string, string>, config: CheckConfig, added?: (file: string) => Set<number>): { problems: Problem[]; warnings: Problem[] } {
  const problems: Problem[] = []
  const warnings: Problem[] = []
  for (const file of [...files.keys()].sort()) {
    if (within(file, config.ignore) || isTest(file)) continue
    const text = files.get(file)!
    const css = file.endsWith('.css')
    const code = /\.tsx?$/.test(file)
    if (!css && !code) continue
    const theme = within(file, config.themes)
    problems.push(...checkMedia(file, text))
    if (css && !theme) problems.push(...checkMediaSpacing(file, text), ...checkCss(file, text))
    if (css && !config.self) {
      problems.push(...checkShellCss(file, text))
      const found = theme ? [] : checkOverride(file, text)
      const lines = added?.(file)
      problems.push(...found.filter((p) => lines?.has(p.line) ?? !added))
      if (added) warnings.push(...found.filter((p) => !lines?.has(p.line)))
      if (!theme) warnings.push(...checkOverride(file, text, NEW_PARTS))
    }
    if (code) {
      if (!config.self) problems.push(...checkShellJs(file, text))
      if (!file.endsWith('format/date.ts')) problems.push(...checkDate(file, text))
    }
    if (file.endsWith('.tsx') && within(file, config.screens)) {
      problems.push(...checkScreen(file, text), ...checkCopy(file, text, config.maxText))
      warnings.push(...checkNativeUi(file, text))
    }
    if (file.endsWith('.tsx') && within(file, config.parts)) problems.push(...checkCopy(file, text, config.maxText))
    for (const rule of config.forbiddenWords) {
      if (!within(file, rule.allow ?? [])) problems.push(...checkWords(file, text, rule))
    }
  }
  return { problems, warnings }
}

export function loadConfig(root: string): CheckConfig {
  const file = path.join(root, 'ignite.config.json')
  const given = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<CheckConfig>) : {}
  return { ...DEFAULT_CONFIG, ...given }
}

function walk(root: string, rel: string, out: Map<string, string>) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) return
  if (fs.statSync(full).isFile()) {
    out.set(rel, fs.readFileSync(full, 'utf8'))
    return
  }
  for (const name of fs.readdirSync(full)) {
    if (name !== 'node_modules' && name !== 'dist') walk(root, path.posix.join(rel, name), out)
  }
}

const git = (root: string, args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** コミットされる内容（git の index）を読む。並行して作業中のファイルを巻き込まない */
function stagedFiles(root: string, config: CheckConfig): Map<string, string> {
  const out = new Map<string, string>()
  for (const name of git(root, ['ls-files', '--cached', '--', ...config.source]).split('\n').filter(Boolean)) out.set(name, git(root, ['show', `:./${name}`]))
  return out
}

function addedLines(root: string, file: string): Set<number> {
  const lines = new Set<number>()
  for (const m of git(root, ['diff', '--cached', '-U0', '--', file]).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1])
    for (let i = 0; i < Number(m[2] ?? 1); i++) lines.add(start + i)
  }
  return lines
}

export function main(root: string, argv: string[]): number {
  const staged = argv.includes('--staged')
  const config = loadConfig(root)
  const files = new Map<string, string>()
  if (staged) stagedFiles(root, config).forEach((v, k) => files.set(k, v))
  else config.source.forEach((s) => walk(root, s, files))
  const { problems, warnings } = run(files, config, staged ? (f) => addedLines(root, f) : undefined)
  if (warnings.length) {
    console.log(`[ignite] 注意 ${warnings.length} 件（止めないが直す）`)
    for (const w of warnings) console.log(`  ${w.path}:${w.line}: ${w.message}`)
  }
  for (const p of problems) console.log(`${p.path}:${p.line}: ${p.message}`)
  if (problems.length) {
    console.log(`\n[ignite] ${problems.length} 件。DESIGN.md に合わせて直す（やむを得ない行は \`design-ok: 理由\` を書く）`)
    return 1
  }
  console.log(`[ignite] OK（${files.size} ファイル）`)
  return 0
}
