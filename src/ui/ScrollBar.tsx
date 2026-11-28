// タッチ端末のコンテンツ向けスクロールバー。見た目は styles/components/scrollbar.css。
// iOS Safari や Android Chrome では内部スクロール枠の標準バーが静止時に消え、現在位置と残りの長さがわからない。
// pointer: coarse の環境だけ、はみ出しているあいだ右端に細いバーを重ねて出し、つまみのドラッグでも送れるようにする。

import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

import { afterLayout } from './frame'

export interface ScrollBarMetrics {
  visible: boolean
  thumbSize: number
  thumbOffset: number
  maxScroll: number
  travel: number
}

const RAIL_W = 20
const SCROLL_IDLE_MS = 700
const COARSE_QUERY = '(pointer: coarse)'

/** スクロール枠の寸法とスクロール位置から、つまみの長さと位置を計算する */
export function scrollBarMetrics(
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
  trackHeight: number,
  minThumb = 32,
): ScrollBarMetrics {
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  if (maxScroll <= 1 || clientHeight <= 0 || trackHeight <= 0) {
    return { visible: false, thumbSize: 0, thumbOffset: 0, maxScroll: 0, travel: 0 }
  }
  const thumbSize = Math.min(trackHeight, Math.max(minThumb, Math.round((clientHeight / scrollHeight) * trackHeight)))
  const travel = Math.max(0, trackHeight - thumbSize)
  // iOS のバウンスで scrollTop が負や上限超えになっても、つまみは枠内に収める
  const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll))
  const thumbOffset = Math.round(ratio * travel)
  return { visible: true, thumbSize, thumbOffset, maxScroll, travel }
}

/** つまみを動かした量（deltaY）から、新しい scrollTop を計算する */
export function scrollTopFromDrag(startScroll: number, deltaY: number, travel: number, maxScroll: number): number {
  if (travel <= 0 || maxScroll <= 0) return 0
  return Math.min(maxScroll, Math.max(0, startScroll + (deltaY / travel) * maxScroll))
}

