// キャンバス: ドラッグ・ホイール・ピンチで動かし、拡大縮小する面。右下にミニマップ（縮図と今見えている範囲の枠）、左下に拡大縮小のボタン。
// 中身は何でもよい。中身の要素に data-node="id" を付けると、ミニマップに箱として出し、centerOn・hold で位置を合わせられる。
// data-parent="親の id" で線を、data-edge="rail" で縦に積んだ子の線（親の左の縦線から入る）を、data-on で強調をミニマップにも出す。
// 移動・拡大縮小は描き直しを起こさないよう、ref で transform を直接書き換える。見た目は styles/components/canvas.css

import { IconFocusCentered, IconMinus, IconPlus } from '@tabler/icons-react'
import { createContext, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from 'react'

import { IconButton, LinkButton } from './Button'
import { clampPos, clampZoom, edgePath, fitScale, glideEase, glideMs, keepInside, nextZoomStep, zoomAround, type Box } from './canvasGeometry'
import { reducedMotion } from './Motion'

// 表示位置のアニメーションの長さ（canvas.css の .canvas-stage.anim と合わせる）
const ANIM_MS = 350
// 押した節を残す長さ（詳細パネルが開いて表示領域が狭くなるまで）
const PRESS_HOLD_MS = 700
// 選んだ節へ運ぶ途中で行き先が変わったとき、新しい行き先へ追いつく速さ（時定数）
const GLIDE_FOLLOW_MS = 70
// この倍率より小さいと、節は名前だけの縮小表示（.canvas-stage.lod）
const LOD_BELOW = 0.4
// ミニマップの大きさ（canvas.css の .canvas-map と合わせる）と、箱どうしの隙間を残す内側の余白
const MAP_W = 200
const MAP_H = 118
const MAP_INSET = 0.6

/** キャンバスの操作。apiRef か useCanvas() で受け取る */
export interface CanvasApi {
  /** ＋－の段階で拡大縮小する（20〜150%） */
  zoomStep: (dir: 1 | -1) => void
  /** 倍率 k（1 = 100%）にする。中央を保つ */
  zoomTo: (k: number) => void
  /** 全体が入る倍率にする */
  fit: () => void
  /** 既定の位置（start）へ戻す */
  home: () => void
  /** data-node="id" の要素を表示領域の中央（縦は上から 1/3）へ運ぶ。遠いほど少し長く動く */
  centerOn: (id: string, anim?: boolean) => void
  /** data-node="id" の要素の画面上の位置を ms のあいだ保つ（開閉で中身の大きさが変わる前に呼ぶ） */
  hold: (id: string, ms?: number) => void
  /** 直前の押す操作がドラッグだったか（ドラッグのあとのクリックは中身に届かない。独自に判定するとき用） */
  moved: () => boolean
}

const CanvasContext = createContext<CanvasApi | null>(null)
/** Canvas の中の部品から操作を受け取る（Canvas の外では null） */
export const useCanvas = () => useContext(CanvasContext)

type T = { tx: number; ty: number; k: number }
type MapRect = Box & { id: string; on: boolean }
type MapData = { rects: MapRect[]; edges: string; s: number; ox: number; oy: number }
const EMPTY_MAP: MapData = { rects: [], edges: '', s: 1, ox: 0, oy: 0 }

/** 倍率の % を、拡大縮小のボタンの表示だけに知らせる（キャンバス全体を描き直さないため） */
function pctStore() {
  let v = 100
  const ls = new Set<() => void>()
  return {
    get: () => v,
    set: (n: number) => {
      if (n === v) return
      v = n
      ls.forEach((l) => l())
    },
    sub: (l: () => void) => (ls.add(l), () => void ls.delete(l)),
  }
}

/**
 * ドラッグ・ホイール・ピンチで動かし、拡大縮小する面（図・ツリーなど、表示領域より大きな中身）。
 * - start: 最初の位置。top は 100% で中身の先頭の節（なければ中身）を上部中央に、fit は全体が入る倍率
 * - 動かすまでは、表示領域や中身の大きさが変わるたびに最初の位置へ置き直す
 * - ホイールは移動、⌘ / Ctrl ＋ホイールとピンチは拡大縮小。動かせるのは中身全体＋少しの余白まで
 * - 中身の節を押すと、詳細パネルが開いて表示領域が狭くなっても押した節をその場に残す
 * - Tab で表示領域の外の要素へ移ったら、見えるところまで最小だけ動かす
 * - minimap: 右下の縮図（枠の幅が 600px 未満では出さない）。controls: 左下の拡大縮小のボタン（タッチの端末では出さない）
 */
export function Canvas({
  label,
  start = 'top',
  minimap = true,
  controls = true,
  height,
  apiRef,
  children,
}: {
  label: string
  start?: 'top' | 'fit'
  minimap?: boolean
  controls?: boolean
  /** 高さ（px）。省略時は置き場所の高さいっぱい */
  height?: number
  apiRef?: Ref<CanvasApi>
  children: ReactNode
}) {
  const vpRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const mapVpRef = useRef<SVGRectElement>(null)
  const t = useRef<T>({ tx: 0, ty: 0, k: 1 })
  const moved = useRef(false)
  const atHome = useRef(false)
  const vpFrame = useRef(0)
  const map = useRef<MapData>(EMPTY_MAP)
  const setMap = useRef<(m: MapData) => void>(() => {})
  // 画面上の位置を保つ節（開閉・押した直後）。中身や表示領域の大きさが変わるたびに、この節が動かないよう置き直す
  const held = useRef<{ id: string; left: number; top: number; until: number; clamp?: boolean } | null>(null)
  // 選んだ節へ表示位置を運んでいる途中（centerOn）。利用者が動かしたら止める
  const glide = useRef<{ frame: number } | null>(null)
  const pct = useMemo(pctStore, [])

  const { api, inner } = useMemo(() => {
    const stopGlide = () => {
      if (glide.current) cancelAnimationFrame(glide.current.frame)
      glide.current = null
    }
    /** 画面上の実際の変形。拡大縮小・移動のアニメーション中は目標値（t）ではなく途中の値になる */
    const liveT = (): T => {
      const s = stageRef.current
      const tf = s ? getComputedStyle(s).transform : 'none'
      if (!s || tf === 'none' || !tf) return t.current
      const m = new DOMMatrixReadOnly(tf)
      return { k: m.a, tx: m.e, ty: m.f }
    }
    const drawMapVp = () => {
      const v = mapVpRef.current
      const vp = vpRef.current
      if (!v || !vp) return
      const { s, ox, oy } = map.current
      const r = vp.getBoundingClientRect()
      const { tx, ty, k } = liveT()
      v.setAttribute('x', String(ox + (-tx / k) * s))
      v.setAttribute('y', String(oy + (-ty / k) * s))
      v.setAttribute('width', String(Math.max(4, (r.width / k) * s)))
      v.setAttribute('height', String(Math.max(4, (r.height / k) * s)))
    }
    const clampToContent = () => {
      const vp = vpRef.current
      const s = stageRef.current
      if (!vp || !s) return
      const r = vp.getBoundingClientRect()
      const { k } = t.current
      t.current.tx = clampPos(t.current.tx, s.offsetWidth * k, r.width)
      t.current.ty = clampPos(t.current.ty, s.offsetHeight * k, r.height)
    }
    /** 目標の変形を画面に書く。clamp: 動かせる範囲に収める（運ぶ途中は行き先だけを収める） */
    const apply = (anim: boolean, clamp = true) => {
      const s = stageRef.current
      if (!s) return
      if (clamp) clampToContent()
      const { tx, ty, k } = t.current
      s.classList.toggle('anim', anim)
      s.style.transform = `translate(${tx}px,${ty}px) scale(${k})`
      s.classList.toggle('lod', k < LOD_BELOW)
      // アニメーションする間は、ミニマップの枠もフレームごとに追いかける
      cancelAnimationFrame(vpFrame.current)
      if (anim) {
        const until = performance.now() + ANIM_MS + 60
        const tick = () => {
          drawMapVp()
          if (performance.now() < until) vpFrame.current = requestAnimationFrame(tick)
        }
        vpFrame.current = requestAnimationFrame(tick)
      }
      pct.set(Math.round(k * 100))
      drawMapVp()
    }
    const nodeEl = (id: string) => stageRef.current?.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`) ?? null
    /** 要素の、中身（stage）の上での位置と大きさ（倍率を割り戻す） */
    const localRect = (el: Element): Box => {
      const st = stageRef.current!
      const s = st.getBoundingClientRect()
      const e = el.getBoundingClientRect()
      const k = st.offsetWidth ? s.width / st.offsetWidth : liveT().k
      return { x: (e.left - s.left) / k, y: (e.top - s.top) / k, w: e.width / k, h: e.height / k }
    }
    const zoomAt = (f: number, cx: number, cy: number, anim: boolean) => {
      atHome.current = false
      held.current = null
      stopGlide()
      t.current = zoomAround(t.current, clampZoom(t.current.k * f), cx, cy)
      apply(anim)
    }
    const fit = (anim = true) => {
      const vp = vpRef.current
      const s = stageRef.current
      if (!vp || !s) return
      stopGlide()
      atHome.current = false
      const r = vp.getBoundingClientRect()
      const b = { w: s.offsetWidth || 1, h: s.offsetHeight || 1 }
      const k = fitScale({ w: r.width, h: r.height }, b)
      t.current = { k, tx: Math.max(0, (r.width - b.w * k) / 2), ty: Math.max(0, (r.height - b.h * k) / 2) }
      apply(anim)
    }
    /** 既定の位置。top: 100% で先頭の節（なければ中身）を上部中央に */
    const home = () => {
      const vp = vpRef.current
      const s = stageRef.current
      if (!vp || !s) return
      if (start === 'fit') {
        fit(false)
        atHome.current = true
        return
      }
      stopGlide()
      const r = vp.getBoundingClientRect()
      t.current = { k: 1, tx: 0, ty: 0 }
      apply(false) // 位置を測る前に倍率を 1 に戻す
      const top = s.querySelector('[data-node]')
      const e = top ? localRect(top) : { x: 0, y: 0, w: s.offsetWidth, h: 0 }
      t.current = { k: 1, tx: r.width / 2 - (e.x + e.w / 2), ty: top ? 24 - e.y : 0 }
      apply(false)
      atHome.current = true
    }
    /** 位置を保つ節が、覚えた画面上の位置に来るように動かす */
    const reHold = () => {
      const h = held.current
      if (!h) return
      if (performance.now() > h.until) return void (held.current = null)
      const el = nodeEl(h.id)
      if (!el) return
      const now = el.getBoundingClientRect()
      let left = h.left
      // 押した節は、表示領域が狭くなって隠れるなら、見えるところまでだけずらす
      const vr = vpRef.current?.getBoundingClientRect()
      if (h.clamp && vr) left = keepInside(left, now.width, vr.left, vr.right)
      t.current.tx += left - now.left
      t.current.ty += h.top - now.top
      apply(false)
    }
    const hold = (id: string, ms = 600, clamp = false) => {
      const el = nodeEl(id)
      if (!el) return
      const r = el.getBoundingClientRect()
      atHome.current = false
      stopGlide()
      held.current = { id, left: r.left, top: r.top, until: performance.now() + ms, clamp }
    }
    /** 節を表示領域の中央（縦は上から 1/3）に置く表示位置。倍率は k */
    const centerAt = (id: string, k: number): T | null => {
      const vp = vpRef.current
      const el = nodeEl(id)
      if (!vp || !el) return null
      const r = vp.getBoundingClientRect()
      const e = localRect(el)
      return { k, tx: r.width / 2 - (e.x + e.w / 2) * k, ty: r.height / 3 - (e.y + e.h / 2) * k }
    }
    /**
     * 節を中央へ運ぶ。運ぶ間にも詳細パネルの出現や開閉で表示領域・節の位置が変わるので、
     * CSS の transition に任せず、フレームごとに行き先を測り直して近づける
     */
    const centerOn = (id: string, anim = true) => {
      stopGlide()
      const k = Math.max(t.current.k, 0.85)
      const to = centerAt(id, k)
      if (!to) return
      atHome.current = false
      held.current = null
      const from = { ...liveT() }
      t.current = to
      if (!anim || reducedMotion()) return apply(false)
      clampToContent()
      const dur = glideMs(Math.hypot(t.current.tx - from.tx, t.current.ty - from.ty))
      t.current = from
      const begin = performance.now()
      const g = { frame: 0 }
      let aim: T | null = null
      let last = begin
      const step = (now: number) => {
        if (glide.current !== g) return
        const at = centerAt(id, k)
        if (!at) return void (glide.current = null)
        // 行き先は動かせる範囲に収め、途中の位置は収めない（範囲の外から始めると途中で押し戻されて飛ぶため）
        t.current = at
        clampToContent()
        const raw = t.current
        const f = aim ? 1 - Math.exp(-(now - last) / GLIDE_FOLLOW_MS) : 1
        aim = aim ? { k: raw.k, tx: aim.tx + (raw.tx - aim.tx) * f, ty: aim.ty + (raw.ty - aim.ty) * f } : raw
        last = now
        const p = Math.min(1, (now - begin) / dur)
        const e = glideEase(p)
        t.current = { k: from.k + (aim.k - from.k) * e, tx: from.tx + (aim.tx - from.tx) * e, ty: from.ty + (aim.ty - from.ty) * e }
        const done = p >= 1 && (Math.hypot(raw.tx - aim.tx, raw.ty - aim.ty) < 0.5 || now - begin > dur + 400)
        apply(false, done)
        if (done) glide.current = null
        else g.frame = requestAnimationFrame(step)
      }
      glide.current = g
      g.frame = requestAnimationFrame(step)
    }
    /** ミニマップの中身を測り直す（data-node の箱・data-parent の線・data-on の強調） */
    const measure = () => {
      const s = stageRef.current
      if (!s) return
      const b = { w: s.offsetWidth || 1, h: s.offsetHeight || 1 }
      const sc = Math.min(MAP_W / b.w, MAP_H / b.h) * 0.9
      const ox = (MAP_W - b.w * sc) / 2
      const oy = (MAP_H - b.h * sc) / 2
      const els = [...s.querySelectorAll<HTMLElement>('[data-node]')]
      const boxes = new Map<string, Box>()
      const rects = els.map((el) => {
        const r = localRect(el)
        const id = el.dataset.node!
        if (!boxes.has(id)) boxes.set(id, r)
        return { id, on: el.hasAttribute('data-on'), ...r }
      })
      const X = (v: Box): Box => ({ x: ox + v.x * sc, y: oy + v.y * sc, w: v.w * sc, h: v.h * sc })
      const edges = els
        .map((el, i) => {
          const p = el.dataset.parent && boxes.get(el.dataset.parent)
          return p ? edgePath(X(p), X(rects[i]), el.dataset.edge === 'rail') : ''
        })
        .join('')
      map.current = { rects, edges, s: sc, ox, oy }
      setMap.current(map.current)
      drawMapVp()
    }
    const api: CanvasApi = {
      zoomStep: (dir: 1 | -1) => {
        const next = nextZoomStep(Math.round(t.current.k * 100), dir)
        const r = vpRef.current?.getBoundingClientRect()
        if (next && r) zoomAt(next / 100 / t.current.k, r.width / 2, r.height / 2, true)
      },
      zoomTo: (k: number) => {
        const r = vpRef.current?.getBoundingClientRect()
        if (r) zoomAt(k / t.current.k, r.width / 2, r.height / 2, true)
      },
      fit: () => fit(true),
      home,
      centerOn,
      hold: (id: string, ms?: number) => hold(id, ms),
      moved: () => moved.current,
    }
    // inner は部品の中だけで使う
    return { api, inner: { apply, zoomAt, reHold, hold, measure, drawMapVp, stopGlide } }
    // start は最初の位置の決め方なので、途中で変えても作り直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useImperativeHandle(apiRef, () => api, [api])

  // 最初の位置。表示領域の大きさが決まるのを待つ
  useLayoutEffect(() => {
    let n = 0
    let timer = 0
    const tryHome = () => {
      const vp = vpRef.current
      if (vp && vp.getBoundingClientRect().width < 100 && n++ < 20) {
        timer = window.setTimeout(tryHome, 50)
        return
      }
      api.home()
      inner.measure()
    }
    tryHome()
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 大きさの変化（表示領域: 詳細パネルの開閉・窓の幅、中身: 開閉・画像の読み込み）と、中身の入れ替わり・強調の変化
  useEffect(() => {
    const vp = vpRef.current
    const stage = stageRef.current
    if (!vp || !stage) return
    let frame = 0
    const remeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(inner.measure)
    }
    const ro = new ResizeObserver(() => {
      // 運んでいる途中は、運ぶ側がフレームごとに行き先を測り直す
      if (!glide.current) {
        if (atHome.current) api.home()
        else inner.reHold()
      }
      remeasure()
    })
    ro.observe(vp)
    ro.observe(stage)
    const mo = new MutationObserver(remeasure)
    mo.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-node', 'data-parent', 'data-on'] })
    return () => (ro.disconnect(), mo.disconnect(), cancelAnimationFrame(frame))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab で表示領域の外の要素へ移ったら、見えるところまで最小だけ動かす（WCAG 2.4.11。中身は transform で動かすので、
  // ブラウザは見える位置へ運べず、代わりに枠をスクロールしてミニマップとずれる。そのスクロールは戻す）
  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      // キーボードで移ったときだけ（マウスで押したときに動かすと、押している途中で位置がずれてクリックが外れる）
      if (!stageRef.current?.contains(el) || !el.matches(':focus-visible')) return
      vp.scrollLeft = 0
      vp.scrollTop = 0
      const r = vp.getBoundingClientRect()
      const b = el.getBoundingClientRect()
      const M = 24
      const dx = b.left < r.left + M ? r.left + M - b.left : b.right > r.right - M ? r.right - M - b.right : 0
      const dy = b.top < r.top + M ? r.top + M - b.top : b.bottom > r.bottom - M ? r.bottom - M - b.bottom : 0
      if (!dx && !dy) return
      atHome.current = false
      held.current = null
      inner.stopGlide()
      t.current.tx += dx
      t.current.ty += dy
      inner.apply(!reducedMotion())
    }
    vp.addEventListener('focusin', onFocus)
    return () => vp.removeEventListener('focusin', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ドラッグ・ホイール・ピンチ
  useEffect(() => {
    const vp = vpRef.current!
    let drag: { x: number; y: number; tx: number; ty: number; id: number } | null = null
    // 2 本指のピンチで拡大縮小。指の中点を中心に、中点の移動で動かす
    const pts = new Map<number, { x: number; y: number }>()
    let pinch: { d: number; x: number; y: number } | null = null
    const pinchNow = () => {
      const [a, b] = [...pts.values()]
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.canvas-map,.canvas-ctrl')) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) {
        drag = null
        pinch = pinchNow()
        moved.current = true
        return
      }
      inner.stopGlide()
      drag = { x: e.clientX, y: e.clientY, tx: t.current.tx, ty: t.current.ty, id: e.pointerId }
      moved.current = false
    }
    const move = (e: PointerEvent) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && pts.size === 2) {
        const p = pinchNow()
        const r = vp.getBoundingClientRect()
        t.current.tx += p.x - pinch.x
        t.current.ty += p.y - pinch.y
        inner.zoomAt(p.d / pinch.d, p.x - r.left, p.y - r.top, false)
        pinch = p
        return
      }
      if (!drag) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (!moved.current && Math.hypot(dx, dy) > 4) {
        moved.current = true
        vp.classList.add('drag')
        try {
          vp.setPointerCapture(drag.id)
        } catch {
          // 取れなくてもドラッグは続けられる
        }
      }
      if (moved.current) {
        atHome.current = false
        held.current = null
        t.current.tx = drag.tx + dx
        t.current.ty = drag.ty + dy
        inner.apply(false)
      }
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = null
      drag = null
      vp.classList.remove('drag')
      setTimeout(() => (moved.current = false), 0)
    }
    // ドラッグのあとのクリックは中身に届けない。節を押したら、詳細パネルが開いてもその節をその場に残す
    const click = (e: MouseEvent) => {
      if (moved.current) {
        e.stopPropagation()
        e.preventDefault()
        return
      }
      const node = (e.target as HTMLElement).closest<HTMLElement>('[data-node]')
      if (node && stageRef.current?.contains(node)) inner.hold(node.dataset.node!, PRESS_HOLD_MS, true)
    }
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.canvas-map,.canvas-ctrl')) return
      e.preventDefault()
      const r = vp.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) inner.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top, false)
      else {
        atHome.current = false
        held.current = null
        inner.stopGlide()
        t.current.tx -= e.deltaX
        t.current.ty -= e.deltaY
        inner.apply(false)
      }
    }
    const resize = () => inner.drawMapVp()
    vp.addEventListener('pointerdown', down)
    vp.addEventListener('pointermove', move)
    vp.addEventListener('pointerup', up)
    vp.addEventListener('pointercancel', up)
    vp.addEventListener('click', click, true)
    vp.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('resize', resize)
    return () => {
      vp.removeEventListener('pointerdown', down)
      vp.removeEventListener('pointermove', move)
      vp.removeEventListener('pointerup', up)
      vp.removeEventListener('pointercancel', up)
      vp.removeEventListener('click', click, true)
      vp.removeEventListener('wheel', wheel)
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <CanvasContext.Provider value={api}>
      <div className="canvas" ref={vpRef} role="region" aria-label={label} style={height ? { height } : undefined}>
        <div className="canvas-stage" ref={stageRef}>
          {children}
        </div>
        {minimap && (
          <CanvasMap
            setRef={setMap}
            vpRef={vpRef}
            mapVpRef={mapVpRef}
            t={t}
            onPan={(tx, ty, anim) => {
              atHome.current = false
              held.current = null
              t.current.tx = tx
              t.current.ty = ty
              inner.apply(anim)
            }}
          />
        )}
        {controls && <CanvasControls api={api} pct={pct} />}
      </div>
    </CanvasContext.Provider>
  )
}

/** 左下の拡大縮小のボタン。倍率の表示を押すと 100% に戻す */
function CanvasControls({ api, pct }: { api: CanvasApi; pct: ReturnType<typeof pctStore> }) {
  const v = useSyncExternalStore(pct.sub, pct.get, pct.get)
  return (
    <div className="canvas-ctrl" role="group" aria-label="拡大縮小">
      <IconButton label="縮小" disabled={!nextZoomStep(v, -1)} onClick={() => api.zoomStep(-1)}>
        <IconMinus size={16} stroke={1.8} />
      </IconButton>
      <LinkButton className="canvas-pct num" aria-label={`倍率 ${v}%。100% に戻す`} data-tip="100% に戻す" onClick={() => api.zoomTo(1)}>
        {v}%
      </LinkButton>
      <IconButton label="拡大" disabled={!nextZoomStep(v, 1)} onClick={() => api.zoomStep(1)}>
        <IconPlus size={16} stroke={1.8} />
      </IconButton>
      <IconButton label="全体を表示" onClick={() => api.fit()}>
        <IconFocusCentered size={16} stroke={1.8} />
      </IconButton>
    </div>
  )
}

/**
 * ミニマップ。今見えている範囲の枠（mapVpRef）は Canvas が変形に合わせて直接書く（描き直しを起こさないため）。
 * 中身は測り直すたびに setRef で受け取る。枠をドラッグ・枠の外を押すと、表示位置（tx, ty）を onPan で返す
 */
function CanvasMap({
  setRef,
  vpRef,
  mapVpRef,
  t,
  onPan,
}: {
  setRef: { current: (m: MapData) => void }
  vpRef: { current: HTMLDivElement | null }
  mapVpRef: Ref<SVGRectElement>
  t: { current: T }
  onPan: (tx: number, ty: number, anim: boolean) => void
}) {
  const [m, setM] = useState(EMPTY_MAP)
  useLayoutEffect(() => {
    setRef.current = setM
  }, [setRef])
  return (
    <svg
      className="canvas-map"
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      // マウスの補助（キーボードでは中身を Tab で移ると見える位置へ動く）。読み上げからは外す
      aria-hidden="true"
      onPointerDown={(e) => {
        e.stopPropagation()
        const svg = e.currentTarget
        const vp = vpRef.current
        if (!vp) return
        const b = svg.getBoundingClientRect()
        const vr = vp.getBoundingClientRect()
        // 表示上の大きさと viewBox の比（CSS で大きさを変えても合うように）
        const u = b.width / MAP_W || 1
        const toStage = (cx: number, cy: number) => ({ x: ((cx - b.left) / u - m.ox) / m.s, y: ((cy - b.top) / u - m.oy) / m.s })
        const k = t.current.k
        const center = { x: (vr.width / 2 - t.current.tx) / k, y: (vr.height / 2 - t.current.ty) / k }
        const half = { w: vr.width / k / 2, h: vr.height / k / 2 }
        const p0 = toStage(e.clientX, e.clientY)
        const inside = Math.abs(p0.x - center.x) <= half.w && Math.abs(p0.y - center.y) <= half.h
        // 枠の中をつかんだら、つかんだ位置を保ったまま動かす。枠の外を押したらそこへ移り、そのままドラッグできる
        const grab = inside ? { x: p0.x - center.x, y: p0.y - center.y } : { x: 0, y: 0 }
        const moveTo = (cx: number, cy: number, anim: boolean) => {
          const p = toStage(cx, cy)
          onPan(vr.width / 2 - (p.x - grab.x) * k, vr.height / 2 - (p.y - grab.y) * k, anim)
        }
        if (!inside) moveTo(e.clientX, e.clientY, true)
        try {
          svg.setPointerCapture(e.pointerId)
        } catch {
          // 捕まえられなくても、ミニマップの上で動かしている間はドラッグできる
        }
        svg.classList.add('dragging')
        const onMove = (ev: PointerEvent) => moveTo(ev.clientX, ev.clientY, false)
        const onUp = () => {
          svg.removeEventListener('pointermove', onMove)
          svg.removeEventListener('pointerup', onUp)
          svg.removeEventListener('pointercancel', onUp)
          svg.classList.remove('dragging')
        }
        svg.addEventListener('pointermove', onMove)
        svg.addEventListener('pointerup', onUp)
        svg.addEventListener('pointercancel', onUp)
      }}
    >
      <path className="edge" d={m.edges} />
      {m.rects.map((r, i) => (
        <rect
          // 同じ節が 2 か所に出ると id が重なるので、位置で区別する
          key={`${i}-${r.id}`}
          className={`n ${r.on ? 'on' : ''}`}
          // 少し内側に縮めて描く（縮小率が小さいと、縦に並んだ箱の隙間が 1px 未満になって 1 つの大きな箱に見えるため）
          x={m.ox + r.x * m.s + MAP_INSET}
          y={m.oy + r.y * m.s + MAP_INSET}
          width={Math.max(1.5, r.w * m.s - MAP_INSET * 2)}
          height={Math.max(1.5, r.h * m.s - MAP_INSET * 2)}
          rx={1}
        />
      ))}
      <rect className="vpr" ref={mapVpRef} />
    </svg>
  )
}
