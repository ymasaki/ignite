// 全worktreeで同じロックを使う。残骸・他者のサーバーは削除も流用もしない。
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
// ポートは毎回空きを選ぶが、旧版の監査とも順番を取り合えるよう、ロックの名前は以前のまま使う。
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
    if (error.code === 'EPERM') return true // 確認不能は生存として扱い、解放しない
    throw error
  }
}
function start(args, ipc = false, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: root, detached: true,
    stdio: ipc ? ['ignore', 'inherit', 'inherit', 'ipc'] : 'inherit',
    env: { ...process.env, IGNITE_AUDIT_MANAGED: '1', ...env },
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
  // 複数の監査が並ぶと待ち時間は件数に比例する。順番が進んでいる間は待ち、
  // 同じ所有者が保持し続けたときと全体が長すぎるときだけ打ち切る。
  const holdLimit = 1800000
  const totalDeadline = Date.now() + 10800000
  let deadline = Date.now() + holdLimit
  let holder
  let reported = false
  // 待っている間も一定の間隔で出力する。何も出さないと、呼び出し元（DevBoard の取り込み前の確認など）が
  // 固まったと見なして止めてしまうため。
  const heartbeat = 60 * 1000
  const waitStart = Date.now()
  let lastBeat = waitStart
  while (!interrupted) {
    if (await tryAcquire()) return
    let owner
    try { owner = JSON.parse(await readFile(`${lock}/owner.json`, 'utf8')) } catch {}
    const key = owner && Number.isInteger(owner.pid) ? `${owner.pid}:${owner.root}` : undefined
    if (key && key !== holder) {
      // 所有者の交代は順番が進んだ証拠なので、保持時間を数え直す。
      if (holder !== undefined) deadline = Date.now() + holdLimit
      holder = key
    }
    if (owner && Number.isInteger(owner.pid) && owner.pid > 0 && !alive(owner.pid)) {
      // 読み取った直後に先行監査が解放・終了した可能性がある。
      if (await tryAcquire()) return
      let current
      try { current = JSON.parse(await readFile(`${lock}/owner.json`, 'utf8')) } catch {}
      if (current?.pid === owner.pid && current?.root === owner.root && !alive(current.pid)) {
        throw new Error(`監査ロックが残っています: ${lock} (${JSON.stringify(owner)})。所有元と監査サーバーの終了を確認して手動で除去してください。自動削除はしません。`)
      }
    }
    if (Date.now() >= deadline) throw new Error(`同じ監査が監査ロックを30分を超えて保持しています: ${lock} (${JSON.stringify(owner)})`)
    if (Date.now() >= totalDeadline) throw new Error(`監査ロック待機が全体で3時間を超えました: ${lock} (${JSON.stringify(owner)})`)
    if (!reported) { console.log(`[audit] 他の監査を待機: ${lock}`); reported = true }
    else if (Date.now() - lastBeat >= heartbeat) {
      lastBeat = Date.now()
      console.log(`[audit] 待機中: ${Math.round((lastBeat - waitStart) / 1000)}秒（ロックの所有: ${owner?.root ?? '不明'}）`)
    }
    await delay(200)
  }
  throw new Error('監査を中断しました')
}
async function signalGroup(group, signal) {
  try { process.kill(group, signal) } catch (error) {
    if (error.code === 'ESRCH') return
    // 送信エラーが出ても、すでに終了している可能性がある。
    // 終了が確認できた場合だけ許容し、生存・確認不能なら保持する。
    for (let i = 0; i < 50 && alive(group); i++) await delay(100)
    if (alive(group)) throw error
  }
}
async function stop(child) {
  if (!child.pid) return
  const group = -child.pid
  if (!alive(group)) return
  await signalGroup(group, 'SIGTERM')
  for (let i = 0; i < 50 && alive(group); i++) await delay(100)
  if (alive(group)) await signalGroup(group, 'SIGKILL')
  for (let i = 0; i < 50 && alive(group); i++) await delay(100)
  if (alive(group)) throw new Error(`所有プロセス群 ${child.pid} の停止を確認できません。ロックを残します: ${lock}`)
}
try {
  const waitStarted = performance.now()
  try { await acquire() } finally {
    console.log(`harness-metric: stage=audit-lock seconds=${((performance.now() - waitStarted) / 1000).toFixed(3)}`)
  }
  if (interrupted) throw new Error('監査を中断しました')
  const server = start([fileURLToPath(new URL('./audit-server.mjs', import.meta.url))], true)
  let ready = false
  let port
  server.on('message', message => {
    if (message?.ready && Number.isInteger(message.port) && message.port > 0) { port = message.port; ready = true }
  })
  const deadline = Date.now() + 60000
  while (!ready) {
    if (server.failure || server.result !== undefined) throw new Error('監査サーバーを起動できません（停止・流用はしません）。')
    if (interrupted || Date.now() >= deadline) throw new Error('監査サーバー起動の中断または60秒の期限超過')
    await delay(100)
  }
  const audit = start([fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)), 'test', '-c', 'catalog/playwright.audit.config.ts', ...process.argv.slice(2)], false, { IGNITE_AUDIT_PORT: String(port) })
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
  if (!stopped) {
    // 停止不能でも呼出し元を無限待機させない。ロックは残して失敗を返す。
    for (const child of children) {
      if (child.connected) child.disconnect()
      child.unref()
    }
  }
  if (interrupted) process.exitCode = interrupted
}
