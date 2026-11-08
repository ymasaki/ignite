// 計測値の解釈を守る。製品コードを整理するテストではない。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { analyzeText, addDuplicates } from './health/analysis.mjs'
import { measureCoverage } from './health/coverage.mjs'
import { root, isSource, sourceFiles, temporary } from './health/common.mjs'
import { copyTracked, measure } from './health/run.mjs'

test('本体だけを対象にし、問題のないファイルも Git 一覧から残す', async () => {
  for (const file of ['src/a.ts', 'src/ui/a.tsx', 'cli/a.ts', 'audit/a.ts']) assert.ok(isSource(file))
  for (const file of ['src/a.test.ts', 'src/a.spec.tsx', 'src/a.d.ts', 'src/generated/a.ts', 'tests/a.ts', 'catalog/a.tsx', 'scripts/a.ts', 'dist/a.ts', 'src/styles/a.css']) assert.ok(!isSource(file), file)
  await temporary(async (dir) => {
    fs.mkdirSync(path.join(dir, 'src'))
    fs.writeFileSync(path.join(dir, 'src/clean.ts'), 'export const value = 1\n')
    fs.writeFileSync(path.join(dir, 'src/untracked.ts'), 'export const value = 2\n')
    execFileSync('git', ['init', '-q', dir])
    execFileSync('git', ['add', 'src/clean.ts'], { cwd: dir })
    assert.deepEqual(sourceFiles(dir), ['src/clean.ts'])
    assert.deepEqual(analyzeText('src/clean.ts', fs.readFileSync(path.join(dir, 'src/clean.ts'), 'utf8')), {
      path: 'src/clean.ts', codeLines: 1, totalLines: 1, functions: [], duplicates: [], suppressions: [],
    })
  })
})

test('宣言・式アロー・メソッド・同じ行の入れ子の認知的複雑度を個別に測る', () => {
  const result = analyzeText('src/example.tsx', [
    '// eslint-disable-next-line health/complexity',
    'function outer(a: boolean) { const inner = (b: boolean) => b ? 1 : 0; if (a) return inner(a); }',
    'const zero = () => 1;',
    'class X { go(a: boolean) { if (a) { for (;;) { if (a) break; } } } }',
    'const Component = ({ a }: { a: boolean }) => <div>{a ? "a" : "b"}</div>;',
  ].join('\n'))
  assert.deepEqual(result.functions.map((f) => [f.name, f.complexity]), [
    ['outer', 1], ['inner', 1], ['zero', 0], ['go', 6], ['Component', 1],
  ])
  assert.deepEqual(result.suppressions, [1])
  assert.equal(result.codeLines, 4)
})

test('コメントと空行を行数から除き、文字列の中のコメント記号はコードに数える', () => {
  const result = analyzeText('src/lines.ts', '// 冒頭\n\nconst example = () => {\n  /* コメント\n     続き */\n  return "// コード";\n}\n')
  assert.equal(result.totalLines, 7)
  assert.equal(result.codeLines, 3)
  assert.deepEqual(result.functions[0], { name: 'example', line: 3, lines: 3, complexity: 0 })
  const split = analyzeText('src/split.ts', 'const\n  example = () => {\n    return 1\n  }\n')
  assert.deepEqual(split.functions[0], { name: 'example', line: 1, lines: 4, complexity: 0 })
  assert.throws(() => analyzeText('src/broken.ts', 'function {'), /Parsing error/)
})

test('抑制はコメントだけから拾い、複雑度の測定自体は無効にしない', () => {
  const result = analyzeText('src/suppressions.ts', [
    '// @ts-ignore',
    'const text = "eslint-disable-next-line";',
    '/* istanbul ignore next */',
    'function example(a: boolean) { if (a) return text; }',
    '// design-ok: 検証用',
    '// NOSONAR',
    '// 無効にするときは design-ok: 理由 と書く',
    '// 説明中の eslint-disable は指示ではない',
  ].join('\n'))
  assert.deepEqual(result.suppressions, [1, 3, 5, 6])
  assert.equal(result.functions[0].complexity, 1)
})

test('10 行以上のコピーを両方のファイルへ載せる', async () => {
  await temporary(async (dir) => {
    const text = ['export function copied(value: number) {',
      ...Array.from({ length: 12 }, (_, i) => `  value += ${i};`), '  return value;', '}'].join('\n')
    const files = ['a.ts', 'b.tsx'].map((file) => {
      fs.writeFileSync(path.join(dir, file), text)
      return analyzeText(file, text)
    })
    await addDuplicates(files, dir)
    for (const file of files) assert.ok(file.duplicates.some((d) => d.line === 1 && d.lines >= 10))
  })
})

test('未 import の本体をカバレッジの母数に含め、テスト失敗は計測失敗にする', async () => {
  await temporary(async (dir) => {
    fs.mkdirSync(path.join(dir, 'src'))
    fs.mkdirSync(path.join(dir, 'tests'))
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir')
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}')
    fs.writeFileSync(path.join(dir, 'src/used.ts'), 'export function used() {\n  return 1\n}\n')
    fs.writeFileSync(path.join(dir, 'src/unused.ts'), 'export function unused() {\n  return 2\n}\n')
    const testFile = path.join(dir, 'tests/example.test.ts')
    const passing = 'import { expect, it } from "vitest"; import { used } from "../src/used"; it("動く", () => { expect(used()).toBe(1) });'
    fs.writeFileSync(testFile, passing)
    execFileSync('git', ['init', '-q', dir])
    execFileSync('git', ['add', 'src', 'tests'], { cwd: dir })
    const { summary, result } = await measureCoverage(dir)
    const unused = summary[path.join(fs.realpathSync(dir), 'src/unused.ts')]
    assert.ok(unused.lines.total > 0)
    assert.equal(unused.lines.covered, 0)
    assert.ok(result.coveredLines > 0)
    assert.ok(result.executableLines > result.coveredLines)
    fs.writeFileSync(testFile, passing.replace('toBe(1)', 'toBe(999)'))
    await assert.rejects(measureCoverage(dir), /テストが失敗/)
  })
})

test('計測の前に管理下のファイルだけを写し、写した先でも同じ一覧を対象にする', async () => {
  await temporary(async (dir) => {
    const from = path.join(dir, 'from')
    const to = path.join(dir, 'to')
    fs.mkdirSync(path.join(from, 'src'), { recursive: true })
    fs.mkdirSync(path.join(from, 'node_modules/broken'), { recursive: true })
    fs.writeFileSync(path.join(from, 'src/tracked.ts'), 'export const value = 1\n')
    fs.writeFileSync(path.join(from, 'src/untracked.ts'), 'export const value = 2\n')
    fs.writeFileSync(path.join(from, 'src/removed.ts'), 'export const value = 3\n')
    execFileSync('git', ['init', '-q', from])
    execFileSync('git', ['add', 'src/tracked.ts', 'src/removed.ts'], { cwd: from })
    fs.rmSync(path.join(from, 'src/removed.ts'))
    fs.writeFileSync(path.join(from, 'src/tracked.ts'), 'export const value = 10\n')
    copyTracked(from, to)
    assert.deepEqual(sourceFiles(to), ['src/tracked.ts'])
    assert.equal(fs.readFileSync(path.join(to, 'src/tracked.ts'), 'utf8'), 'export const value = 10\n')
    assert.ok(!fs.existsSync(path.join(to, 'node_modules')))
    assert.ok(!fs.existsSync(path.join(to, 'src/untracked.ts')))
  })
  await assert.rejects(measure('unknown'), /計測の種類が不明/)
})
