import { describe, expect, it } from 'vitest'
import { stickyRows } from '../src/ui/tableSticky'

describe('階層の表で見出しの下に積む行（DataTable の depths）', () => {
  // 0 計画 / 1 工程A / 2 作業A1 / 3 手順 / 3 手順 / 1 工程B / 2 作業B1 / 3 手順。行の高さ 10、見出しの高さ 10
  const depths = [0, 1, 2, 3, 3, 1, 2, 3]
  const hs = depths.map(() => 10)
  const tops = hs.map((_, i) => 10 + i * 10)
  const at = (s: number) => stickyRows(depths, tops, hs, s + 10, s)
  it('スクロール前は何も固定しない', () => {
    expect(at(0)).toEqual([])
  })
  it('見ている行の上位の行を、見出しの下に上から積む', () => {
    expect(at(15)).toEqual([
      { i: 0, top: 10 },
      { i: 1, top: 20 },
      { i: 2, top: 30 },
    ])
  })
  it('配下の最後の行が来たら押し上げて外し、次の系統に入れ替える', () => {
    // 作業A1 の配下の最後（手順）の下端が 3 段目の下に来ると、作業A1 を押し上げる
    expect(at(28)).toEqual([
      { i: 0, top: 10 },
      { i: 1, top: 20 },
      { i: 2, top: 22 },
    ])
    expect(at(60).map((r) => r.i)).toEqual([0, 5])
  })
  it('配下のない行は積まない', () => {
    expect(stickyRows([0, 1, 1], [10, 20, 30], [10, 10, 10], 25, 15).map((r) => r.i)).toEqual([0])
  })
  it('行の高さが違っても、押し上げは配下の最後の行の下端で決まる', () => {
    // 0 (高さ 30) / 1 / 1。見出しの下端 10 + スクロール 45 = 55。配下の最後の下端は 70 なので、0 の行は 70 - 30 = 40 へ押し上げられる
    expect(stickyRows([0, 1, 1], [10, 40, 50], [30, 10, 20], 55, 45)).toEqual([{ i: 0, top: -5 }])
  })
  it('深さが飛んでいる行は、親がないので積まない', () => {
    expect(stickyRows([1, 2, 2], [10, 20, 30], [10, 10, 10], 25, 15)).toEqual([])
  })
  it('行がなければ何も固定しない', () => {
    expect(stickyRows([], [], [], 10, 50)).toEqual([])
  })
})
