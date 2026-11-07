import { describe, expect, it } from 'vitest'
import { clampPos, clampZoom, edgePath, fitScale, glideEase, glideMs, keepInside, nextZoomStep, zoomAround } from '../src/ui/canvasGeometry'

describe('キャンバスの表示位置と倍率', () => {
  it('中身が表示領域より大きければ、端が余白の位置で止まる', () => {
    // 中身 1000・表示 400・余白 80: 動かせるのは -680〜80
    expect(clampPos(200, 1000, 400)).toBe(80)
    expect(clampPos(-900, 1000, 400)).toBe(-680)
    expect(clampPos(-100, 1000, 400)).toBe(-100)
  })
  it('中身が小さければ、表示領域の内側で動かせる', () => {
    // 中身 100・表示 400: 80〜220
    expect(clampPos(0, 100, 400)).toBe(80)
    expect(clampPos(300, 100, 400)).toBe(220)
  })
  it('倍率は 20〜160% に収め、全体表示は 100% を超えない', () => {
    expect(clampZoom(5)).toBe(1.6)
    expect(clampZoom(0.01)).toBe(0.2)
    expect(fitScale({ w: 1000, h: 800 }, { w: 200, h: 100 })).toBe(1)
    expect(fitScale({ w: 500, h: 1000 }, { w: 1000, h: 100 })).toBe(0.5)
    expect(fitScale({ w: 100, h: 100 }, { w: 10000, h: 10000 })).toBe(0.2)
  })
  it('＋－は決まった段階で止まり、端の先はない', () => {
    expect(nextZoomStep(100, 1)).toBe(110)
    expect(nextZoomStep(100, -1)).toBe(90)
    expect(nextZoomStep(97, -1)).toBe(90)
    expect(nextZoomStep(150, 1)).toBeUndefined()
    expect(nextZoomStep(20, -1)).toBeUndefined()
  })
  it('拡大縮小の中心の点は動かない', () => {
    const t = { tx: 30, ty: -20, k: 1 }
    const n = zoomAround(t, 2, 200, 100)
    // 画面の点 (200,100) が指す中身の位置は変わらない
    expect((200 - t.tx) / t.k).toBeCloseTo((200 - n.tx) / n.k)
    expect((100 - t.ty) / t.k).toBeCloseTo((100 - n.ty) / n.k)
  })
  it('はみ出すときだけ端から寄せる', () => {
    expect(keepInside(50, 100, 0, 500)).toBe(50)
    expect(keepInside(450, 100, 0, 500)).toBe(384)
    expect(keepInside(-30, 100, 0, 500)).toBe(16)
  })
  it('運ぶ動きは遠いほど長く 0.65s まで、進み具合は 0〜1', () => {
    expect(glideMs(0)).toBe(350)
    expect(glideMs(400)).toBe(450)
    expect(glideMs(10000)).toBe(650)
    expect(glideEase(0)).toBe(0)
    expect(glideEase(1)).toBe(1)
    expect(glideEase(0.5)).toBeCloseTo(0.5)
    expect(glideEase(2)).toBe(1)
  })
  it('ミニマップの線: 列は下辺の中央から、縦に積んだ子は左の縦線から', () => {
    const f = (v: number) => String(v)
    expect(edgePath({ x: 0, y: 0, w: 100, h: 40 }, { x: 200, y: 80, w: 60, h: 40 }, false, f)).toBe('M50 40V60H230V80')
    expect(edgePath({ x: 0, y: 0, w: 100, h: 40 }, { x: 24, y: 50, w: 80, h: 60 }, true, f)).toBe('M11 40V72H24')
  })
})
