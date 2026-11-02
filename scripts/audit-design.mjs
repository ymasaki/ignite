// 全worktreeで同じロックを使う。残骸・他者のサーバーは削除も流用もしない。
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const lock = '/tmp/ignite-catalog-audit-5198.lock'
const children = []
let owned = false
let interrupted = 0
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
  process.on(signal, () => { interrupted ||= code })
}
function alive(pid) {
  try { process.kill(pid, 0); return true } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}
function start(args, ipc = false) {
  const child = spawn(process.execPath, args, {
    cwd: root, detached: true,
    stdio: ipc ? ['ignore', 'inherit', 'inherit', 'ipc'] : 'inherit',
    env: { ...process.env, IGNITE_AUDIT_MANAGED: '1' },
  })
  child.on('error', error => { child.failure = error })
  child.on('exit', (code, signal) => { child.result = code ?? (signal ? 1 : 0) })
  children.push(child)
  return child
}
async function tryAcquire() {
  try { await mkdir(lock) } catch (error) {
    if (error.code === 'EEXIST') return false
    throw error
  }
  owned = true
  await writeFile(`${lock}/owner.json`, JSON.stringify({ pid: process.pid, root }))
  console.log(`[audit] ロック取得: ${root}`)
  return true
}
async function acquire() {
  const deadline = Date.now() + 600000
  let reported = false
  while (!interrupted) {
    if (await tryAcquire()) return
    let owner
    try { owner = JSON.parse(await readFile(`${lock}/owner.json`, 'utf8')) } catch {}
    if (owner && Number.isInteger(owner.pid) && owner.pid > 0 && !alive(owner.pid)) {
      // 読み取った直後に先行監査が解放・終了した可能性がある。
      if (await tryAcquire()) return
      let current
      try { current = JSON.parse(await readFile(`${lock}/owner.json`, 'utf8')) } catch {}
      if (current?.pid === owner.pid && current?.root === owner.root && !alive(current.pid)) {
        throw new Error(`監査ロックが残っています: ${lock} (${JSON.stringify(owner)})。所有元と5198の終了を確認して手動で除去してください。自動削除はしません。`)
      }
    }
    if (Date.now() >= deadline) throw new Error(`監査ロック待機が10分を超えました: ${lock} (${JSON.stringify(owner)})`)
    if (!reported) { console.log(`[audit] 他の監査を待機: ${lock}`); reported = true }
    await delay(200)
  }
  throw new Error('監査を中断しました')
}
function signalGroup(group, signal) {
  try { process.kill(group, signal) } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}
async function stop(child) {
  if (!child.pid) return
  const group = -child.pid
  if (!alive(group)) return
  signalGroup(group, 'SIGTERM')
  for (let i = 0; i < 50 && alive(group); i++) await delay(100)
  if (alive(group)) signalGroup(group, 'SIGKILL')
  for (let i = 0; i < 50 && alive(group); i++) await delay(100)
  if (alive(group)) throw new Error(`所有プロセス群 ${child.pid} の停止を確認できません。ロックを残します: ${lock}`)
}
try {
  await acquire()
  if (interrupted) throw new Error('監査を中断しました')
  const server = start([fileURLToPath(new URL('./audit-server.mjs', import.meta.url))], true)
  let ready = false
  server.on('message', message => { if (message?.ready) ready = true })
  const deadline = Date.now() + 60000
  while (!ready) {
    if (server.failure || server.result !== undefined) throw new Error('監査サーバーを起動できません。5198の既存占有などを確認してください（停止・流用はしません）。')
    if (interrupted || Date.now() >= deadline) throw new Error('監査サーバー起動の中断または60秒の期限超過')
    await delay(100)
  }
  const audit = start([fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)), 'test', '-c', 'catalog/playwright.audit.config.ts', ...process.argv.slice(2)])
  while (audit.result === undefined) {
    if (interrupted || audit.failure || server.failure || server.result !== undefined) throw new Error('監査が中断されたか、監査サーバーが終了しました')
    await delay(100)
  }
  // 両方の終了通知が同じ待機区間に届いた場合も成功にしない。
  if (interrupted || audit.failure || server.failure || server.result !== undefined) throw new Error('監査が中断されたか、監査サーバーが終了しました')
  process.exitCode = audit.result
} catch (error) {
  console.error(`[audit] ${error.message}`)
  process.exitCode = interrupted || 1
} finally {
  let stopped = true
  for (const child of children.toReversed()) {
    try { await stop(child) } catch (error) { stopped = false; console.error(error.message); process.exitCode = 1 }
  }
  if (owned && stopped) await rm(lock, { recursive: true })
  if (interrupted) process.exitCode = interrupted
}
