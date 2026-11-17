// @vitest-environment jsdom
// 表示の負荷を増やさない決まり（要素を増やさない・測るのをまとめる・変わらないときは描き直さない）の回帰テスト。
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { afterLayout, measureThenWrite } from '../src/ui/frame';
import { RollingNumber, Collapse } from '../src/ui/Motion';
import { AppShell } from '../src/ui/Shell';
import { DataTable } from '../src/ui/Table';
import { LineChart } from '../src/ui/Chart';
import { ColumnChart } from '../src/ui/Plot';
import { pickSuggestions } from '../src/ui/Search';
import { useScrollFocus } from '../src/ui/A11y';
import { useRef } from 'react';
import { domSetup, render, el, event, frame, resize, advance } from './dom';
domSetup();
it('回る数字は桁ごとに帯の要素を 1 つだけ作り、文字として置くのは今の数字だけにする', () => {
    render(<RollingNumber value={1280} />);
    expect(document.querySelectorAll('.roll-col')).toHaveLength(4);
    expect(document.querySelectorAll('.roll *')).toHaveLength(4 * 2 + 1);
    const strips = [...document.querySelectorAll<HTMLElement>('.roll-strip')];
    expect(strips.map(s => s.childElementCount)).toEqual([0, 0, 0, 0]);
    expect(strips.map(s => s.textContent)).toEqual(['1', '2', '8', '0']);
    expect(strips.map(s => s.dataset.d)).toEqual(['1', '2', '8', '0']);
    expect(strips.map(s => s.style.transform)).toEqual(['translateY(-10%)', 'translateY(-20%)', 'translateY(-80%)', 'translateY(0%)']);
});
it('測る処理は先にすべて呼び、書き込みはそのあとでまとめて行う', async () => {
    const order: string[] = [];
    measureThenWrite(() => { order.push('読む1'); return () => order.push('書く1'); });
    measureThenWrite(() => { order.push('読む2'); return () => order.push('書く2'); });
    measureThenWrite(() => { order.push('読む3'); });
    expect(order).toEqual([]);
    await Promise.resolve();
    expect(order).toEqual(['読む1', '読む2', '読む3', '書く1', '書く2']);
    measureThenWrite(() => { order.push('次'); });
    await Promise.resolve();
    expect(order.at(-1)).toBe('次');
});
it('描いたあとの処理は描画のあとに 1 回呼び、取り消すと呼ばない', () => {
    const cb = vi.fn();
    afterLayout(cb);
    expect(cb).not.toHaveBeenCalled();
    frame();
    expect(cb).toHaveBeenCalledTimes(1);
    afterLayout(cb)();
    frame();
    expect(cb).toHaveBeenCalledTimes(1);
});
it('一度に描いたCollapseは、高さをすべて測ってからまとめて書く', async () => {
    const log: string[] = [];
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => { log.push('読む'); return 40; });
    render(<>{[1, 2, 3].map(i => <Collapse key={i} open><p>中身</p></Collapse>)}</>);
    const outers = [...document.querySelectorAll<HTMLElement>('.collapse')];
    outers.forEach(o => { const s = o.style; Object.defineProperty(s, 'height', { configurable: true, set(v: string) { log.push('書く'); s.setProperty('height', v); }, get: () => s.getPropertyValue('height') }); });
    log.length = 0;
    render(<>{[1, 2, 3].map(i => <Collapse key={i} open><p>変わった中身</p></Collapse>)}</>);
    await act(async () => { await Promise.resolve(); });
    expect(log.slice(0, 6)).toEqual(['読む', '読む', '読む', '書く', '書く', '書く']);
    expect(outers.map(o => o.style.getPropertyValue('height'))).toEqual(['40px', '40px', '40px']);
    height.mockRestore();
});
it('枠は窓の幅が変わっても、骨組みが変わらなければ描き直さない', () => {
    let renders = 0;
    function Side() { renders++; return <span>メニュー</span>; }
    vi.stubGlobal('innerWidth', 1440);
    render(<AppShell title="画面" collapse={{ collapsed: false, onChange: () => undefined }} side={() => <Side />}>本文</AppShell>);
    const first = renders;
    for (const width of [1439, 1400, 1300, 1200]) { vi.stubGlobal('innerWidth', width); event(window, 'resize'); }
    expect(renders).toBe(first);
    expect(el('.app').classList.contains('side-min')).toBe(false);
    // 畳む幅を下回ったら描き直して、左メニューをアイコンの列にする
    vi.stubGlobal('innerWidth', 900);
    event(window, 'resize');
    expect(renders).toBeGreaterThan(first);
    expect(el('.app').classList.contains('side-min')).toBe(true);
});
it('階層の表はスクロールでは行を測り直さず、大きさが変わったときと描き直したあとに測り直す', () => {
    const depths = [0, 1, 1, 0, 1];
    const rows = depths.map((_, i) => [{ content: `行${i}` }, { content: i }]);
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON: () => ({}) }));
    render(<DataTable label="階層" stickyHead depths={depths} columns={['名前', '値']} rows={rows} />);
    const sc = el('.data-table-scroll');
    rect.mockClear();
    Object.defineProperty(sc, 'scrollTop', { configurable: true, writable: true, value: 40 });
    event(sc, 'scroll');
    const afterFirst = rect.mock.calls.length;
    sc.scrollTop = 45;
    event(sc, 'scroll');
    sc.scrollTop = 50;
    event(sc, 'scroll');
    // 行を積んで描き直した直後の 1 回だけ測り直し、同じ並びのままのスクロールでは測らない
    expect(rect.mock.calls.length - afterFirst).toBeLessThanOrEqual(depths.length + 3);
    const settled = rect.mock.calls.length;
    sc.scrollTop = 52;
    event(sc, 'scroll');
    expect(rect.mock.calls.length).toBe(settled);
    expect(document.querySelectorAll('tr.stuck').length).toBeGreaterThan(0);
    resize();
    expect(rect.mock.calls.length).toBeGreaterThan(settled);
});
it('グラフは画面に出る前に、置き場所の実際の幅で描く', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
    render(<><LineChart series={[{ label: '人数', values: [1, 2, 3] }]} /><ColumnChart labels={['a', 'b']} series={[{ label: '件数', values: [1, 2] }]} /></>);
    expect([...document.querySelectorAll('svg[role=img]')].map(s => s.getAttribute('width'))).toEqual(['360', '360']);
});
it('スクロール枠は中身が続けて変わっても、描いたあとに 1 回だけ確かめる', async () => {
    function Area({ n }: { n: number }) { const ref = useRef<HTMLDivElement>(null); useScrollFocus(ref, '内容'); return <div ref={ref} className="area">{Array.from({ length: n }, (_, i) => <p key={i}>{i}</p>)}</div>; }
    render(<Area n={1} />);
    const area = el('.area');
    let reads = 0;
    Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => { reads++; return 100; } });
    render(<Area n={2} />);
    await act(async () => { await Promise.resolve(); });
    render(<Area n={3} />);
    await act(async () => { await Promise.resolve(); });
    expect(reads).toBe(0);
    expect(area.hasAttribute('tabindex')).toBe(false);
    frame();
    expect(reads).toBe(1);
    expect(area.getAttribute('role')).toBe('region');
    advance(100);
    expect(reads).toBe(1);
});
it('候補は多く当たっても、先頭で当たるものを前に limit 件だけ選び、件数は全体を数える', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ key: String(i), title: i % 2 ? `山田 ${i}` : `小山 ${i}` }));
    const [group] = pickSuggestions([{ key: 'g', label: '人', items }], '山', 6);
    expect(group.count).toBe(500);
    expect(group.items.map(it => it.key)).toEqual(['1', '3', '5', '7', '9', '11']);
    const [few] = pickSuggestions([{ key: 'g', label: '人', items: items.slice(0, 4) }], '山', 6);
    expect(few.items.map(it => it.key)).toEqual(['1', '3', '0', '2']);
});
