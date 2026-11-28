// @vitest-environment jsdom
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScrollBar, scrollBarMetrics, scrollTopFromDrag } from '../src/ui/ScrollBar';
import { advance, domSetup, el, event, render, resize, unmount } from './dom';

domSetup();

function setCoarse(coarse: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(pointer: coarse)' ? coarse : query === '(hover:hover)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

function mockScrollArea(target: HTMLElement, { clientHeight, scrollHeight, clientWidth = 360, top = 0, left = 0 }: { clientHeight: number; scrollHeight: number; clientWidth?: number; top?: number; left?: number }) {
    Object.defineProperty(target, 'clientHeight', { configurable: true, get: () => clientHeight });
    Object.defineProperty(target, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(target, 'clientWidth', { configurable: true, get: () => clientWidth });
    let scrollTop = 0;
    Object.defineProperty(target, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (v: number) => {
            scrollTop = v;
        },
    });
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        top,
        left,
        right: left + clientWidth,
        bottom: top + clientHeight,
        width: clientWidth,
        height: clientHeight,
        x: left,
        y: top,
        toJSON: () => ({}),
    });
}

describe('scrollBarMetrics / scrollTopFromDrag', () => {
    it('はみ出しがない・寸法が 0 のときは非表示になる', () => {
        expect(scrollBarMetrics(500, 500, 0, 480)).toEqual({ visible: false, thumbSize: 0, thumbOffset: 0, maxScroll: 0, travel: 0 });
        expect(scrollBarMetrics(501, 500, 0, 480).visible).toBe(false);
        expect(scrollBarMetrics(800, 0, 0, 480).visible).toBe(false);
        expect(scrollBarMetrics(800, 400, 0, 0).visible).toBe(false);
    });

    it('比率・最小つまみ長・バウンス時のクランプを正しく計算する', () => {
        // 比率そのまま（500 / 1000 * 480 = 240）
        expect(scrollBarMetrics(1000, 500, 250, 480)).toEqual({
            visible: true,
            thumbSize: 240,
            thumbOffset: 120,
            maxScroll: 500,
            travel: 240,
        });
        // 長大なコンテンツでは最小長 minThumb（既定 32px）に保つ
        expect(scrollBarMetrics(10000, 500, 0, 480).thumbSize).toBe(32);
        // iOS バウンスで負値や maxScroll 超えになっても 0〜travel に収まる
        expect(scrollBarMetrics(1000, 500, -40, 480).thumbOffset).toBe(0);
        expect(scrollBarMetrics(1000, 500, 999, 480).thumbOffset).toBe(240);
    });

    it('ドラッグ移動量から次の scrollTop を算出し、範囲内にクランプする', () => {
        expect(scrollTopFromDrag(100, 120, 240, 500)).toBe(350);
        expect(scrollTopFromDrag(100, -999, 240, 500)).toBe(0);
        expect(scrollTopFromDrag(100, 999, 240, 500)).toBe(500);
        expect(scrollTopFromDrag(100, 50, 0, 500)).toBe(0);
    });
});

describe('ScrollBar', () => {
    it('pointer: coarse でない環境では何も描かず属性も付けない', () => {
        setCoarse(false);
        function Box() {
            const ref = useRef<HTMLDivElement>(null);
            return (
                <div className="wrap">
                    <div className="area" ref={ref} />
                    <ScrollBar target={ref} />
                </div>
            );
        }
        render(<Box />);
        expect(document.querySelector('.scroll-rail')).toBeNull();
        expect(el('.area').hasAttribute('data-scroll-rail')).toBe(false);
    });

    it('タッチ環境ではみ出すと表示され、スクロールとつまみドラッグに追従する', () => {
        setCoarse(true);
        let areaNode: HTMLDivElement | null = null;
        function Box({ h = 2000 }: { h?: number }) {
            const ref = useRef<HTMLDivElement>(null);
            return (
                <div className="wrap">
                    <div
                        className="area"
                        ref={(node) => {
                            ref.current = node;
                            if (node && areaNode !== node) {
                                areaNode = node;
                                mockScrollArea(node, { clientHeight: 500, scrollHeight: h, clientWidth: 370, top: 20, left: 10 });
                            }
                        }}
                    />
                    <ScrollBar target={ref} inset={10} />
                </div>
            );
        }
        render(<Box />);
        const area = el('.area');
        const rail = el('.scroll-rail');
        const thumb = el('.scroll-thumb');

        expect(area.hasAttribute('data-scroll-rail')).toBe(true);
        expect(rail.hasAttribute('data-visible')).toBe(true);
        expect(rail.style.top).toBe('30px');
        expect(rail.style.left).toBe('360px');
        expect(rail.style.height).toBe('480px');
        expect(thumb.style.height).toBe('120px');
        expect(thumb.style.transform).toBe('translate3d(0px, 0px, 0px)');

        // スクロールするとつまみ位置と data-scrolling が更新され、700ms 後に外れる
        area.scrollTop = 750;
        event(area, 'scroll');
        expect(thumb.style.transform).toBe('translate3d(0px, 180px, 0px)');
        expect(rail.hasAttribute('data-scrolling')).toBe(true);
        advance(700);
        expect(rail.hasAttribute('data-scrolling')).toBe(false);

        // つまみをドラッグすると scrollTop と位置が連動する（travel=360, maxScroll=1500, +180px → +750）
        event(thumb, 'pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, button: 0, clientY: 200 });
        expect(rail.hasAttribute('data-dragging')).toBe(true);
        event(thumb, 'pointermove', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientY: 380 });
        expect(area.scrollTop).toBe(1500);
        expect(thumb.style.transform).toBe('translate3d(0px, 360px, 0px)');
        event(thumb, 'pointerup', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientY: 380 });
        expect(rail.hasAttribute('data-dragging')).toBe(false);
        advance(700);
        expect(rail.hasAttribute('data-scrolling')).toBe(false);

        // はみ出しがなくなると非表示になる
        Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => 500 });
        resize();
        expect(rail.hasAttribute('data-visible')).toBe(false);

        // アンマウントで属性が外れる
        unmount();
        expect(area.hasAttribute('data-scroll-rail')).toBe(false);
    });
});
