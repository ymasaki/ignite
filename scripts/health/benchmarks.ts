// 入力生成と import は計測外。データ量・処理・反復回数を変えるときは suite も変える。
import { performance } from 'node:perf_hooks'
import assert from 'node:assert/strict'
import { searchKey, queryTerms, matchTerms } from '../../src/format/search'
import { squarify } from '../../src/ui/squarify'
import { codeLines } from '../../src/ui/codeTokens'
import { pickSuggestions } from '../../src/ui/Search'

export function benchmarks() {
  const people = Array.from({ length: 10_000 }, (_, i) => ({ text: `山田太郎 ${i}`, reading: 'やまだたろう' }))
  const terms = queryTerms('yamada 123')
  const tiles = Array.from({ length: 2_000 }, (_, i) => ({ value: (i * 37 % 997) + 1 }))
  const code = Array.from({ length: 2_000 }, (_, i) => `const 名前${i} = format("表示 ${i}", ${i}); // 色分け`).join('\n')
  // 多くの候補に当たる短い入力（当たった候補を前後に分けて並べる手間が、件数の 2 乗にならないことを見る）
  const suggestions = [{ key: 'people', label: '人', items: people.map((p, i) => ({ key: String(i), title: p.text, reading: p.reading })) }]
  const cases = [
    { id: 'search-10000', title: '10,000 件の検索キー生成と絞り込み',
      run: () => people.map((p) => searchKey(p.text, p.reading)).filter((key) => matchTerms(key, terms)),
      check: (result: unknown) => assert.equal((result as unknown[]).length, 20) },
    { id: 'suggest-10000', title: '10,000 件すべてに当たる入力の候補選び',
      run: () => pickSuggestions(suggestions, 'yama'),
      check: (result: unknown) => assert.equal((result as { count: number }[])[0].count, 10_000) },
    { id: 'tilemap-2000', title: '2,000 件のタイル配置',
      run: () => squarify(tiles, (t) => t.value, 1200, 800),
      check: (result: unknown) => assert.equal((result as unknown[]).length, 2_000) },
    { id: 'code-2000', title: '2,000 行のコード表示の字句分け',
      run: () => codeLines(code, 'ts'),
      check: (result: unknown) => assert.equal((result as unknown[]).length, 2_000) },
  ]
  const samples = cases.map(({ id, title, run, check }) => {
    for (let i = 0; i < 3; i++) check(run())
    const times = Array.from({ length: 9 }, () => {
      const start = performance.now()
      const result = run()
      const elapsed = performance.now() - start
      check(result)
      return elapsed
    }).sort((a, b) => a - b)
    return { id, title, milliseconds: times[4] }
  })
  return { suite: 'ignite-v2', samples }
}
