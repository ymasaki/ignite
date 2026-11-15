import { describe, expect, it } from 'vitest'
import { fmtBytes } from '../src/format/bytes'

describe('ファイルの大きさの表記', () => {
  it('1024 ごとに単位を上げ、10 未満は小数 1 桁、10 以上は整数', () => {
    expect(fmtBytes(0)).toBe('0B')
    expect(fmtBytes(820)).toBe('820B')
    expect(fmtBytes(1024)).toBe('1KB')
    expect(fmtBytes(1536)).toBe('1.5KB')
    expect(fmtBytes(12.4 * 1024)).toBe('12KB')
    expect(fmtBytes(3.44 * 1024 * 1024)).toBe('3.4MB')
    expect(fmtBytes(10 * 1024 * 1024)).toBe('10MB')
    expect(fmtBytes(2 * 1024 ** 3)).toBe('2GB')
  })
  it('1000 以上になったら次の単位にする', () => {
    expect(fmtBytes(999)).toBe('999B')
    expect(fmtBytes(1000)).toBe('1KB')
    expect(fmtBytes(1017 * 1024)).toBe('1MB')
    expect(fmtBytes(999.4 * 1024)).toBe('999KB')
    expect(fmtBytes(1023.9 * 1024)).toBe('1MB')
  })
  it('丸めて 1000 になるときも次の単位にする', () => {
    expect(fmtBytes(999.6 * 1024)).toBe('1MB')
    expect(fmtBytes(1024 * 1024 - 1)).toBe('1MB')
  })
  it('負の数・数でない値は「—」', () => {
    expect(fmtBytes(-1)).toBe('—')
    expect(fmtBytes(Number.NaN)).toBe('—')
  })
})
