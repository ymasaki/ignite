import { describe, expect, it } from 'vitest'
import { acceptFile, splitFiles } from '../src/ui/FileDrop'
import { otpDigits } from '../src/ui/OtpField'
import { passwordStrength } from '../src/ui/PasswordStrength'
import { scrubValue } from '../src/ui/Scrubber'
import { ariaShortcut, matchShortcut, parseShortcut, shortcutCaps } from '../src/ui/Shortcut'

const key = (k: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}, code = '') => ({ key: k, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods })

describe('ショートカット', () => {
  it('修飾キーと主のキーに分け、主のキーがなければ null', () => {
    expect(parseShortcut('Mod+Shift+K')).toEqual({ mod: true, ctrl: false, alt: false, shift: true, key: 'k' })
    expect(parseShortcut('e')).toEqual({ mod: false, ctrl: false, alt: false, shift: false, key: 'e' })
    expect(parseShortcut('mod+shift')).toBeNull()
    expect(parseShortcut('a+b')).toBeNull()
  })
  it('mod は Mac で ⌘、ほかで Ctrl。キャップは ⌃⌥⇧⌘ の順', () => {
    const s = parseShortcut('mod+shift+enter')!
    expect(shortcutCaps(s, true).map((c) => c.label)).toEqual(['⇧', '⌘', '↵'])
    expect(shortcutCaps(s, false).map((c) => c.label)).toEqual(['Ctrl', 'Shift', '↵'])
    expect(ariaShortcut(parseShortcut('mod+k')!, true)).toBe('Meta+K')
    expect(ariaShortcut(parseShortcut('mod+k')!, false)).toBe('Control+K')
  })
  it('修飾キーの組がちょうど同じときだけ合う。⌥ で字が変わっても code で合う', () => {
    const s = parseShortcut('mod+k')!
    expect(matchShortcut(key('k', { metaKey: true }), s, true)).toBe(true)
    expect(matchShortcut(key('k', { metaKey: true, shiftKey: true }), s, true)).toBe(false)
    expect(matchShortcut(key('k', { ctrlKey: true }), s, true)).toBe(false)
    expect(matchShortcut(key('k', { ctrlKey: true }), s, false)).toBe(true)
    expect(matchShortcut(key('˚', { altKey: true }, 'KeyK'), parseShortcut('alt+k')!, true)).toBe(true)
    expect(matchShortcut(key('N', { shiftKey: true }), parseShortcut('shift+n')!, true)).toBe(true)
  })
})

describe('ファイルの振り分け', () => {
  const f = (name: string, type: string, size = 10) => ({ name, type, size })
  it('拡張子・種類・種類の * で比べ、空なら何でも受ける', () => {
    expect(acceptFile(f('報告.PDF', 'application/pdf'), '.pdf')).toBe(true)
    expect(acceptFile(f('a.png', 'image/png'), '.pdf, image/*')).toBe(true)
    expect(acceptFile(f('a.csv', 'text/csv'), 'text/csv')).toBe(true)
    expect(acceptFile(f('a.txt', 'text/plain'), '.pdf,image/*')).toBe(false)
    expect(acceptFile(f('a.txt', ''), '')).toBe(true)
  })
  it('大きさ・数の上限を超えたものは外す', () => {
    const files = [f('a.pdf', 'application/pdf', 5), f('b.pdf', 'application/pdf', 50), f('c.pdf', 'application/pdf', 5)]
    expect(splitFiles(files, { maxSize: 10 })).toEqual({ accepted: [files[0], files[2]], rejected: [files[1]] })
    expect(splitFiles(files, { multiple: false })).toEqual({ accepted: [files[0]], rejected: [files[1], files[2]] })
  })
})

describe('確認コード', () => {
  it('数字だけを取り出し、全角を直し、桁数で切る', () => {
    expect(otpDigits('123 456', 6)).toBe('123456')
    expect(otpDigits('１２３-４５６７', 6)).toBe('123456')
    expect(otpDigits('ab', 6)).toBe('')
  })
})

describe('パスワードの強さ', () => {
  it('未入力は 0、短いものは 1', () => {
    expect(passwordStrength('').score).toBe(0)
    expect(passwordStrength('aZ3!').score).toBe(1)
  })
  it('長さで段を上げ、文字の種類が 3 つ以上なら 1 段上げる', () => {
    expect(passwordStrength('kitchenwalk').score).toBe(1)
    expect(passwordStrength('Kitchen-walk').score).toBe(4)
    expect(passwordStrength('kitchen walk river').score).toBe(4)
    expect(passwordStrength('kT8#mQ2z').score).toBe(3)
  })
  it('繰り返し・続いた並び・よくある語は長くても弱い', () => {
    expect(passwordStrength('Password-2026!').score).toBe(1)
    expect(passwordStrength('xx1234yyZZ!!').score).toBe(1)
    expect(passwordStrength('aaaBBBccc111').score).toBe(1)
    expect(passwordStrength('aaaBBBccc111').advice).toContain('繰り返し')
  })
  it('強い未満には強くする 1 文を添える', () => {
    expect(passwordStrength('mintleaf').advice).toBe('12 字以上にする')
    expect(passwordStrength('Kitchen-walk').advice).toBeUndefined()
  })
})

describe('なぞって決める値', () => {
  it('割合を刻みにそろえ、範囲に収める', () => {
    expect(scrubValue(0.5, 0, 100, 1)).toBe(50)
    expect(scrubValue(0.333, 0.5, 2, 0.1)).toBe(1)
    expect(scrubValue(-1, 0, 100, 5)).toBe(0)
    expect(scrubValue(2, 0, 100, 5)).toBe(100)
    expect(scrubValue(0.52, 0, 10, 0.5)).toBe(5)
  })
})
