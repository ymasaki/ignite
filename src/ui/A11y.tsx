// 読み上げとフォーカスの共通の仕組み（DESIGN.md 12 章「アクセシビリティ」）。見た目は変えず、読み上げソフト・キーボードにだけ効く。
import { useEffect, useRef, type RefObject } from 'react'

/** Tab で止まる要素（無効・tabindex=-1 を除く）。最初の操作へフォーカスを移すときに使う */
export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

let region: HTMLElement | null = null
let timer = 0

/**
 * 画面の変化を読み上げで知らせる（検索の件数・絞り込みの結果・読み込みの完了・コピーしたなど。WCAG 4.1.3）。
 * 常設の見えない live region を 1 つだけ使う（差し込んだばかりの role=status は読まれないことが多いため）。
 * 同じ文を続けて知らせても読むように、一度空にしてから入れる。assertive はエラーなど、いま読んでいるものを遮って知らせるとき
 */
export function announce(text: string, { assertive = false }: { assertive?: boolean } = {}) {
  if (typeof document === 'undefined') return
  if (!region || !region.isConnected) {
    region = document.createElement('div')
    region.className = 'sr-only'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    document.body.appendChild(region)
  }
  const el = region
  el.setAttribute('aria-live', assertive ? 'assertive' : 'polite')
  el.textContent = ''
  window.clearTimeout(timer)
  timer = window.setTimeout(() => (el.textContent = text), 60)
}

/**
 * スクロールする領域をキーボードで送れるようにする（WCAG 2.1.1。axe の scrollable-region-focusable）。
 * 中身がはみ出しているときだけ Tab で止まる（はみ出していないときに止まる所を増やさない）。名前は label で付ける
 */
export function useScrollFocus<T extends HTMLElement>(ref: RefObject<T | null>, label: string) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const sync = () => {
      const scrolls = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1
      if (scrolls) {
        el.tabIndex = 0
        el.setAttribute('role', 'region')
        el.setAttribute('aria-label', label)
      } else {
        el.removeAttribute('tabindex')
        el.removeAttribute('role')
        el.removeAttribute('aria-label')
      }
    }
    sync()
    // 枠の大きさと、中身の差し替え（読み込み中 → 中身）で測り直す
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    const mo = new MutationObserver(sync)
    mo.observe(el, { childList: true, subtree: true })
    return () => (ro.disconnect(), mo.disconnect())
  }, [ref, label])
}

/**
 * 開いた元へフォーカスを返す（パネル・一覧を閉じたとき、押したボタンごと消えてフォーカスが body に落ちないように。WCAG 2.4.3）。
 * active のあいだに開いた元を覚え、active が外れたら、元がまだ画面にあれば返す。なければ fallback（CSS セレクター）の最初の要素へ
 */
export function useReturnFocus(active: boolean, fallback?: string) {
  const from = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!active) return
    from.current = document.activeElement as HTMLElement | null
    return () => {
      const back = from.current
      // 閉じた部品が外れたあとで返す（同じ描画の中では、まだ閉じる途中の部品にフォーカスがあることがある）
      requestAnimationFrame(() => {
        if (document.activeElement && document.activeElement !== document.body) return
        // 見える位置へのスクロールはしない（transform で自前で動かす枠を、ブラウザがずらさないように）
        if (back?.isConnected) back.focus({ preventScroll: true })
        else if (fallback) document.querySelector<HTMLElement>(fallback)?.focus({ preventScroll: true })
      })
    }
  }, [active, fallback])
}

/** 要素が消えてフォーカスが body に落ちたときに、代わりの場所（CSS セレクター）へ移す。消える操作の直後に呼ぶ */
export function keepFocus(...selectors: string[]) {
  requestAnimationFrame(() => {
    if (document.activeElement && document.activeElement !== document.body) return
    // 閉じる途中（inert）などでフォーカスできない要素は飛ばし、実際に移せた最初の要素で止める
    for (const s of selectors) {
      for (const el of document.querySelectorAll<HTMLElement>(s)) {
        el.focus({ preventScroll: true })
        if (document.activeElement === el) return
      }
    }
  })
}
