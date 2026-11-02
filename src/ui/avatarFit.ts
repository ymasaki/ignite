// 顔アイコンの並び（AvatarStack の fit）を、置き場所の幅の 1 行に収める決め方。表示は ui/Avatar.tsx。

/** 顔の間の広さ（px）。ゆとりがあれば AVATAR_GAP 空け、狭いほど詰め、最大 AVATAR_OVERLAP まで重ねる（重ねるときの値は avatar.css の -6px と同じ） */
export const AVATAR_GAP = 4
export const AVATAR_OVERLAP = 6

/**
 * n 個の顔（1 つ size px）を幅 width の 1 行に収める並べ方。gap は顔の間（負の値は重なり）。
 * 間を空けて並べて収まればそのまま、収まらなければ収まる分だけ間を詰めて（必要なら少しずつ重ねて）全部を出し、
 * いちばん重ねても超えるときは収まる数に絞って残りを「+N」にする（少なくとも 1 つは出す）。
 * moreWidth は「+N」の表示の幅（前の余白を含む）。overlap は重ねてよい最大の幅（押せる顔は pressOverlap）
 */
export function fitAvatars(n: number, width: number, size: number, moreWidth: (rest: number) => number, overlap = AVATAR_OVERLAP): { shown: number; gap: number } {
  if (n <= 1) return { shown: n, gap: AVATAR_GAP }
  const gap = Math.min(AVATAR_GAP, Math.floor((width - n * size) / (n - 1)))
  if (gap >= -overlap) return { shown: n, gap }
  const stacked = (k: number) => k * size - (k - 1) * overlap
  let k = n - 1
  while (k > 1 && stacked(k) + moreWidth(n - k) > width) k--
  return { shown: Math.max(1, k), gap: -overlap }
}

/** 押せる顔の重ねてよい幅。隣に隠れない押せる範囲を 24px 残す（WCAG 2.5.8）。size がそれより小さければ負の値（間を空ける） */
export const pressOverlap = (size: number) => Math.min(AVATAR_OVERLAP, size - 24)

/** 先頭から shown 個を出すとき、activeId のものが「+N」に隠れるなら、出す範囲の最後に入れて見えるようにする（ほかの並びは保つ） */
export function keepVisible<T extends { id: string }>(items: T[], shown: number, activeId?: string | null): T[] {
  const i = activeId ? items.findIndex((p) => p.id === activeId) : -1
  if (i < shown || shown <= 0) return items
  const rest = items.filter((_, j) => j !== i)
  return [...rest.slice(0, shown - 1), items[i], ...rest.slice(shown - 1)]
}
