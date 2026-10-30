// 面積の比でタイルを敷き詰める（squarified treemap。Bruls ほか 2000）。React に依存しない計算（TileMap が使う）。

export interface Tile<T> { item: T; x: number; y: number; w: number; h: number }

/**
 * items を width × height の枠に、面積が size に比例するタイルで敷き詰める。大きい順に置き、タイルを正方形に近づける。
 * size が 0 以下の項目は置かない
 */
export function squarify<T>(items: T[], size: (t: T) => number, width: number, height: number): Tile<T>[] {
  const list = items.filter((t) => size(t) > 0).sort((a, b) => size(b) - size(a))
  const sum = list.reduce((a, t) => a + size(t), 0)
  if (!list.length || width <= 0 || height <= 0) return []
  const k = (width * height) / sum
  const out: Tile<T>[] = []
  let x = 0, y = 0, w = width, h = height
  let row: { item: T; a: number }[] = []
  // 行の中でいちばん細長いタイルの縦横比（1 に近いほど正方形）
  const worst = (r: { a: number }[], side: number) => {
    const s = r.reduce((a, t) => a + t.a, 0), max = Math.max(...r.map((t) => t.a)), min = Math.min(...r.map((t) => t.a))
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min))
  }
  const layout = () => {
    const s = row.reduce((a, t) => a + t.a, 0)
    if (w >= h) {
      const cw = s / h
      let cy = y
      row.forEach((t) => { out.push({ item: t.item, x, y: cy, w: cw, h: t.a / cw }); cy += t.a / cw })
      x += cw; w -= cw
    } else {
      const rh = s / w
      let cx = x
      row.forEach((t) => { out.push({ item: t.item, x: cx, y, w: t.a / rh, h: rh }); cx += t.a / rh })
      y += rh; h -= rh
    }
    row = []
  }
  const rest = list.map((item) => ({ item, a: size(item) * k }))
  while (rest.length) {
    const side = Math.min(w, h)
    if (!row.length || worst([...row, rest[0]], side) <= worst(row, side)) row.push(rest.shift()!)
    else layout()
  }
  layout()
  return out
}
