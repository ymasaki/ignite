// 同じ端末・入力で成功した全件監査だけを共有する。判定不能なら実行へ戻す。
import fs from 'node:fs/promises'
import { openSync, closeSync, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const MAX_AGE = 24 * 60 * 60 * 1000
const digest = value => createHash('sha256').update(value).digest('hex')
const inside = (root, file) => file === root || file.startsWith(root + path.sep)
async function fileHash(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
// skip は根の直下で照合から外す名前（監査が読まない中間物）。
export async function treeFiles(root, links = false, skip = []) {
  if ((await fs.lstat(root)).isSymbolicLink()) throw new Error('入力の根にリンクは使えません')
  const base = await fs.realpath(root)
  const files = []
  const inputs = []
  async function walk(dir) {
    for (const name of (await fs.readdir(dir)).sort()) {
      if (dir === base && skip.includes(name)) continue
      const file = path.join(dir, name)
      const relative = path.relative(base, file)
      const stat = await fs.lstat(file)
      if (stat.isSymbolicLink()) {
        if (!links || !inside(base, await fs.realpath(file))) throw new Error('外部参照を含む入力')
        files.push([relative, 'link', (await fs.readlink(file)).replaceAll(base, '<ROOT>')])
      } else if (stat.isDirectory()) await walk(file)
      else if (stat.isFile()) {
        inputs.push([files.length, file])
        files.push([relative, stat.mode & 0o777, null])
      }
      else throw new Error('通常ファイル以外の入力')
    }
  }
  await walk(base)
  // 列挙順と全バイトの照合を保ち、読み取り待ちだけを最大4個重ねる。
  let next = 0
  const workers = Array.from({ length: Math.min(4, inputs.length) }, async () => {
    while (next < inputs.length) {
      const [index, file] = inputs[next++]
      files[index][2] = await fileHash(file)
    }
  })
  // 失敗しても他の読み取りが終わるまで待ち、部分的な結果を返さない。
  const settled = await Promise.allSettled(workers)
  const failure = settled.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
  return files
}
function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')))
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
// 値は保存せず、ハッシュだけをキーに含める。未知の環境変数は省かない。
function environment(root, env) {
  // 起動元の識別・通信・実行制御だけを除く。未知の変数や描画設定は引き続き照合する。
  const omit = new Set([
    'PWD', 'OLDPWD', 'SHLVL', '_', 'IGNITE_AUDIT_FRESH',
    'DEVBOARD_PROGRESS_STAGE', 'DEVBOARD_PROGRESS_WEIGHTS', 'DEVBOARD_PROJECT_DIR',
    'DEVBOARD_BASE_BRANCH', 'DEVBOARD_COMMIT', 'DEVBOARD_CHECK_PRIORITY',
    'DEVBOARD_COMPUTER_SOCKET', 'DEVBOARD_COMPUTER_TOKEN', 'DEVBOARD_DISTRIBUTED_PROTOCOL',
    'DEVBOARD_DISTRIBUTED_SOCKET', 'DEVBOARD_RESOURCE_LABEL', 'DEVBOARD_RESOURCE_MAX_WAIT',
    'DEVBOARD_SHIM_DIR', 'DEVBOARD_TIMING_ORIGIN',
    'CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS', 'CODEX_CI', 'CODEX_SANDBOX',
    'CODEX_SANDBOX_NETWORK_DISABLED', 'CODEX_SESSION_ID', 'CODEX_THREAD_ID',
    'CODEX_TOOL_CALL_ID', 'CODEX_VERSION', 'CLAUDE_CODE_ENABLE_TODO_TOOLS',
    // Claude Code のセッションごとに変わる識別・通信・実行制御と、起動元の印。描画には使わない。
    'AI_AGENT', 'CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_ENABLE_TELEMETRY', 'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_EXECPATH', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_CODE_SESSION_ATTENDED',
    'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT', 'CLAUDE_EFFORT', 'CLAUDE_PID',
    // macOS のログイン・起動ごとに変わる識別と、鍵エージェントの通信先。
    'LaunchInstanceID', 'SECURITYSESSIONID', 'SSH_AUTH_SOCK',
  ])
  return Object.entries(env).filter(([name]) => !omit.has(name)).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => [name, String(value) === root ? '<ROOT>' : String(value).replaceAll(root + path.sep, '<ROOT>/')])
}
// 出力先は相対パス全体で限定する。同じ名前のディレクトリが入力配下にあっても除外しない。
const GENERATED_DIRECTORIES = new Set([
  'dist', 'test-results', 'test-results-audit', 'playwright-report', 'releases', 'catalog-dist',
  'catalog/test-results-audit', 'catalog/playwright-report',
])
export async function hasUnsupportedInputs(root, tracked) {
  async function walk(dir, generated = false) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      if (dir === root && (item.name === 'node_modules' || item.name === '.git')) continue
      const file = path.join(dir, item.name)
      const relative = path.relative(root, file).split(path.sep).join('/')
      if (item.name === 'node_modules') return true
      if (item.isSymbolicLink()) return true
      if (item.isDirectory()) {
        if (await walk(file, generated || GENERATED_DIRECTORIES.has(relative))) return true
      } else if (!item.isFile() || (!generated && !tracked.has(relative))) return true
    }
    return false
  }
  return walk(root)
}
async function sourceTree(root) {
  if (git(root, ['status', '--porcelain', '--untracked-files=all'])) return null
  const entries = git(root, ['ls-files', '-v', '-z']).split('\0').filter(Boolean)
  // 小文字はassume-unchanged、S/sはskip-worktree。実体を隠せるindex設定では再利用しない。
  if (entries.some(entry => /^[a-zS] /.test(entry))) return null
  const tracked = new Set(entries.map(entry => entry.slice(2)))
  if (await hasUnsupportedInputs(root, tracked)) return null
  if (git(root, ['ls-files', '--stage', '-z']).split('\0').some(entry => /^(120000|160000) /.test(entry))) return null
  return git(root, ['rev-parse', 'HEAD^{tree}'])
}
// 他プロジェクト用の版は入力にしない。実際に使う版のバイナリ・描画資源はすべて照合する。
export async function browserFiles(executable, manifest) {
  let browser = executable
  while (!/^chromium-\d+$/.test(path.basename(browser))) {
    const parent = path.dirname(browser)
    if (parent === browser) throw new Error('ブラウザの配置を特定できません')
    browser = parent
  }
  const chromium = manifest.browsers.find(item => item.name === 'chromium')
  const headless = manifest.browsers.find(item => item.name === 'chromium-headless-shell')
  const ffmpeg = manifest.browsers.find(item => item.name === 'ffmpeg')
  if (!chromium || !headless || !ffmpeg || chromium.revision !== headless.revision ||
      JSON.stringify(chromium.revisionOverrides ?? {}) !== JSON.stringify(headless.revisionOverrides ?? {}) ||
      Object.keys(ffmpeg.revisionOverrides ?? {}).length) throw new Error('ブラウザの版の対応を特定できません')
  const revision = path.basename(browser).slice('chromium-'.length)
  if (![chromium.revision, ...Object.values(chromium.revisionOverrides ?? {})].includes(revision)) throw new Error('ブラウザの版が一致しません')
  const directory = path.dirname(browser)
  const names = [path.basename(browser), `chromium_headless_shell-${revision}`, `ffmpeg-${ffmpeg.revision}`]
  const files = []
  for (const name of names) files.push([name, await treeFiles(path.join(directory, name), true)])
  return files
}
export const DEPENDENCY_SCRATCH = ['.vitest-cache']
export async function auditRuntime(root) {
  if (process.platform !== 'darwin') throw new Error('実行環境の照合はmacOSのみ対応')
  // Viteが作る中間物は入力にしない。開始前・子群停止確認後に消し、古い中間物を使わせない。
  for (const name of ['.vite', '.vite-temp']) await fs.rm(path.join(root, 'node_modules', name), { recursive: true, force: true })
  // 単体テストの変換キャッシュは監査が読まず、単体テストを挟むたびに変わるので照合しない（消すと単体テストが遅くなるので残す）。
  const dependencies = await treeFiles(path.join(root, 'node_modules'), true, DEPENDENCY_SCRATCH)
  const { chromium } = await import(pathToFileURL(path.join(root, 'node_modules/playwright-core/index.mjs')).href)
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'node_modules/playwright-core/browsers.json'), 'utf8'))
  const browsers = await browserFiles(chromium.executablePath(), manifest)
  const fonts = JSON.parse(execFileSync('/usr/sbin/system_profiler', ['SPFontsDataType', '-json'], { encoding: 'utf8', timeout: 30000, maxBuffer: 20 * 1024 * 1024 })).SPFontsDataType
  if (!Array.isArray(fonts) || !fonts.length || fonts.some(font => !path.isAbsolute(font.path))) throw new Error('書体を照合できません')
  const fontFiles = []
  for (const file of [...new Set(fonts.map(font => font.path))].sort()) fontFiles.push([file, await fileHash(file)])
  return { host: [process.version, await fileHash(process.execPath), os.release(), os.version(), os.arch(), os.hostname()], dependencies, browsers, fonts, fontFiles }
}
export async function auditInput(root, env = process.env, inspectRuntime = auditRuntime) {
  try {
    root = await fs.realpath(root)
    if (await fs.realpath(git(root, ['rev-parse', '--show-toplevel'])) !== root) return null
    const tree = await sourceTree(root)
    if (!tree) return null
    const conditions = await inspectRuntime(root)
    if (await sourceTree(root) !== tree) return null
    const store = path.join(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']), 'devboard/ignite-audit-cache-v1')
    const environmentHash = digest(JSON.stringify(environment(root, env)))
    const parts = Array.isArray(conditions) ? { runtime: conditions } : conditions
    const fingerprints = { source: tree, environment: environmentHash, ...Object.fromEntries(Object.entries(parts).map(([name, value]) => [name, digest(JSON.stringify(value))])) }
    return { key: digest(JSON.stringify([1, fingerprints])), store, fingerprints }
  } catch { return null }
}

async function acquire(file, interrupted) {
  const fd = openSync(file, 'a')
  const deadline = Date.now() + 10800000
  const started = performance.now()
  const heartbeat = 60 * 1000
  let lastBeat = started
  let reported = false
  try {
    while (!interrupted()) {
      // BSD flockは同じopen file descriptionの最後のFDが閉じるまで続く。所有記録や手動解除は不要。
      const result = spawnSync('/usr/bin/lockf', ['-s', '-t', '1', '3'], { stdio: ['ignore', 'ignore', 'pipe', fd] })
      if (result.status === 0) return fd
      if (result.error || result.status !== 75) throw new Error('監査結果の入力ロックを取得できません')
      if (!reported) { console.log('[audit-cache] 同一入力の監査を待機'); reported = true }
      else if (performance.now() - lastBeat >= heartbeat) {
        lastBeat = performance.now()
        console.log(`[audit-cache] 待機中: ${Math.round((lastBeat - started) / 1000)}秒（同一入力の監査）`)
      }
      if (Date.now() >= deadline) throw new Error('監査結果の入力ロック待機が3時間を超えました')
      await delay(10)
    }
    throw new Error('監査を中断しました')
  } catch (error) { closeSync(fd); throw error }
  finally { console.log(`harness-metric: stage=audit-input-lock seconds=${((performance.now() - started) / 1000).toFixed(3)}`) }
}
// 期限切れの成功結果と、保存途中の残り・使われていないロックを消す（鍵は入力と環境ごとに変わるので、消さないと溜まり続ける）。
// 期限内の成功結果は残す。消せなくても監査は続ける。
export async function pruneAuditCache(store, keep, now = Date.now()) {
  let removed = 0
  for (const name of (await fs.readdir(store)).sort()) {
    if (name === keep || name === `${keep}.lock`) continue
    const file = path.join(store, name)
    try {
      const stat = await fs.lstat(file)
      if (stat.isDirectory()) {
        // 成功結果は記録の時刻、保存途中の残り（.audit-save-*）や壊れた項目は更新時刻で数える。
        let createdAt = stat.mtimeMs
        if (!name.startsWith('.')) {
          try { createdAt = JSON.parse(await fs.readFile(path.join(file, 'success.json'), 'utf8')).createdAt } catch { /* 更新時刻で数える */ }
        }
        const age = now - createdAt
        if (Number.isFinite(age) && age < MAX_AGE) continue
        await fs.rm(file, { recursive: true, force: true }); removed++
      } else if (stat.isFile() && name.endsWith('.lock') && now - stat.mtimeMs >= MAX_AGE) {
        try { await fs.access(file.slice(0, -'.lock'.length)); continue } catch { /* 成功結果がない鍵のロックだけを消す */ }
        // 実行中・待機中の監査が持っていないことを確かめてから消す。
        const fd = openSync(file, 'a')
        try {
          if (spawnSync('/usr/bin/lockf', ['-s', '-t', '0', '3'], { stdio: ['ignore', 'ignore', 'ignore', fd] }).status !== 0) continue
          await fs.rm(file, { force: true }); removed++
        } finally { closeSync(fd) }
      }
    } catch { /* ほかの監査が同時に消した項目などは次回に回す */ }
  }
  return removed
}
// 同じソースの直近の成功と、どの条件が違ったかを返す（再利用が当たらない理由を追えるようにする）。
async function changedSince(store, input) {
  if (!input.fingerprints) return null
  let latest
  for (const name of await fs.readdir(store)) {
    try {
      const record = JSON.parse(await fs.readFile(path.join(store, name, 'success.json'), 'utf8'))
      if (record.fingerprints?.source === input.fingerprints.source && (!latest || record.createdAt > latest.createdAt)) latest = record
    } catch { /* 成功結果でない項目 */ }
  }
  return latest ? Object.keys(input.fingerprints).filter(name => input.fingerprints[name] !== latest.fingerprints[name]) : null
}
export async function openAuditCache(root, args, interrupted, options = {}) {
  const env = options.env ?? process.env
  const snapshot = options.snapshot ?? (() => auditInput(root, env))
  const now = options.now ?? Date.now
  const input = await snapshot()
  if (!input) { console.log('[audit-cache] 再利用せず全件実行（未保存の変更または実行条件を照合できません）'); return null }
  await fs.mkdir(input.store, { recursive: true })
  const fd = await acquire(path.join(input.store, `${input.key}.lock`), interrupted)
  const entry = path.join(input.store, input.key)
  const output = path.join(root, 'catalog/test-results-audit')
  const invalidate = () => fs.rm(entry, { recursive: true, force: true })
  let closed = false
  const close = () => { if (!closed) { closed = true; closeSync(fd) } }
  let restore
  try {
    try {
      const removed = await pruneAuditCache(input.store, input.key, now())
      if (removed) console.log(`[audit-cache] 期限切れの保存結果を${removed}件消しました`)
    } catch { /* 掃除できなくても監査は続ける */ }
    if ((await snapshot())?.key !== input.key) { close(); return null }
    const full = args.length === 0 && !env.IGNITE_STEPPER_SCREENSHOT
    if (full && env.IGNITE_AUDIT_FRESH !== '1') {
      try {
        const record = JSON.parse(await fs.readFile(path.join(entry, 'success.json'), 'utf8'))
        const age = now() - record.createdAt
        if (record.key !== input.key || !Number.isFinite(age) || age < 0 || age >= MAX_AGE) throw new Error('期限切れ')
        const scratch = path.join(root, 'test-results')
        await fs.mkdir(scratch, { recursive: true })
        restore = await fs.mkdtemp(path.join(scratch, '.audit-restore-'))
        await fs.cp(path.join(entry, 'output'), path.join(restore, 'output'), { recursive: true })
        const files = await treeFiles(path.join(restore, 'output'))
        if (!files.some(([name]) => name === 'report.md') || JSON.stringify(files) !== JSON.stringify(record.files)) throw new Error('成果物不一致')
        if (interrupted() || (await snapshot())?.key !== input.key) throw new Error('入力変更または中断')
        await fs.rm(output, { recursive: true, force: true })
        await fs.rename(path.join(restore, 'output'), output)
        await fs.rm(restore, { recursive: true, force: true }); restore = undefined
        console.log(`[audit-cache] 同じ入力・環境の全件監査を再利用（${Math.floor(age / 1000)}秒前）`)
        return { hit: true, close, invalidate }
      } catch {
        if (restore) {
          await fs.rm(restore, { recursive: true, force: true }); restore = undefined
          await fs.rm(output, { recursive: true, force: true })
        }
      }
    }
    if (full && env.IGNITE_AUDIT_FRESH !== '1') {
      try {
        const changed = await changedSince(input.store, input)
        if (changed?.length) console.log(`[audit-cache] 同じソースの直近の成功と違う条件: ${changed.join('・')}`)
      } catch { /* 理由を出せなくても監査は続ける */ }
    }
    // 再確認を始めた時点で、以前の成功を失効する。失敗・中断では再公開しない。
    await fs.rm(entry, { recursive: true, force: true })
    if (interrupted()) throw new Error('監査を中断しました')
    console.log('[audit-cache] 成功結果なし・強制再確認・対象外のため監査を実行')
    return {
      hit: false, close, invalidate,
      async publish() {
        let temporary
        try {
          if (!full || interrupted()) return
          const current = await snapshot()
          if (current?.key !== input.key) {
            const changed = Object.keys(input.fingerprints ?? {}).filter(name => input.fingerprints[name] !== current?.fingerprints?.[name])
            console.log(`[audit-cache] ${changed.join('・') || '入力または実行条件'}が変わったため成功を保存しません`)
            return
          }
          temporary = await fs.mkdtemp(path.join(input.store, '.audit-save-'))
          await fs.cp(output, path.join(temporary, 'output'), { recursive: true })
          const files = await treeFiles(path.join(temporary, 'output'))
          if (!files.some(([name]) => name === 'report.md')) throw new Error('監査レポートがありません')
          await fs.writeFile(path.join(temporary, 'success.json'), JSON.stringify({ key: input.key, createdAt: now(), files, fingerprints: input.fingerprints }))
          if (interrupted()) return
          await fs.rename(temporary, entry); temporary = undefined
          console.log('[audit-cache] 全件成功を保存しました（有効期間24時間）')
        } catch (error) { console.warn(`[audit-cache] 保存できません: ${error.message}`) }
        finally { if (temporary) await fs.rm(temporary, { recursive: true, force: true }) }
      },
    }
  } catch (error) { close(); throw error }
}
