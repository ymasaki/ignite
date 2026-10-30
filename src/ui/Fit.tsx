// 大きさに合わせて詰める段階を選ぶ（DESIGN.md 5 章「大きさが変わったときの調整」）。見た目は styles/components/layout.css の .fit-measure。

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** 置き場所の幅 avail に入る最初の段階（widths は段階ごとの幅、詰めていない順）。どれも入らなければ最後の段階 */
export function pickFitStep(avail: number, widths: number[]): number {
  const i = widths.findIndex((w) => w <= avail)
  return i < 0 ? Math.max(0, widths.length - 1) : i
}

/**
 * 詰める段階（steps。詰めていない順）ごとに見えない写しを置いて幅を測り、置き場所（写しの親）に入る最初の段階を返す。
 * 返した measure は置き場所の中に置く。写しで測るので、詰めている途中の幅に引きずられて段階が行き来しない。
 * 帯のように複数の部品を並べるところで、部品をまたいだ落とす順番（補足 → 件数 → 余白 → 短いラベル）を 1 つに決めるときに使う
 */
export function useFitStep(steps: ReactNode[]): { step: number; measure: ReactNode } {
  const ref = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  useLayoutEffect(() => {
    const m = ref.current
    const box = m?.parentElement
    if (!m || !box) return
    const place = () => {
      const cs = getComputedStyle(box)
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      setStep(pickFitStep(avail, [...m.children].map((c) => (c as HTMLElement).offsetWidth)))
    }
    place()
    // 通知の中で段階を変えると大きさが変わって通知が重なる（ResizeObserver loop）ので、次の描画で決める
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    })
    ro.observe(box)
    for (const c of m.children) ro.observe(c)
    return () => (ro.disconnect(), cancelAnimationFrame(frame))
  }, [steps.length])
  const measure = (
    <div className="fit-measure" aria-hidden="true" inert ref={ref}>
      {steps.map((s, i) => (
        <div key={i}>{s}</div>
      ))}
    </div>
  )
  return { step, measure }
}

/**
 * 詰める順番を宣言する帯（DESIGN.md 5 章「決め方」3）。steps は詰めていない順の設定（部品の修飾の組み合わせ）、children は設定から中身を
 * 描く関数（measuring は見えない写しを描くとき。写しでは ref を付けない・2 段目に落ちた部品だけを描く、などに使う）。
 * 置き場所（この部品を置いた親）の幅に入る最初の設定で描く。帯の配置（並べ方・余白）は置き場所の CSS に任せる
 */
export function FitBar<S>({ steps, children }: { steps: S[]; children: (step: S, measuring: boolean) => ReactNode }) {
  const { step, measure } = useFitStep(steps.map((s) => children(s, true)))
  return (
    <>
      {children(steps[step], false)}
      {measure}
    </>
  )
}
