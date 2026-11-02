import { describe, expect, it } from 'vitest'
import { canonRomaji, kanaToRomaji, matchTerms, queryTerms, searchKey, startsWithTerm } from '../src/format/search'
import { pickSuggestions, type SuggestGroup } from '../src/ui/Search'

const hit = (q: string, text: string, reading = '') => matchTerms(searchKey(text, reading), queryTerms(q))

describe('かな → ローマ字', () => {
  it('拗音・促音・長音符', () => {
    expect(kanaToRomaji('しょうじ')).toBe('syouzi')
    expect(kanaToRomaji('はっとり')).toBe('hattori')
    expect(kanaToRomaji('らーめん')).toBe('raamen')
    expect(kanaToRomaji('ちゃん')).toBe('tyan')
  })
})

describe('ローマ字の揺れをそろえる', () => {
  it.each([['shouji', 'しょうじ'], ['ohno', 'おおの'], ['tsuchiya', 'つちや'], ['fukuda', 'ふくだ'], ['homma', 'ほんま'], ['yuki', 'ゆうき'], ['hattori', 'はっとり']])('%s と %s', (r, k) => {
    expect(canonRomaji(r)).toBe(canonRomaji(kanaToRomaji(k)))
  })
})

describe('混ぜ書きの検索', () => {
  const name = '山田 太郎'
  const reading = 'やまだ たろう'
  it.each(['山田 太郎', 'やまだ たろう', 'ヤマダタロウ', 'ﾔﾏﾀﾞ', 'やまだ太郎', '山田たろう', '山田taro', 'yamada 太郎', 'YAMADA', 'ｙａｍａｄａ', 'taro yamada'])('%s は当たる', (q) => {
    expect(hit(q, name, reading)).toBe(true)
  })
  it.each(['山田 花子', 'yamada hanako', 'たなか'])('%s は当たらない', (q) => expect(hit(q, name, reading)).toBe(false))
  it('よみがなくても、かな・カタカナと全角半角の違いは吸収する', () => {
    expect(hit('かいはつぐるーぷ', 'カイハツグループ')).toBe(true)
    expect(hit('ｄｘ', 'DX推進')).toBe(true)
  })
  it('よみがなければ、漢字に英字では当たらない', () => expect(hit('yamada', name)).toBe(false))
  it('メールは英字のまま当たる', () => expect(hit('shimizu@', 'shimizu@example.com')).toBe(true))
})

describe('語の先頭', () => {
  const key = searchKey('橋本 沙織', 'はしもと さおり')
  it('表記かよみの先頭に当たれば true、途中だけなら false', () => {
    expect(startsWithTerm(key, queryTerms('橋本')[0])).toBe(true)
    expect(startsWithTerm(key, queryTerms('hashimo')[0])).toBe(true)
    expect(startsWithTerm(key, queryTerms('沙織')[0])).toBe(false)
    expect(startsWithTerm(key, undefined)).toBe(false)
  })
})

describe('候補の選び方', () => {
  const groups: SuggestGroup[] = [
    { key: 'a', label: '人', items: [{ key: '1', title: '中田 葵', reading: 'なかた あおい' }, { key: '2', title: '田中 蓮', reading: 'たなか れん' }, { key: '3', title: '田中 結', reading: 'たなか ゆい' }, { key: '4', title: '佐藤 陸', text: '田中の担当', reading: 'さとう りく' }] },
    { key: 'b', label: '案件', items: [{ key: '5', title: '請求の自動化' }] },
  ]
  it('空の入力では出さない', () => expect(pickSuggestions(groups, ' ')).toEqual([]))
  it('語の先頭で当たる行を前に出し、当たらないまとまりは出さない', () => {
    const r = pickSuggestions(groups, '田中')
    expect(r).toHaveLength(1)
    expect(r[0].items.map((x) => x.key)).toEqual(['2', '3', '4'])
  })
  it('行は limit で止め、件数は当たった全体の数', () => {
    const r = pickSuggestions(groups, 'たなか', 1)
    expect(r[0].items).toHaveLength(1)
    expect(r[0].count).toBe(2)
  })
})
