import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const stubs = vi.hoisted(() => ({ spawn: vi.fn(), check: vi.fn(() => 0) }));
vi.mock('node:child_process', () => ({ spawnSync: stubs.spawn }));
vi.mock('../cli/check', () => ({ main: stubs.check }));
let root: string;
let log: ReturnType<typeof vi.spyOn>;
class Exit extends Error {
    constructor(readonly status: number) { super(`exit ${status}`); }
}
beforeEach(() => {
    vi.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-entry-'));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.spyOn(process, 'exit').mockImplementation((status) => { throw new Exit(Number(status)); });
    log = vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
    stubs.spawn.mockReset().mockReturnValue({ status: 0 });
    stubs.check.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); fs.rmSync(root, { recursive: true, force: true }); });
async function command(args: string[], status: number | null = 0) {
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'ignite', ...args]);
    try {
        await import('../cli/index');
        expect(status).toBeNull();
    }
    catch (error) {
        if (!(error instanceof Exit))
            throw error;
        expect(error.status).toBe(status);
    }
}
function put(file: string, text: string) { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); }
it('helpと不明命令で使い方を出し、versionはパッケージの版を返す', async () => {
    await command([], null);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ignite <command>'));
    vi.resetModules();
    await command(['unknown'], 1);
    vi.resetModules();
    await command(['version']);
    expect(log).toHaveBeenCalledWith(JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
});
it.each([false, true])('init(app=%s)は必要なファイルを配置し既存のソース・命令を保つ', async (app) => {
    put('package.json', JSON.stringify({ scripts: { 'ignite:check': '独自の検査' } }));
    put('e2e/keep.ts', '既存');
    await command(['init', ...(app ? ['--app'] : [])]);
    expect(fs.readFileSync(path.join(root, 'e2e/keep.ts'), 'utf8')).toBe('既存');
    expect(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts).toMatchObject({ 'ignite:check': '独自の検査', 'ignite:sync': 'ignite sync' });
    expect(fs.existsSync(path.join(root, 'playwright.ignite.config.ts'))).toBe(true);
    const config = fs.readFileSync(path.join(root, 'ignite.config.json'), 'utf8');
    vi.resetModules();
    await command(['init']);
    expect(fs.readFileSync(path.join(root, 'ignite.config.json'), 'utf8')).toBe(config);
});
it('sync --checkは書き込まず古さを通知し、同期後は成功する', async () => {
    await command(['sync', '--check'], 1);
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false);
    vi.resetModules();
    await command(['sync']);
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('Ignite');
    vi.resetModules();
    await command(['sync', '--check']);
});
it('checkは引数を渡し、after-upgradeは同期・変更点表示後に検査する', async () => {
    await command(['check', '--staged']);
    expect(stubs.check).toHaveBeenCalledWith(root, ['--staged']);
    vi.resetModules();
    await command(['after-upgrade', '0.0.1']);
    expect(stubs.check).toHaveBeenLastCalledWith(root, []);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('見た目の確認'));
});
it('未導入でのupgradeは外部命令を実行しない', async () => {
    await command(['upgrade'], 1);
    expect(stubs.spawn).not.toHaveBeenCalled();
});
it.each([
    ['', undefined, 'npm', '@ymasaki/ignite@latest'], ['pnpm-lock.yaml', '1.2.3', 'pnpm', '@ymasaki/ignite@1.2.3'], ['yarn.lock', './vendor/pkg.tgz', 'yarn', './vendor/pkg.tgz'],
])('upgradeのパッケージ管理と版指定（%s）', async (lock, version, pm, spec) => {
    put('node_modules/@ymasaki/ignite/package.json', '{"version":"1.0.0"}');
    if (lock)
        put(lock, '');
    await command(['upgrade', ...(version ? [version] : [])]);
    expect(stubs.spawn).toHaveBeenNthCalledWith(1, pm, [pm === 'npm' ? 'install' : 'add', spec], expect.objectContaining({ cwd: root }));
    expect(stubs.spawn).toHaveBeenNthCalledWith(2, process.execPath, [path.join(root, 'node_modules/@ymasaki/ignite/dist/cli.js'), 'after-upgrade', '1.0.0'], expect.anything());
});
it.each([2, null])('更新失敗（%s）は後処理を呼ばない', async (status) => {
    put('node_modules/@ymasaki/ignite/package.json', '{"version":"1.0.0"}');
    stubs.spawn.mockReturnValue({ status });
    await command(['upgrade'], status ?? 1);
    expect(stubs.spawn).toHaveBeenCalledTimes(1);
});
