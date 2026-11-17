import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, vi } from 'vitest';
let root: Root | undefined;
export let host: HTMLDivElement;
export const observers: {
    notify: () => void;
    disconnect: ReturnType<typeof vi.fn>;
}[] = [];
let frames = new Map<number, FrameRequestCallback>();
let serial = 0;
export function domSetup() {
    const attributes = [...document.documentElement.attributes].map(a => [a.name, a.value]);
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        localStorage.clear();
        document.documentElement.dataset.motion = 'reduce';
        host = document.body.appendChild(document.createElement('div'));
        frames = new Map();
        observers.length = 0;
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        // jsdomの未実装APIは状態の代替に限定し、実際のレイアウト・入力はE2Eへ任せる。
        const computed = window.getComputedStyle.bind(window);
        vi.spyOn(window, 'getComputedStyle').mockImplementation(el => computed(el));
        Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true, get() { return this.hasAttribute('inert'); }, set(value: boolean) { this.toggleAttribute('inert', value); } });
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const id = ++serial; frames.set(id, cb); return id; });
        vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
        vi.stubGlobal('ResizeObserver', class {
            disconnect = vi.fn();
            constructor(cb: () => void) { observers.push({ notify: cb, disconnect: this.disconnect }); }
            observe() { }
            unobserve() { }
        });
        vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(hover:hover)', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
        vi.stubGlobal('DOMMatrix', class {
            m41 = 0;
            m42 = 0;
        });
        vi.stubGlobal('CSS', { escape: (s: string) => s.replaceAll('"', '\\"') });
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
        Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
        Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
        Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: function (this: HTMLElement) { this.dataset.open = 'true'; } });
        const matches = Element.prototype.matches;
        vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector) { return selector === ':popover-open' ? (this as HTMLElement).dataset.open === 'true' : matches.call(this, selector); });
    });
    afterEach(() => {
        act(() => root?.unmount());
        root = undefined;
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
        localStorage.clear();
        for (const attribute of [...document.documentElement.attributes])
            document.documentElement.removeAttribute(attribute.name);
        for (const [name, value] of attributes)
            document.documentElement.setAttribute(name, value);
    });
}
export function render(node: ReactNode) { act(() => { root ??= createRoot(host); root.render(node); }); }
export function unmount() { act(() => root?.unmount()); root = undefined; }
export function el<T extends Element = HTMLElement>(selector: string): T { const value = document.querySelector<T>(selector); expect(value, selector).not.toBeNull(); return value!; }
export function event(target: EventTarget, type: string, props: Record<string, unknown> = {}) {
    const e = type.startsWith('key') ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...props }) : new Event(type, { bubbles: true, cancelable: true });
    if (!type.startsWith('key'))
        Object.entries(props).forEach(([k, v]) => Object.defineProperty(e, k, { value: v }));
    act(() => { target.dispatchEvent(e); if (type === 'animationend')
        target.dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true })); });
    return e;
}
export function click(selector: string) { act(() => el<HTMLElement>(selector).click()); }
export function input(selector: string, value: string) {
    const target = el<HTMLInputElement | HTMLTextAreaElement>(selector);
    const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    act(() => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(target, value); target.dispatchEvent(new Event('input', { bubbles: true })); });
}
export function key(selector: string, value: string, extra: Record<string, unknown> = {}) { return event(el(selector), 'keydown', { key: value, ...extra }); }
export function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)); }
// 描画の前の処理（requestAnimationFrame）と、描いた直後に回した処理（待ち 0 のタイマー）まで進める。
export function frame(ms = 16) { advance(ms); const pending = [...frames.values()]; frames.clear(); act(() => pending.forEach(cb => cb(performance.now()))); advance(0); }
export function resize() { act(() => observers.forEach(o => o.notify())); }
