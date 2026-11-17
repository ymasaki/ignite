// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import { measure, type MeasureArgs } from '../audit/measure';
const args: MeasureArgs = {
    FONT_SIZES: [11, 12, 13, 14, 16, 20, 24, 32], FONT_WEIGHTS: ['400', '600', '700'], RADII: [0, 3, 6, 8, 10, 12, 14, 99],
    SHELL: { overlayBelow: 814, sideMinBelow: 986, drawerSideAt: 600, minBoard: 320, rail: 64 },
    rows: '.row', overflow: '.overflow', bars: '.bar', frames: '.frame',
};
// レイアウトエンジンの代替はこのテストだけ。実際の配置はカタログのヘッドレス監査で確かめる。
const boxes = new Map<Element, DOMRect>();
function box(selector: string, x = 0, y = 0, w = 100, h = 34) {
    const el = document.querySelector(selector)!;
    boxes.set(el, { x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, toJSON: () => ({}) });
    return el;
}
function width(el: Element, scrollWidth: number, clientWidth: number) {
    Object.defineProperties(el, { scrollWidth: { configurable: true, value: scrollWidth }, clientWidth: { configurable: true, value: clientWidth } });
}
// evaluateの引数と返値を通し、外部変数への依存は既存の実ブラウザ監査でも検出する。
const page = { evaluate: async (fn: (a: MeasureArgs) => unknown, a: MeasureArgs) => fn(a) } as unknown as Page;
const run = (extra: Partial<MeasureArgs> = {}) => {
    // jsdomは角丸の短縮形を各角のcomputed styleへ展開しないため、固定入力を明示する。
    for (const el of document.querySelectorAll<HTMLElement>('[style]')) {
        const radius = el.style.borderRadius;
        if (radius)
            for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'] as const)
                el.style[corner] = radius;
    }
    return measure(page, { ...args, ...extra });
};
const rules = async (extra: Partial<MeasureArgs> = {}) => (await run(extra)).map(f => f.rule);
beforeEach(() => {
    document.head.innerHTML = '<style>* { font-size:13px; font-weight:400; border-radius:0; overflow:visible; overflow-x:visible; overflow-y:visible; background-color:transparent; background-image:none; box-shadow:none; }</style>';
    document.body.innerHTML = '';
    boxes.clear();
    width(document.documentElement, 0, 0);
    document.documentElement.removeAttribute('style');
    vi.stubGlobal('innerWidth', 900);
    vi.stubGlobal('innerHeight', 800);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) { return boxes.get(this) ?? new DOMRect(); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('描画監査の境界と例外', () => {
    it('空の画面は指摘せず、ページの1pxの誤差は許容する', async () => {
        width(document.documentElement, 901, 900);
        expect(await run()).toEqual([]);
        width(document.documentElement, 902, 900);
        expect(await run()).toEqual([{ rule: '横のはみ出し（5 章）', where: 'ページ全体', expected: '幅 900px 以内', actual: '902px' }]);
    });
    it('グラフのTab到達性・読み上げとinert、SVG凡例の例外を区別する', async () => {
        document.body.innerHTML = '<div data-chart-tip></div><div aria-hidden="true"><button data-chart-tip>値</button></div><div inert><div data-chart-tip></div></div><svg><path data-chart-tip></path><path data-chart-tip tabindex="-1"></path></svg>';
        expect((await run()).map(f => [f.where, f.actual])).toEqual([
            ['div', 'tabIndex=-1、aria-hidden=false'], ['button', 'tabIndex=0、aria-hidden=true'], ['path', 'tabIndex=-1、aria-hidden=false'],
        ]);
    });
    it('段と枠の余白、詳細パネルの右端を測り、置換した測定だけ外す', async () => {
        document.body.innerHTML = '<div class="mainwrap" style="--shell-x:8;--shell-top:10;--shell-gap:12;--shell-bottom:8"><header class="top"><b>題</b></header><main class="shell-main"><div class="row"></div><div class="row board"></div><div class="pslot"></div></main></div>';
        box('.mainwrap', 0, 0, 900, 500);
        box('header', 0, 0, 900, 40);
        box('b', 8, 0, 100, 40);
        box('.row', 8, 50, 884, 100);
        box('.board', 8, 162, 500, 330);
        box('.pslot', 508, 162, 384, 330);
        expect(await run()).toEqual([]);
        box('.board', 0, 160, 500, 320);
        expect((await run()).map(f => f.where)).toEqual(['div.row → div.row.board', '内容の枠の左', '内容の枠の下']);
        expect(await run({ skipLayout: ['rows', 'boardLeft', 'boardBottom'] })).toEqual([]);
        box('.pslot', 508, 162, 390, 330);
        expect((await run()).map(f => f.where)).toEqual(expect.arrayContaining(['内容の枠（詳細パネルを含む）の右']));
        document.querySelector('.board')!.classList.add('settings-board');
        expect((await run({ skipLayout: ['rows', 'boardLeft', 'boardBottom'] }))).toEqual([]);
    });
    it('パン内容は切り抜きを許容するが、固定操作と枠自身の切断は報告する', async () => {
        document.body.innerHTML = '<div class="outer" style="overflow-x:hidden"><div class="vp" style="overflow-x:hidden"><div class="stage"><button>節</button><a href="#" style="position:fixed">操作</a></div></div></div>';
        box('.outer', 0, 0, 300, 200);
        box('.vp', 0, 0, 300, 200);
        box('button', 280, 20, 100);
        box('a', 280, 80, 100);
        const panRegions = [{ viewport: '.vp', content: '.stage' }];
        expect((await run({ panRegions })).filter(f => f.rule === '横のはみ出し（5 章）').map(f => f.where)).toEqual(['div.stage > a']);
        box('.vp', 0, 0, 310, 200);
        expect((await run({ panRegions })).some(f => f.expected === 'パンの枠が切られない')).toBe(true);
        expect((await run()).filter(f => f.expected === '中身が枠に切られない')).toHaveLength(2);
        document.querySelector('.vp')!.setAttribute('style', 'overflow-x:auto');
        expect((await run({ panRegions })).filter(f => f.rule === '横のはみ出し（5 章）')).toEqual([]);
    });
    it('不可視・読み上げ用の要素は切断を報告せず、窓の外へ出た通常操作を報告する', async () => {
        document.body.innerHTML = '<button class="sr-only">補足</button><button class="normal">操作</button><button style="visibility:hidden">非表示</button>';
        box('.sr-only', 850, 10, 100);
        box('.normal', 850, 50, 100);
        box('[style]', 850, 100, 100);
        expect((await run()).filter(f => f.rule === '横のはみ出し（5 章）').map(f => f.where)).toEqual(['body > button.normal']);
    });
    it('開いたパネルとカレンダーの幅を別々に判定する', async () => {
        document.body.innerHTML = '<div class="datepicker"><div class="popover-body" style="padding-left:10px;padding-right:10px;border-left:1px solid black;border-right:1px solid black"><div class="cal"><table></table></div></div></div>';
        box('.popover-body', 10, 750, 250, 100);
        box('table', 21, 761, 200, 70);
        expect(await rules()).toEqual(['開いたパネルが切れない（5 章）', 'カレンダーの幅（7 章）']);
        box('.popover-body', 10, 100, 222, 100);
        expect(await run()).toEqual([]);
    });
    it('回る数字の見えている桁だけ、字と枠の0.5pxの差を測る', async () => {
        document.body.innerHTML = '<div class="roll"><span class="roll-col"><span class="roll-strip" style="transform:translateY(-10%)"></span>1</span></div>';
        box('.roll-col', 0, 0, 8, 20);
        Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 8.5 }) });
        expect(await run()).toEqual([]);
        vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue({ width: 9 } as DOMRect);
        expect((await run()).map(f => f.actual)).toEqual(['字 9.0px > 桁 8.0px']);
        document.querySelector('.roll-col')!.classList.add('gone');
        expect(await run()).toEqual([]);
    });
    it('帯のはみ出しと値の折り返し、操作の重なりを検出する', async () => {
        document.body.innerHTML = '<div class="overflow bar"><button>A</button><input><span class="bl-v" style="line-height:20px">値</span></div>';
        width(box('.overflow', 0, 0, 200, 100), 202, 200);
        box('button', 0, 0, 100);
        box('input', 90, 0, 100);
        box('.bl-v', 0, 50, 80, 31);
        expect(await rules()).toEqual(['横のはみ出し（5 章）', '横のはみ出し（5 章）', '操作の重なり（5 章）']);
        box('input', 100, 0, 100);
        box('.bl-v', 0, 50, 80, 30);
        width(document.querySelector('.overflow')!, 201, 200);
        expect(await run()).toEqual([]);
    });
    it('詳細パネルの境界、左メニュー、閉じた引き出しの影を測る', async () => {
        document.body.innerHTML = '<div class="side" style="box-shadow:0 0 2px black"></div><div class="content"><div class="board"></div></div><div class="drawer"></div>';
        box('.side', -200, 0, 200, 500);
        box('.board', 0, 0, 319, 400);
        expect(await rules()).toEqual(['詳細パネルを重ねない（5 章）', '主役の最小幅（5 章）', '左メニューを畳む（5 章）', '影（4 章）']);
        box('.side', 0, 0, 200, 500);
        expect(await rules()).toContain('左メニューを畳む（5 章）');
        vi.stubGlobal('innerWidth', 813);
        expect(await run()).toEqual([]);
    });
    it('主役が詰まるときextraが見えれば報告し、extraを隠すと通す', async () => {
        document.body.innerHTML = '<button><span data-fit="main">主役</span><span data-fit="extra">補足</span></button>';
        box('button');
        width(box('[data-fit="main"]'), 200, 100);
        box('[data-fit="extra"]');
        expect(await rules()).toEqual(['落とす順番（5 章）']);
        document.querySelector<HTMLElement>('[data-fit="extra"]')!.style.display = 'none';
        expect(await run()).toEqual([]);
    });
    it('文字と角丸の目盛りは厳密に測り、文字拡大と顔アイコンを区別する', async () => {
        document.body.innerHTML = '<span class="text" style="font-size:15px;font-weight:500;border-radius:7px">文字</span><span class="av" style="font-size:13px;border-radius:50%">顔</span>';
        box('.text');
        box('.av');
        expect(await rules()).toEqual(['文字の大きさ（3 章）', '文字の太さ（3 章）', '角丸（4 章）']);
        document.documentElement.style.setProperty('--text-scale', '2');
        document.querySelector<HTMLElement>('.text')!.style.cssText = 'font-size:26px;font-weight:600;border-radius:10px';
        expect(await run()).toEqual([]);
        document.documentElement.style.removeProperty('--text-scale');
    });
    it('カードの入れ子と面の外の内容を検出し、それぞれの例外を適用する', async () => {
        document.body.innerHTML = '<main class="shell-main"><section class="outer" style="border:1px solid black;border-radius:12px"><div class="inner" style="border:1px solid black;border-radius:14px">内容</div></section><aside><b>枠の外</b><i>同じ塊</i></aside></main>';
        box('.outer');
        box('.inner');
        box('b');
        box('i');
        expect(await rules()).toEqual(['角丸の枠を重ねない（7 章）', '中身は角丸の枠の上に置く（1 章）']);
        expect(await run({ nestOk: '.inner', bareOk: 'aside' })).toEqual([]);
    });
    it('角の地塗りを検出し、枠で切り抜くと通す', async () => {
        document.body.innerHTML = '<div class="frame" style="border-radius:12px"><div class="fill" style="background:red"></div></div>';
        box('.frame');
        box('.fill');
        Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.querySelector('.fill') });
        expect((await run()).filter(f => f.rule === '角丸（4 章）')).toHaveLength(4);
        document.querySelector<HTMLElement>('.frame')!.style.overflow = 'hidden';
        expect(await run()).toEqual([]);
    });
    it('KPIの箱と幅、ボタンの高さ、アイコンの名前とtip、titleを順に報告する', async () => {
        document.body.innerHTML = '<div class="kpis-wrap"><div class="kpis"><div class="kpi"><i class="kpi-ic"></i></div></div></div><button class="btn" title="説明"><svg></svg></button>';
        width(box('.kpi'), 102, 100);
        box('.kpi-ic', 0, 0, 20, 18);
        box('button', 0, 50, 34, 32);
        expect(await rules()).toEqual(['KPI のアイコンの箱（7 章）', 'KPI の枠の幅（7 章）', 'ボタンの高さ（5 章）', 'アイコンだけのボタン（1 章）', 'アイコンだけのボタン（1 章）', 'title を使わない（1 章）']);
        width(document.querySelector('.kpi')!, 100, 100);
        box('.kpi-ic', 0, 0, 20, 20);
        box('button', 0, 50, 34, 34);
        const button = document.querySelector('button')!;
        button.removeAttribute('title');
        button.setAttribute('aria-label', '説明');
        button.setAttribute('data-tip', '');
        expect(await run()).toEqual([]);
        // 記号だけで動作が明らかなボタンは data-no-tip で意図して吹き出しを外せる。印がなければ従来どおり報告する
        button.removeAttribute('data-tip');
        expect(await rules()).toEqual(['アイコンだけのボタン（1 章）']);
        button.setAttribute('data-no-tip', '');
        expect(await run()).toEqual([]);
    });
});
