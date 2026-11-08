import { useId, type ReactNode } from 'react'

// Ignite のロゴの形（docs/logo/ignite-mark.svg と同じ形）
const FLAME = 'M31.69 4C29.58 7.22 28.58 11.67 29.47 16.11C30.25 21.11 34.58 24.72 38.47 26.22C41.25 27.33 44.03 28.89 45.81 31.56C46.92 26.11 46.25 20 44.14 15.33C49.58 21.67 52.47 28.33 52.36 35.56C52.25 42.78 49.03 47.22 44.03 52.78C43.92 47.22 42.64 38.33 37.47 33.61C39.25 37.22 39.58 43.89 38.47 48.89C37.64 52.22 35.14 55.56 32.08 59.33C26.81 60.44 22.36 60 18.47 57.78C14.03 55 11.53 49.44 11.58 43.89C11.69 36.67 14.03 31.11 17.47 24.72C16.58 31.67 16.25 40 18.47 45C20.42 49.17 24.86 51.67 29.03 51.28C30.03 47.22 30.03 42.78 28.58 37.78C27.08 33.33 23.47 28.33 23.36 21.67C23.36 15 26.81 9.44 31.69 4Z'

// `.brand-mark` が `--pri` で塗るのでスキンに従う
export const LOGO = (
  <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <path fill="currentColor" d={FLAME} />
  </svg>
)

/**
 * 概要の先頭に置く、動くロゴ（#64 の D「熱の流れ」）。
 * 止まった形は LOGO と同じ。その上に、炎の形で切り抜いた熱の面（根元は主要色・先端は黄）・火の粉・文字の光を重ね、
 * 動いてよいときだけ出す（catalog.css の .cat-logo）。文字の光は飾りの写しに付け、本物の文字の色は変えない。
 * children は名前の後ろに並べる（概要では版の札）
 */
export function HeroLogo({ children }: { children?: ReactNode }) {
  const id = useId()
  const clip = `${id}-clip`
  const heat = `${id}-heat`
  return (
    <div className="cat-hero-brand cat-logo">
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <clipPath id={clip}><path d={FLAME} /></clipPath>
          <linearGradient id={heat} x1="0" y1="64" x2="0" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="reflect">
            <stop className="cat-logo-s0" offset="0" />
            <stop className="cat-logo-s0" offset=".45" />
            <stop className="cat-logo-s1" offset=".75" />
            <stop className="cat-logo-s2" offset="1" />
          </linearGradient>
        </defs>
        <path fill="currentColor" d={FLAME} />
        <g className="cat-logo-fx" clipPath={`url(#${clip})`}>
          <rect className="cat-logo-heat" x="0" y="-40" width="64" height="120" fill={`url(#${heat})`} />
        </g>
        <g className="cat-logo-fx">
          <circle className="cat-logo-ember" cx="40" cy="12" r="1.8" />
          <circle className="cat-logo-ember" cx="31" cy="8" r="1.5" />
          <circle className="cat-logo-ember" cx="46" cy="22" r="1.3" />
        </g>
      </svg>
      <span className="cat-hero-name" data-text="Ignite">Ignite</span>
      {children}
    </div>
  )
}
