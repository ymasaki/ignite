// 大きさを測る処理の置きどころをそろえる。測る（読む）と書くを交互に行うと、読むたびにブラウザがレイアウトを計算し直すので、
// 部品が多い画面では部品の数だけ計算が走る。読むのをレイアウトが済んだあとに回す・読むのを先にまとめる、の 2 つで避ける。

/**
 * このあと描かれるフレームのレイアウトが済んでから cb を呼ぶ（中身が変わった直後に測ると、その場でレイアウトの計算を強いるため）。
 * 返した関数で取り消す。裏のタブでは描画が止まるので、表に戻ったときに呼ばれる
 */
export function afterLayout(cb: () => void): () => void {
  let timer = 0
  const frame = requestAnimationFrame(() => (timer = window.setTimeout(cb, 0)))
  return () => (cancelAnimationFrame(frame), window.clearTimeout(timer))
}

const reads: (() => (() => void) | void)[] = []
const flush = () => {
  // 先にすべて測ってから、まとめて書く
  const writes = reads.splice(0).map((read) => read())
  for (const write of writes) write?.()
}

/**
 * 同じ描画の中で頼まれた read（測る処理）を先にすべて呼び、read が返した書き込みをそのあとでまとめて行う。
 * 描画の直後・画面に出る前に動く。多数の部品が一度に描かれても、レイアウトの計算は 1 回で済む
 */
export function measureThenWrite(read: () => (() => void) | void) {
  if (reads.push(read) === 1) queueMicrotask(flush)
}
