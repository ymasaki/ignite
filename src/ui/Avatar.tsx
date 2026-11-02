// 顔アイコンとアイコンの箱。見た目は styles/components/avatar.css。
// 業務のデータ（人の型など）は受け取らず、頭文字・画像の URL・色の番号などの素の値で描く。

import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { fitAvatars, keepVisible, pressOverlap } from './avatarFit'

/** 顔アイコンの大きさ: xs 20 / sm 26 / md 32 / lg 44 / xl 72px */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
/** 写真がないときの頭文字の地の色（c1〜c6。見分けるための例外の 6 色） */
export type AvatarTone = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6'

/**
 * 顔アイコン。写真（src）が無い・読めないときは頭文字（initial）を出す。
 * 写真を読み込んでいるあいだは淡い丸（.wait）にしておき、読み込めたら写真をフェードインさせる（.ok）
 */
export function Avatar({ initial, src, tone = 'c1', size = 'md' }: { initial: string; src?: string | null; tone?: AvatarTone | string; size?: AvatarSize }) {
  // 読み込めた・読めなかった写真の URL（写真が替わったら読み込み中に戻る）
  const [loaded, setLoaded] = useState<string | null>(null)
  const [broken, setBroken] = useState<string | null>(null)
  const url = src && broken !== src ? src : null
  const ok = url != null && loaded === url
  return (
    <span className={`av ${size} ${tone} ${url && !ok ? 'wait' : ''}`} aria-hidden="true">
      {initial}
      {url && (
        <img
          className={ok ? 'ok' : ''}
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          // キャッシュにあってすぐ読み込み済みのときは load を待たずに出す
          ref={(el) => { if (el?.complete && el.naturalWidth && loaded !== url) setLoaded(url) }}
          onLoad={() => setLoaded(url)}
          onError={() => setBroken(url)}
        />
      )}
    </span>
  )
}

/** アイコンの箱の大きさ: md 28 / lg 40 / xl 72px */
export type IconBoxSize = 'md' | 'lg' | 'xl'

/** アイコンを入れる角丸の箱。人以外の見出し・一覧の行の先頭に使う */
export function IconBox({ size = 'md', children }: { size?: IconBoxSize; children: ReactNode }) {
  return <span className={`ico ${size}`}>{children}</span>
}

/**
 * 顔アイコンの並び。ホバーで tip（名前など）を出す。stack は少し重ねて 1 行に、既定は折り返して並べる。
 * max を超えた分は「+N」にまとめる。muted は薄く出す（今はいない・外れた、など）。
 * 読み上げには label を名前にした一覧で、顔ごとに tip を読ませる（「+N」は「ほか N 名」）
 */
export function AvatarGroup({ items, size = 'sm', stack = false, max, muted = false, label }: {
  items: { key: string; initial: string; src?: string | null; tone?: AvatarTone | string; tip: string }[]; size?: AvatarSize; stack?: boolean; max?: number; muted?: boolean; label: string
}) {
  const shown = max != null && items.length > max ? items.slice(0, max) : items
  return (
    <span className={`avgroup${stack ? ' stack' : ''}${muted ? ' muted' : ''}`} role="list" aria-label={label}>
      {shown.map((it) => <span key={it.key} className="avg-i" role="listitem" data-tip={it.tip}><Avatar initial={it.initial} src={it.src} tone={it.tone} size={size} /><span className="sr-only">{it.tip}</span></span>)}
      {shown.length < items.length && <span className="avg-more num" role="listitem"><span aria-hidden="true">+{items.length - shown.length}</span><span className="sr-only">ほか {items.length - shown.length} 名</span></span>}
    </span>
  )
}

// 顔アイコンの大きさ（px。avatar.css の .av と合わせる）と、「+N」の幅の目安（前の余白 8px ＋ 12px の等幅数字 1 字 7px）
const AVATAR_PX: Record<AvatarSize, number> = { xs: 20, sm: 26, md: 32, lg: 44, xl: 72 }
const moreWidth = (rest: number) => 8 + 7 * (String(rest).length + 1)

/**
 * 顔アイコンを重ねて並べる（押せる顔の列）。顔は render で描く（写真の扱いなどはアプリのアダプタに任せる）。max を超えた分は「+N」。
 * onPick を渡すと 1 つずつ押せるボタンになり、吹き出しは tip、読み上げ名は label（既定は tip）。
 * fit では置き場所の幅に合わせ、間を空けて並べ → 収まらなければ重ね → それでも 1 行を超えるなら「+N」にする。
 * fit と max を両方渡すと、いつも重ねて max 個までにし、幅に入らなければさらに絞る。押せる顔は押せる範囲 24px を残す分だけ重ねる。activeId の顔は印を付け、「+N」に隠さない
 */
export function AvatarStack<T extends { id: string }>({ items, render, tip, label, size = 'sm', max, onPick, fit = false, activeId }: {
  items: T[]; render: (item: T, size: AvatarSize) => ReactNode; tip: (item: T) => string; label?: (item: T) => string; size?: AvatarSize; max?: number; onPick?: (item: T) => void; fit?: boolean; activeId?: string | null
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!fit || !el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])
  const overlap = onPick ? pressOverlap(AVATAR_PX[size]) : undefined
  const layout = fit && width != null ? fitAvatars(items.length, width, AVATAR_PX[size], moreWidth, overlap) : null
  const limit = layout ? Math.min(layout.shown, max ?? Infinity) : max
  // max があるときは、幅に合わせて間を変えず、いつもの重なりで並べる（間の変数を渡さない）
  const gap = layout && max == null ? layout.gap : overlap != null ? -overlap : null
  const list = limit != null ? keepVisible(items, limit, activeId) : items
  const shown = limit != null ? list.slice(0, limit) : list
  const rest = items.length - shown.length
  return (
    <span className={`avstack ${size}${fit ? ' fit' : ''}`} ref={ref} style={gap != null ? ({ '--av-gap': `${gap}px` } as CSSProperties) : undefined}>
      {shown.map((it) =>
        onPick ? (
          <button key={it.id} type="button" aria-label={label?.(it) ?? tip(it)} aria-current={it.id === activeId || undefined} data-tip={tip(it)} onClick={() => onPick(it)}>
            {render(it, size)}
          </button>
        ) : (
          <Fragment key={it.id}>{render(it, size)}</Fragment>
        ),
      )}
      {rest > 0 && <span className="more num">+{rest}</span>}
    </span>
  )
}
