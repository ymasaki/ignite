// 顔アイコンとアイコンの箱。見た目は styles/components/avatar.css。
// 業務のデータ（人の型など）は受け取らず、頭文字・画像の URL・色の番号などの素の値で描く。

import { useState, type ReactNode } from 'react'

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
