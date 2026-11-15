// @vitest-environment jsdom
import { act, createRef } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Canvas, type CanvasApi } from '../src/ui/Canvas';
import { TreeChart, TreeCard, TreePill } from '../src/ui/Tree';
import { domSetup, render, el, event, click, frame, advance, resize, unmount, observers } from './dom';
domSetup();
function transform() { const s = document.querySelector<HTMLElement>('.canvas-stage')?.style.transform ?? ''; const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(s); return m ? { tx: +m[1], ty: +m[2], k: +m[3] } : { tx: 0, ty: 0, k: 1 }; }
function rect(x: number, y: number, w: number, h: number): DOMRect { return { x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, toJSON: () => ({}) }; }
beforeEach(() => {
    // テスト用の固定した寸法と変形。入力・通知・APIの状態を検証し、実際の描画は既存E2Eで確かめる。
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('canvas-stage') ? 1600 : 100; });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('canvas-stage') ? 1200 : 50; });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const { tx, ty, k } = transform();
        if (this.classList.contains('canvas'))
            return rect(0, 0, 800, 600);
        if (this.classList.contains('canvas-stage'))
            return rect(tx, ty, 1600 * k, 1200 * k);
        if (this.classList.contains('canvas-map'))
            return rect(600, 450, 200, 118);
        if (this.hasAttribute('data-node'))
            return rect(tx + Number(this.getAttribute('data-x') ?? 100) * k, ty + Number(this.getAttribute('data-y') ?? 100) * k, 100 * k, 50 * k);
        return rect(0, 0, 100, 50);
    });
    vi.stubGlobal('DOMMatrixReadOnly', class {
        a: number;
        e: number;
        f: number;
        constructor() { const t = transform(); this.a = t.k; this.e = t.tx; this.f = t.ty; }
    });
});
function setup(start: 'top' | 'fit' = 'top', onClick = vi.fn()) {
    const ref = createRef<CanvasApi>();
    render(<Canvas label="図" apiRef={ref} start={start}><button data-node="a" onClick={onClick}>親</button><button data-node="b" data-parent="a" data-x="400" data-y="300" data-edge="rail" data-on>子</button></Canvas>);
    return ref;
}
it('初期位置・倍率変更・上下限と全体表示をAPIと操作へ反映する', () => {
    const api = setup();
    expect(transform()).toEqual({ tx: 80, ty: 24 - 100, k: 1 });
    expect(el('.canvas-pct').textContent).toBe('100%');
    act(() => api.current!.zoomTo(0.5));
    expect(transform().k).toBe(0.5);
    expect(el('.canvas-pct').textContent).toBe('50%');
    click('[aria-label="拡大"]');
    expect(transform().k).toBeGreaterThan(0.5);
    click('.canvas-pct');
    expect(transform().k).toBe(1);
    act(() => api.current!.zoomTo(100));
    expect(transform().k).toBe(1.6);
    expect(el<HTMLButtonElement>('[aria-label="拡大"]').disabled).toBe(true);
    act(() => api.current!.zoomTo(0));
    expect(transform().k).toBe(0.2);
    expect(el('.canvas-stage').classList.contains('lod')).toBe(true);
    click('[aria-label="全体を表示"]');
    expect(transform().k).toBeLessThanOrEqual(0.5);
    act(() => api.current!.home());
    expect(transform().k).toBe(1);
});
it('fitで始め、ミニマップに親子と強調を出して変化を測り直す', async () => {
    setup('fit');
    expect(transform().k).toBeLessThan(1);
    expect(document.querySelectorAll('.canvas-map .n')).toHaveLength(2);
    expect(document.querySelectorAll('.canvas-map .n.on')).toHaveLength(1);
    expect(el('.canvas-map .edge').getAttribute('d')).not.toBe('');
    el('[data-node=b]').removeAttribute('data-on');
    await act(async () => { await Promise.resolve(); });
    frame();
    expect(document.querySelectorAll('.canvas-map .n.on')).toHaveLength(0);
    resize();
    frame();
    expect(Number(el('.vpr').getAttribute('width'))).toBeGreaterThan(0);
});
it('ホイールは移動し、Ctrlホイールは倍率を変え、操作欄は除外する', () => {
    setup();
    const before = transform();
    event(el('.canvas'), 'wheel', { deltaX: 10, deltaY: 20 });
    expect(transform().tx).toBe(before.tx - 10);
    expect(transform().ty).toBe(before.ty - 20);
    event(el('.canvas'), 'wheel', { deltaX: 0, deltaY: -10, ctrlKey: true, clientX: 400, clientY: 300 });
    expect(transform().k).toBeGreaterThan(1);
    const after = transform();
    event(el('.canvas-ctrl'), 'wheel', { deltaY: 100 });
    expect(transform()).toEqual(after);
});
it('ドラッグの閾値と直後のクリック抑止、キャンセル後の解除を守る', () => {
    const pressed = vi.fn();
    const api = setup('top', pressed);
    const vp = el('.canvas'), node = el('[data-node=a]');
    event(node, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
    event(vp, 'pointermove', { pointerId: 1, clientX: 12, clientY: 12 });
    expect(api.current!.moved()).toBe(false);
    event(vp, 'pointermove', { pointerId: 1, clientX: 30, clientY: 40 });
    expect(api.current!.moved()).toBe(true);
    expect(vp.classList.contains('drag')).toBe(true);
    event(vp, 'pointerup', { pointerId: 1 });
    click('[data-node=a]');
    expect(pressed).not.toHaveBeenCalled();
    advance(0);
    click('[data-node=a]');
    expect(pressed).toHaveBeenCalledOnce();
    event(node, 'pointerdown', { pointerId: 2, clientX: 0, clientY: 0 });
    event(vp, 'pointercancel', { pointerId: 2 });
    expect(vp.classList.contains('drag')).toBe(false);
});
it('二点の距離変化で拡大し、片方が離れたらピンチを終える', () => {
    setup();
    const vp = el('.canvas');
    event(vp, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    event(vp, 'pointerdown', { pointerId: 2, clientX: 200, clientY: 100 });
    event(vp, 'pointermove', { pointerId: 2, clientX: 250, clientY: 100 });
    expect(transform().k).toBe(1.5);
    event(vp, 'pointerup', { pointerId: 2 });
    const t = transform();
    event(vp, 'pointermove', { pointerId: 1, clientX: 500, clientY: 100 });
    expect(transform()).toEqual(t);
});
it('centerOnとholdは対象を解決し、未存在の対象と期限後は動かさない', () => {
    const api = setup();
    act(() => api.current!.centerOn('b', false));
    expect(transform()).toEqual({ tx: -50, ty: -125, k: 1 });
    const before = transform();
    act(() => api.current!.centerOn('missing'));
    expect(transform()).toEqual(before);
    act(() => api.current!.hold('b', 100));
    el('[data-node=b]').setAttribute('data-x', '450');
    resize();
    expect(transform().tx).toBe(before.tx - 50);
    advance(101);
    const expired = transform();
    el('[data-node=b]').setAttribute('data-x', '500');
    resize();
    expect(transform()).toEqual(expired);
});
it('centerOnのアニメーションは行き先へ着き、外すと監視を解除する', () => {
    const api = setup();
    document.documentElement.removeAttribute('data-motion');
    act(() => api.current!.centerOn('b'));
    frame(1000);
    expect(transform().tx).toBe(-50);
    expect(transform().ty).toBe(-125);
    unmount();
    expect(observers.every(o => o.disconnect.mock.calls.length)).toBe(true);
});
it('ミニマップのドラッグは表示位置を変え、終了時に操作状態を外す', () => {
    setup();
    const map = el('.canvas-map');
    const before = transform();
    event(map, 'pointerdown', { pointerId: 1, clientX: 790, clientY: 550 });
    event(map, 'pointermove', { pointerId: 1, clientX: 700, clientY: 500 });
    expect(transform()).not.toEqual(before);
    expect(map.classList.contains('dragging')).toBe(true);
    event(map, 'pointerup', { pointerId: 1 });
    expect(map.classList.contains('dragging')).toBe(false);
});
it('ツリーの子の開閉は内部状態と外部通知をそろえ、親子の印を保つ', () => {
    const toggle = vi.fn(), select = vi.fn();
    const root = { id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }] };
    render(<TreeChart root={root} selected="b" onToggle={toggle} render={(item, state) => <TreeCard title={item.id} name={item.id} state={state} more="子1件" onClick={select} lead="絵" label="分類" sub="補足" meta={1}/>}/>);
    expect(el('[data-node=b]').getAttribute('data-parent')).toBe('a');
    expect(el('[data-node=b]').hasAttribute('data-on')).toBe(true);
    expect(document.querySelector('[data-node=c]')).toBeNull();
    click('[data-node=b] .tc-toggle');
    expect(toggle).toHaveBeenLastCalledWith('b', true);
    expect(el('[data-node=c]').getAttribute('data-edge')).toBe('rail');
    click('[data-node=b] .tc-hit');
    expect(select).toHaveBeenCalledOnce();
    click('[data-node=b] .tc-toggle');
    expect(toggle).toHaveBeenLastCalledWith('b', false);
    expect(document.querySelector('[data-node=c]')).toBeNull();
    render(<TreePill title="節" name="名前" label="種別" lead="絵" selected onClick={select}/>);
    click('button');
    expect(select).toHaveBeenCalledTimes(2);
});
