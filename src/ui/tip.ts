// 吹き出し（data-tip）を窓の中に収める。吹き出しは CSS の ::after で描くので、出る瞬間に位置を測り、
// 窓の左右からはみ出す分だけ --tip-shift（base.css の translate）で横に寄せる。上下の向き・出す側（右・左・端ぞろえ）は CSS のまま変えない

/** 窓の端と吹き出しのあいだに残す余白（px） */
export const TIP_MARGIN = 8

/**
 * 吹き出しの左右の端（窓の左からの px）と窓の幅から、横に寄せる量を決める。
 * 左ではみ出すなら左端を余白の位置へ、右ではみ出すなら右端を余白の位置へ。窓より広いときは左端をそろえる（読み始めを見せる）
 */
export function tipShift(left: number, right: number, viewport: number, margin = TIP_MARGIN): number {
  if (left < margin) return margin - left
  if (right > viewport - margin) return Math.max(viewport - margin - right, margin - left)
  return 0
}

/** 出ている吹き出しを測り、はみ出すなら寄せる。出ていなければ何もしない */
export function fitTip(el: HTMLElement) {
  el.style.removeProperty('--tip-shift')
  const s = getComputedStyle(el, '::after')
  if (s.display === 'none' || s.content === 'none' || s.content === 'normal' || s.position !== 'absolute') return
  const r = el.getBoundingClientRect()
  // ::after は親（data-tip の要素）の内側の枠からの位置。出る途中の動き（transform）の横のずれも足す
  const moved = s.transform.startsWith('matrix') ? new DOMMatrixReadOnly(s.transform).m41 : 0
  const left = r.left + el.clientLeft + parseFloat(s.left) + moved
  const width = parseFloat(s.width) + parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)
  if (!Number.isFinite(left) || !Number.isFinite(width)) return
  const shift = tipShift(left, left + width, document.documentElement.clientWidth)
  if (shift) el.style.setProperty('--tip-shift', `${shift}px`)
}

let started = false
/**
 * 吹き出しを窓に収める見張りを始める（何度呼んでも 1 回だけ）。startAssist と AppShell が呼ぶので、ふつうはアプリから呼ばなくてよい。
 * ホバー・フォーカスで出る吹き出しを、描かれた次の描画で測る（吹き出しは 0.25s 待ってから出るので、見える前に寄せ終わる）
 */
export function startTips() {
  if (started || typeof document === 'undefined') return
  started = true
  const fit = (e: Event) => {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tip]') : null
    if (el) requestAnimationFrame(() => fitTip(el))
  }
  document.addEventListener('pointerover', fit, true)
  document.addEventListener('focusin', fit, true)
  // 押して文言が変わる吹き出し（「コピー」→「コピーしました」など）は、描き直したあとに測り直す
  document.addEventListener('click', (e) => setTimeout(() => fit(e)), true)
}
