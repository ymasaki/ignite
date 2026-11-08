// 階層の表（DataTable の depths）で、スクロールしたときに見出しの下へ積んで固定する上位の行を決める（DOM に触れない純粋な関数）。

/**
 * 段 k には、その段の位置にかかる深さ k の行（配下を持ち、本来の位置が段より上へ流れたもの）を置く。
 * 配下の最後の行が段まで来たら、その行を押し上げて外す（入れ子の sticky と同じ動きで、次の上位の行と入れ替わる）。
 * depths は各行の深さ（0 が最上位。深さ優先で並べた順）、tops・hs は各行の本来の上端・高さ（スクロール内容の座標）、
 * y0 は見出しの下端（スクロール内容の座標）、scrollTop はスクロール量。
 * 返す top は、固定する行を置く位置（スクロール枠の上端から。CSS の sticky の top に渡す）
 */
export function stickyRows(depths: number[], tops: number[], hs: number[], y0: number, scrollTop: number): { i: number; top: number }[] {
  const out: { i: number; top: number }[] = []
  // 行 i の配下の最後の行
  const end = (i: number) => {
    let j = i + 1
    while (j < depths.length && depths[j] > depths[i]) j++
    return j - 1
  }
  let y = y0
  for (let k = 0; ; k++) {
    const at = tops.findIndex((t, j) => t + hs[j] > y)
    if (at < 0 || depths[at] < k) break
    // その位置の行の、深さ k の祖先（自分が深さ k なら自分）
    let r = at
    while (depths[r] > k) r--
    // 深さが飛んでいる（親のない）行は積まない
    if (depths[r] !== k) break
    const last = end(r)
    // 配下がない・まだ流れていない行は積まない（端数の誤差 0.5px 未満では固定しない）
    if (last === r || tops[r] > y - 0.5) break
    const bottom = tops[last] + hs[last]
    const top = Math.min(y, bottom - hs[r]) - scrollTop
    out.push({ i: r, top })
    y = top + scrollTop + hs[r]
  }
  return out
}