function subscribeCoarse(cb: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia(COARSE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getCoarse() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(COARSE_QUERY).matches
}

/**
 * タッチ端末（pointer: coarse）で target が縦にはみ出すときに、右端へ細いスクロールバーを重ねて出す。
 * 親の position: relative な要素の中で target の兄弟として置く（target の中に入れるとスクロールと一緒に流れたり監査の段数に混ざるため）
 */
export function ScrollBar({ target, inset = 10 }: { target: RefObject<HTMLElement | null>; inset?: number }) {
  const coarse = useSyncExternalStore(subscribeCoarse, getCoarse, () => false)
  const railRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({
    scrollHeight: 0,
    clientHeight: 0,
    trackH: 0,
    maxScroll: 0,
    travel: 0,
    top: -1,
    left: -1,
    height: -1,
    visible: false,
    thumbSize: -1,
    thumbOffset: -1,
  })
  const dragRef = useRef<{ id: number; startY: number; startScroll: number; travel: number; maxScroll: number } | null>(null)
  const idleRef = useRef(0)

  const syncIdle = () => {
    window.clearTimeout(idleRef.current)
    const rail = railRef.current
    if (!rail) return
    rail.dataset.scrolling = ''
    if (dragRef.current) return
    idleRef.current = window.setTimeout(() => {
      if (!dragRef.current && railRef.current) delete railRef.current.dataset.scrolling
    }, SCROLL_IDLE_MS)
  }

  useEffect(() => {
    const el = target.current
    const rail = railRef.current
    const thumb = thumbRef.current
    if (!coarse || !el || !rail || !thumb) return

    el.dataset.scrollRail = ''
    const state = stateRef.current
    state.top = -1
    state.left = -1
    state.height = -1
    state.thumbSize = -1
    state.thumbOffset = -1
    state.visible = false

    const applyMetrics = (m: ScrollBarMetrics) => {
      state.maxScroll = m.maxScroll
      state.travel = m.travel
      if (m.visible !== state.visible) {
        state.visible = m.visible
        if (m.visible) rail.dataset.visible = ''
        else delete rail.dataset.visible
      }
      if (m.thumbSize !== state.thumbSize) {
        state.thumbSize = m.thumbSize
        thumb.style.height = `${m.thumbSize}px`
      }
      if (m.thumbOffset !== state.thumbOffset) {
        state.thumbOffset = m.thumbOffset
        thumb.style.transform = `translate3d(0, ${m.thumbOffset}px, 0)`
      }
    }

    const place = () => {
      const tr = el.getBoundingClientRect()
      const host = rail.offsetParent as HTMLElement | null
      const isRoot = !host || host === document.body || host === document.documentElement
      const pr = isRoot ? { left: 0, top: 0 } : host.getBoundingClientRect()
      const originX = pr.left + (isRoot ? 0 : host.clientLeft)
      const originY = pr.top + (isRoot ? 0 : host.clientTop)
      const top = Math.round(tr.top - originY + el.clientTop + inset)
      const left = Math.round(tr.left - originX + el.clientLeft + el.clientWidth - RAIL_W)
      const trackH = Math.max(0, Math.round(el.clientHeight - inset * 2))

      if (top !== state.top) {
        state.top = top
        rail.style.top = `${top}px`
      }
      if (left !== state.left) {
        state.left = left
        rail.style.left = `${left}px`
      }
      if (trackH !== state.height) {
        state.height = trackH
        rail.style.height = `${trackH}px`
      }

      const sh = el.scrollHeight
      const ch = el.clientHeight
      state.scrollHeight = sh
      state.clientHeight = ch
      state.trackH = trackH
      applyMetrics(scrollBarMetrics(sh, ch, el.scrollTop, trackH))
    }

    const onScroll = () => {
      if (el.scrollHeight !== state.scrollHeight || el.clientHeight !== state.clientHeight) {
        place()
      } else {
        applyMetrics(scrollBarMetrics(state.scrollHeight, state.clientHeight, el.scrollTop, state.trackH))
      }
      syncIdle()
    }

    place()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', place)

    let observedChild = el.firstElementChild
    const ro =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            place()
          })
        : null
    if (ro) {
      ro.observe(el)
      if (observedChild) ro.observe(observedChild)
    }

    let cancelLayout = () => {}
    const mo =
      typeof MutationObserver === 'function'
        ? new MutationObserver(() => {
            if (ro && el.firstElementChild !== observedChild) {
              if (observedChild) ro.unobserve(observedChild)
              observedChild = el.firstElementChild
              if (observedChild) ro.observe(observedChild)
            }
            cancelLayout()
            cancelLayout = afterLayout(place)
          })
        : null
    mo?.observe(el, { childList: true, subtree: true })

    return () => {
      cancelLayout()
      window.clearTimeout(idleRef.current)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', place)
      ro?.disconnect()
      mo?.disconnect()
      dragRef.current = null
      delete el.dataset.scrollRail
      delete rail.dataset.visible
      delete rail.dataset.scrolling
      delete rail.dataset.dragging
    }
  }, [coarse, target, inset])

  if (!coarse) return null

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = target.current
    const rail = railRef.current
    const thumb = thumbRef.current
    if (!el || !rail || !thumb) return
    if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return

    const trackH = Math.max(0, Math.round(el.clientHeight - inset * 2))
    const m = scrollBarMetrics(el.scrollHeight, el.clientHeight, el.scrollTop, trackH)
    if (m.travel <= 0 || m.maxScroll <= 0) return

    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)

    stateRef.current.scrollHeight = el.scrollHeight
    stateRef.current.clientHeight = el.clientHeight
    stateRef.current.trackH = trackH
    stateRef.current.maxScroll = m.maxScroll
    stateRef.current.travel = m.travel

    dragRef.current = {
      id: e.pointerId,
      startY: e.clientY,
      startScroll: el.scrollTop,
      travel: m.travel,
      maxScroll: m.maxScroll,
    }
    window.clearTimeout(idleRef.current)
    rail.dataset.dragging = ''
    rail.dataset.scrolling = ''
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const el = target.current
    const thumb = thumbRef.current
    if (!drag || drag.id !== e.pointerId || !el || !thumb) return

    const next = scrollTopFromDrag(drag.startScroll, e.clientY - drag.startY, drag.travel, drag.maxScroll)
    el.scrollTop = next
    const m = scrollBarMetrics(stateRef.current.scrollHeight || el.scrollHeight, stateRef.current.clientHeight || el.clientHeight, next, stateRef.current.trackH)
    if (m.thumbOffset !== stateRef.current.thumbOffset) {
      stateRef.current.thumbOffset = m.thumbOffset
      thumb.style.transform = `translate3d(0, ${m.thumbOffset}px, 0)`
    }
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    dragRef.current = null
    if (railRef.current) delete railRef.current.dataset.dragging
    syncIdle()
  }

  return (
    <div ref={railRef} className="scroll-rail" aria-hidden="true">
      <div
        ref={thumbRef}
        className="scroll-thumb"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      />
    </div>
  )
}
