// キーボードのショートカット（Button の shortcut）。押しているキーのキャップを沈め、離すと戻す。見た目は styles/components/button.css。
// 書き方は「mod+k」「shift+n」「n」のように + でつなぐ。mod は Mac では ⌘、ほかでは Ctrl

import { useEffect, useRef, useState, type RefObject } from 'react'
import { shortcutsOn } from '../assist'

export type ParsedShortcut = { mod: boolean; ctrl: boolean; alt: boolean; shift: boolean; key: string }

const MOD_NAMES = new Set(['mod', 'cmd', 'meta', 'ctrl', 'control', 'alt', 'option', 'shift'])

/** 「mod+k」を修飾キーと主のキーに分ける（大文字・小文字は区別しない）。主のキーが無ければ null */
export function parseShortcut(text: string): ParsedShortcut | null {
  const parts = text.toLowerCase().split('+').map((s) => s.trim()).filter(Boolean)
  const key = parts.filter((p) => !MOD_NAMES.has(p))
  if (key.length !== 1) return null
  const has = (...names: string[]) => parts.some((p) => names.includes(p))
  return { mod: has('mod', 'cmd', 'meta'), ctrl: has('ctrl', 'control'), alt: has('alt', 'option'), shift: has('shift'), key: key[0] }
}

/** 端末が Mac（iPad を含む）か。キャップの記号と mod の意味を決める */
export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const KEY_LABEL: Record<string, string> = { enter: '↵', escape: 'Esc', esc: 'Esc', space: 'Space', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', backspace: '⌫', delete: 'Del', tab: 'Tab', ',': ',', '/': '/' }

/** キャップに書く文字の並び（Mac は ⌃⌥⇧⌘ の順の記号、ほかは Ctrl・Alt・Shift の語）。キャップごとの id は押している判定に使う */
export function shortcutCaps(s: ParsedShortcut, mac = isMac()): { id: string; label: string }[] {
  const caps: { id: string; label: string }[] = []
  const ctrl = s.ctrl || (s.mod && !mac)
  const meta = s.mod && mac
  if (ctrl) caps.push({ id: 'Control', label: mac ? '⌃' : 'Ctrl' })
  if (s.alt) caps.push({ id: 'Alt', label: mac ? '⌥' : 'Alt' })
  if (s.shift) caps.push({ id: 'Shift', label: mac ? '⇧' : 'Shift' })
  if (meta) caps.push({ id: 'Meta', label: '⌘' })
  caps.push({ id: 'key', label: KEY_LABEL[s.key] ?? s.key.toUpperCase() })
  return caps
}

/** 読み上げに渡す形（aria-keyshortcuts。例: Meta+K、Control+Shift+N） */
export function ariaShortcut(s: ParsedShortcut, mac = isMac()): string {
  return shortcutCaps(s, mac).map((c) => (c.id === 'key' ? (s.key.length === 1 ? s.key.toUpperCase() : s.key[0].toUpperCase() + s.key.slice(1)) : c.id)).join('+')
}

/** キーの事象が主のキーか。key で比べ、合わなければ code（KeyK・Digit1。Mac の ⌥ で key が別の字になるため）でも比べる */
export function isMainKey(e: Pick<KeyboardEvent, 'key' | 'code'>, key: string): boolean {
  const k = (e.key ?? '').toLowerCase()
  if (k === key || (key === 'space' && k === ' ') || (key === 'esc' && k === 'escape')) return true
  return e.code === `Key${key.toUpperCase()}` || e.code === `Digit${key}`
}

/** 修飾キーの組がちょうど同じで、主のキーが合うか */
export function matchShortcut(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>, s: ParsedShortcut, mac = isMac()): boolean {
  const ctrl = s.ctrl || (s.mod && !mac)
  const meta = s.mod && mac
  return e.metaKey === meta && e.ctrlKey === ctrl && e.altKey === s.alt && e.shiftKey === s.shift && isMainKey(e, s.key)
}

/** 文字を打っている最中か（入力欄・選択・編集できる要素にフォーカス） */
const typingIn = (t: EventTarget | null) => t instanceof HTMLElement && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)

/** 1 文字のショートカット（修飾キーなし・Shift だけ）は、設定で切れる（WCAG 2.1.4）・入力中は受けない */
const plainKeys = (s: ParsedShortcut) => !s.mod && !s.ctrl && !s.alt

/**
 * ショートカットを受けて el を押す（click）。押しているキーの id（Control・Alt・Shift・Meta・key）の並びを返し、キャップを沈めるのに使う。
 * el が見えない・押せない・開いている窓（dialog）の外にあるときは受けない
 */
export function useShortcut(el: RefObject<HTMLElement | null>, shortcut: string | undefined): Set<string> {
  const [held, setHeld] = useState<Set<string>>(() => new Set())
  const parsed = useRef<ParsedShortcut | null>(null)
  parsed.current = shortcut ? parseShortcut(shortcut) : null
  useEffect(() => {
    if (!shortcut) return
    const mac = isMac()
    const usable = () => {
      const b = el.current
      if (!b?.isConnected || b.closest('[inert]') || b.matches(':disabled,[aria-disabled="true"]')) return false
      if (typeof b.checkVisibility === 'function' && !b.checkVisibility()) return false
      const modal = document.querySelector('dialog:modal')
      return !modal || modal.contains(b)
    }
    const read = (e: KeyboardEvent) => {
      const next = new Set<string>()
      if (e.ctrlKey) next.add('Control')
      if (e.altKey) next.add('Alt')
      if (e.shiftKey) next.add('Shift')
      if (e.metaKey) next.add('Meta')
      return next
    }
    const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
    const update = (next: Set<string>) => setHeld((prev) => (same(prev, next) ? prev : next))
    const down = (e: KeyboardEvent) => {
      const s = parsed.current
      if (!s || e.isComposing) return
      const next = read(e)
      const hit = matchShortcut(e, s, mac)
      const allowed = hit && usable() && (!plainKeys(s) || (shortcutsOn() && !typingIn(e.target)))
      if (allowed) next.add('key')
      // 修飾キーだけを押している間も、そのキャップを沈める（ほかのキーと組み合わせるときは沈めない）
      update(hit && !allowed ? new Set() : allowed || /^(Control|Alt|Shift|Meta)$/.test(e.key) ? next : new Set())
      if (!allowed) return
      e.preventDefault()
      if (!e.repeat) el.current?.click()
    }
    const up = (e: KeyboardEvent) => {
      const s = parsed.current
      if (!s) return
      const next = read(e)
      // 主のキーは、それを離すか修飾キーの組が崩れたら戻す（Mac は ⌘ を押している間、ほかのキーの keyup を出さないため）
      const keep = !isMainKey(e, s.key) && matchShortcut({ key: s.key, code: '', metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey }, s, mac)
      setHeld((prev) => {
        if (keep && prev.has('key')) next.add('key')
        return same(prev, next) ? prev : next
      })
    }
    const clear = () => update(new Set())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [shortcut, el])
  return held
}

/** キーのキャップの並び（飾り。読み上げはボタンの aria-keyshortcuts）。held の id のキャップを沈める */
export function KeyCaps({ shortcut, held }: { shortcut: string; held?: Set<string> }) {
  const s = parseShortcut(shortcut)
  if (!s) return null
  return (
    <span className={`keycaps${plainKeys(s) ? ' plain' : ''}`} aria-hidden="true">
      {shortcutCaps(s).map((c) => (
        <kbd key={c.id} className={`keycap${held?.has(c.id) ? ' down' : ''}`}>{c.label}</kbd>
      ))}
    </span>
  )
}
