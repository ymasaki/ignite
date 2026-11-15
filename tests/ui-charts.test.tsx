// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { ColumnChart, Waterfall, BoxPlot, ScatterChart, RadarChart, HeatMap, PieChart, Gauge } from '../src/ui/Plot';
import { BarList, LineChart, StackColumns, Sparkline, Funnel, TileMap, Stat, ChartCard, ChartGrid } from '../src/ui/Chart';
import { Kpi, KpiBand } from '../src/ui/Kpi';
import { Toaster, toast } from '../src/ui/Toast';
import { domSetup, render, el, event, click, resize, advance, host } from './dom';
domSetup();
function actToast(text: string) { act(() => { toast(text); }); }
function finiteGeometry() { for (const e of document.querySelectorAll('svg *'))
    for (const a of [...e.attributes])
        expect(a.value, `${e.tagName}.${a.name}`).not.toMatch(/NaN|Infinity/); }
const cases: [
    string,
    ReactNode,
    string[]
][] = [
    ['縦棒と右軸', <ColumnChart labels={['今', '前']} series={[{ label: '人数', values: [10, -5] }, { label: '件数', values: [null, 3] }]} line={{ label: '率', values: [1.5, 2.5] }} unit="名" lineUnit="%" current={0}/>, ['人数', '10名', '率', '2.5%']],
    ['度数', <ColumnChart labels={['A', 'B']} series={[{ label: '数', values: [0, 4] }]} histogram/>, ['A', '4']],
    ['滝', <Waterfall start={{ label: '開始', value: 100 }} steps={[{ label: '増', value: 20 }, { label: '減', value: -30 }]} total="合計" unit="名"/>, ['開始', '増', '減', '合計', '90名']],
    ['箱ひげ', <BoxPlot items={[{ label: '組', min: 0, q1: 2, median: 3, q3: 4, max: 5, outliers: [9] }]} unit="件"/>, ['組', '3件', '9件']],
    ['散布', <ScatterChart xLabel="横" yLabel="縦" points={[{ label: '一点', x: -2, y: 3, size: 20 }, { label: '二点', x: 1, y: 2, size: 5, muted: true }]} fit/>, ['横', '縦', '一点']],
    ['レーダー', <RadarChart axes={['A', 'B', 'C']} series={[{ label: '今回', values: [3, 4, 5] }, { label: '以前', values: [1, 2, 3], soft: true }]}/>, ['A', '今回', '以前']],
    ['濃淡', <HeatMap rows={['組']} cols={['今', '前', '後']} values={[[1, null, 10]]} unit="件" scale={['少', '多']} showValues square/>, ['組', '今', '10件', '少', '多']],
    ['円', <PieChart items={[{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 30 }, { label: 'D', value: 10 }, { label: 'E', value: 10 }, { label: 'F', value: 20 }]} donut center="100" unit="名"/>, ['A', 'その他', '100']],
    ['折れ線', <LineChart series={[{ label: '今回', values: [1, 4, 2] }, { label: '前回', values: [2, 2, 3], soft: true }]} xLabels={['春', '夏', '秋']} unit="名" fit area/>, ['今回', '春', '秋', '4名']],
    ['積上げ', <StackColumns labels={['今', '前']} stacks={[{ label: 'A', values: [2, 3] }, { label: 'B', values: [4, 1] }]} down={{ label: '減', values: [1, 2] }} current={0}/>, ['A', 'B', '減']],
    ['小さな線', <Sparkline values={[1, null, 4, 2]} label="推移" unit="名"/>, ['推移']],
    ['漏斗', <Funnel steps={[{ label: '訪問', value: 100 }, { label: '購入', value: 20 }]} ofPrev="前から" ofFirst="最初から" unit="人"/>, ['訪問', '購入', '20人']],
];
it.each(cases)('%sは値を読み上げ用の表・名前へ渡し、有限の座標を描く', (_name, node, texts) => {
    render(<ChartCard title="分析"><ChartGrid>{node}</ChartGrid></ChartCard>);
    for (const text of texts)
        expect(host.innerHTML).toContain(text);
    finiteGeometry();
    resize();
    finiteGeometry();
});
it.each([
    <ColumnChart labels={[]} series={[]}/>, <Waterfall start={{ label: '開始', value: 0 }} steps={[]}/>, <BoxPlot items={[]}/>, <ScatterChart points={[]} xLabel="横" yLabel="縦"/>, <RadarChart axes={[]} series={[]}/>, <HeatMap rows={['行']} cols={['列']} values={[[null]]}/>, <PieChart items={[]}/>, <LineChart series={[]}/>, <Sparkline label="空" values={[]}/>,
])('空・欠測の図も有限の座標を保つ（%#）', node => { render(node); finiteGeometry(); });
it('ゲージは欠測をmeterと区別し、値と目標を読み上げへ渡す', () => {
    render(<Gauge label="使用量" value={32.5} unit="%" target={80} decimals={1}/>);
    expect(el('[role=meter]').getAttribute('aria-valuenow')).toBe('32.5');
    expect(el('[role=meter]').getAttribute('aria-valuetext')).toBe('32.5%（目標 80%）');
    finiteGeometry();
    render(<Gauge label="使用量" value={null}/>);
    expect(document.querySelector('[role=meter]')).toBeNull();
    expect(el('.gauge').getAttribute('aria-label')).toBe('使用量 値なし');
});
it('円の凡例とホバーは同じ区分を強調し、外れると解除する', () => {
    render(<PieChart items={[{ label: 'A', value: 10 }, { label: 'B', value: 20 }]}/>);
    const item = el('.pie-legend li');
    event(item, 'focusin');
    expect(el('.pie').classList.contains('focus')).toBe(true);
    event(el('.pie'), 'focusout', { relatedTarget: document.body });
    expect(el('.pie').classList.contains('focus')).toBe(false);
});
it('タイルは比率・欠測・選択状態を保ち、選択キーを通知する', () => {
    const select = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    render(<TileMap label="部署" selected="a" onSelect={select} scale={['少', '多']} items={[{ key: 'a', label: '部署A', value: '80%', sub: '8 / 10名', size: 8, ratio: 0.8 }, { key: 'b', label: '部署B', value: '—', size: 2, ratio: null }]}/>);
    resize();
    expect(document.querySelectorAll('.tm-tile')).toHaveLength(2);
    expect(el('.tm-tile').getAttribute('aria-pressed')).toBe('true');
    click('.tm-tile');
    expect(select).toHaveBeenCalledExactlyOnceWith('a');
    expect(el('.tm-tile.none').getAttribute('aria-label')).toContain('部署B');
});
it('横棒は表示文言と読み上げの名前を結び、StatとKPIは欠測を区別する', () => {
    const select = vi.fn();
    render(<><BarList items={[{ label: '回答', value: 4, text: '4名' }, { label: 'なし', value: 0, muted: true }]}/><Stat value={null} unit="名"/><Kpi label="人数" icon="絵" value={4} unit="名" sub="比較" active onClick={select}/></>);
    expect(el('.bl').getAttribute('data-chart-tip')).toBe('回答　4名');
    click('.kpi-action');
    expect(select).toHaveBeenCalledOnce();
    expect(el('.kpi-action').getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('—');
});
it('KPIの帯は独立した項目とまとめを描き、隠した操作をTabから外す', () => {
    const select = vi.fn();
    render(<KpiBand groups={[{ key: 'g', summary: <Kpi label="合計" icon="絵" value={3}/>, items: [<Kpi key="a" label="A" icon="絵" value={1} onClick={select}/>, <Kpi key="b" label="B" icon="絵" value={2}/>] }]}/>);
    resize();
    expect(host.textContent).toContain('合計');
    expect(host.textContent).toContain('A');
    expect(document.querySelectorAll('.kpi.hide button:not([tabindex="-1"])')).toHaveLength(0);
});
it('通知は3件までで、待機中のタイマー停止・再開と手動閉鎖を保つ', () => {
    render(<Toaster />);
    for (const text of ['一', '二', '三', '四'])
        actToast(text);
    expect(document.querySelectorAll('.toast')).toHaveLength(3);
    expect(host.textContent).not.toContain('一');
    const first = el('.toast');
    event(first, 'pointerover');
    advance(6000);
    expect(first.classList.contains('closing')).toBe(false);
    event(first, 'pointerout');
    advance(5000);
    expect(first.classList.contains('closing')).toBe(true);
    event(first, 'animationend');
    expect(document.querySelectorAll('.toast')).toHaveLength(2);
    click('[data-toast-close]');
    expect(el('.toast').classList.contains('closing')).toBe(true);
});
