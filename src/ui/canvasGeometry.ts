// キャンバス（Canvas）の表示位置・倍率の計算。DOM・React に依存しない

/** キャンバスの外側に取る余白（これ以上外へは動かせない） */
export const CANVAS_MARGIN = 80
/** ＋－で止まる倍率（%）。100% などにぴったり止まるように段階で切り替える */
export const ZOOM_STEPS = [20, 25, 33, 50, 67, 75, 90, 100, 110, 125, 150]
/** 拡大縮小できる範囲 */
export const ZOOM_MIN = 0.2
export const ZOOM_MAX = 1.6

/**
 * 表示位置を「中身全体＋少しの余白」の範囲に収める（どこまでも外へ行けないように）。
 * 中身が表示領域より大きければ端が余白の位置で止まり、小さければ表示領域の内側で動かせる
 */
export function clampPos(pos: number, content: number, view: number, margin = CANVAS_MARGIN): number {
  const a = margin
  const b = view - content - margin
  return Math.min(Math.max(pos, Math.min(a, b)), Math.max(a, b))
}

/** 左端 x・幅 w のものを、今の位置のまま left〜right の内側に残す。はみ出すときだけ端から pad の位置までずらす */
export const keepInside = (x: number, w: number, left: number, right: number, pad = 16) => Math.max(left + pad, Math.min(x, right - pad - w))

/** 拡大縮小できる範囲（20%〜160%）に収める */
export const clampZoom = (k: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k))

/** 全体が表示領域に収まる倍率（100% を超えない・20% を下回らない） */
export const fitScale = (view: { w: number; h: number }, content: { w: number; h: number }) =>
  Math.min(1, Math.max(ZOOM_MIN, Math.min(view.w / Math.max(1, content.w), (view.h - 10) / Math.max(1, content.h))))

/** ＋－の次の段階（%）。now は %。先がなければ undefined */
export const nextZoomStep = (now: number, dir: 1 | -1) =>
  dir > 0 ? ZOOM_STEPS.find((z) => z > now) : [...ZOOM_STEPS].reverse().find((z) => z < now)

/**
 * 選んだものへ表示位置を運ぶ動きの長さ（ms）。近ければ 0.35s、遠いほど少し長く、0.65s で頭打ち
 * （遠くまで 0.35s で飛ぶと目で追えず、一瞬で移ったように見えるため。DESIGN.md 6 章）。dist は動く距離（px）
 */
export const glideMs = (dist: number) => Math.round(Math.min(650, 350 + Math.max(0, dist) * 0.25))

/** 表示位置を運ぶ動きの進み具合（0〜1 → 0〜1）。ゆっくり動き出し、ゆっくり止まる */
export const glideEase = (p: number) => {
  const x = Math.min(1, Math.max(0, p))
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

/** 点 (cx, cy) を動かさずに倍率を k から next へ変えたときの表示位置 */
export const zoomAround = (t: { tx: number; ty: number; k: number }, next: number, cx: number, cy: number) => ({
  k: next,
  tx: cx - (cx - t.tx) * (next / t.k),
  ty: cy - (cy - t.ty) * (next / t.k),
})

export type Box = { x: number; y: number; w: number; h: number }

/**
 * ミニマップの線。親の箱から子の箱へ直角に折れる線を引く。
 * rail は親の左寄りの縦線から横に入る形（下に縦に積んだ子）、それ以外は親の下辺の中央から下りて子の上辺の中央へ入る形
 */
export function edgePath(p: Box, c: Box, rail: boolean, f: (v: number) => string = (v) => v.toFixed(1)): string {
  if (rail) {
    const x = c.x - 13
    const y = c.y + Math.min(22, c.h / 2)
    return `M${f(x)} ${f(p.y + p.h)}V${f(y)}H${f(c.x)}`
  }
  const px = p.x + p.w / 2
  const cx = c.x + c.w / 2
  const pb = p.y + p.h
  const mid = (pb + c.y) / 2
  return `M${f(px)} ${f(pb)}V${f(mid)}H${f(cx)}V${f(c.y)}`
}
