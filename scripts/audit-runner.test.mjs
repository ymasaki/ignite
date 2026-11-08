// 実プロセスでロック・失敗・中断を確認する。実際の監査サーバーは立てない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import path from 'node:path'

test('監査の排他と終了処理', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ignite-runner-'))
  const lock = path.join(dir, 'lock')
  const source = (await readFile(new URL('./audit-design.mjs', import.meta.url), 'utf8'))
    .replace("'/tmp/ignite-catalog-audit-5198.lock'", JSON.stringify(lock))
    .replace('1800000', '3000').replace('10800000', '8000').replace('60000', '5000') // 混んだマシンでも偽サーバーの起動が間に合う長さ
    .replace('60 * 1000', '1000') // 待機中の知らせの間隔
  async function fixture(name, body) {
    const root = path.join(dir, name)
    await mkdir(path.join(root, 'scripts'), { recursive: true })
    await mkdir(path.join(root, 'node_modules/@playwright/test'), { recursive: true })
    await writeFile(path.join(root, 'scripts/audit-design.mjs'), source)
    await writeFile(path.join(root, 'scripts/audit-cache.mjs'), await readFile(new URL('./audit-cache.mjs', import.meta.url), 'utf8'))
    await writeFile(path.join(root, 'scripts/audit-server.mjs'), "process.send({ready:true,port:41234}); setInterval(()=>{},1000)")
    await writeFile(path.join(root, 'node_modules/@playwright/test/cli.js'), body)
    return root
  }
  let lastOutput = ''
  const wrappers = []
  function run(root) {
    const child = spawn(process.execPath, ['scripts/audit-design.mjs'], { cwd: root })
    let output = ''
    child.stdout.on('data', x => { output += x })
    child.stderr.on('data', x => { output += x })
    child.done = new Promise(resolve => child.on('exit', code => { lastOutput = output; resolve({code, output}) }))
    wrappers.push(child)
    return child
  }
  const running = child => child.exitCode === null && child.signalCode === null
  // SIGKILLだけではラッパーの子の群が残り、出力のパイプを握ってテストのファイルが終われなくなる。
  // 先にSIGTERMでラッパー自身に子の群の停止とロックの解放をさせ、止まらないときだけSIGKILLする。
  async function terminate(child) {
    if (!running(child)) return
    child.kill('SIGTERM')
    let timer
    await Promise.race([child.done, new Promise(resolve => { timer = setTimeout(resolve, 15000) })])
    clearTimeout(timer)
    if (running(child)) child.kill('SIGKILL')
  }
  async function finishWithin(child) {
    let timer
    try {
      return await Promise.race([child.done, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('監査ラッパーが30秒以内に終了しません')), 30000)
      })])
    } finally {
      clearTimeout(timer)
      await terminate(child)
    }
  }
  // 混んだマシンでは起動に数秒かかる。待ちを打ち切っても、ラッパーは後始末で止める。
  async function waitForFile(file) {
    for (let i = 0; i < 300; i++) { try { await access(file); return } catch { await delay(100) } }
  }
  // 途中で失敗したサブテストのラッパーを残すと、ロックが後続へ連鎖し、ファイルも終われない。
  t.afterEach(async () => { for (const child of wrappers.splice(0)) await terminate(child) })
  async function gone() { await assert.rejects(access(lock), undefined, lastOutput) }
  try {
    await t.test('異なる版が同時開始しても順番に自分の版を実行', async () => {
      const a = await fixture('a', 'console.log("版A"); setTimeout(()=>{},200)')
      const b = await fixture('b', 'console.log("版B")')
      const results = await Promise.all([run(a).done, run(b).done])
      assert.equal(results[0].code, 0); assert.equal(results[1].code, 0)
      for (const result of results) assert.match(result.output, /harness-metric: stage=audit-lock seconds=\d+\.\d{3}/)
      assert.match(results[0].output, /版A/); assert.match(results[1].output, /版B/)
      assert.ok(results.some(x => x.output.includes('他の監査を待機')))
      await gone()
    })
    await t.test('監査サーバーが知らせたポートを監査へ渡す', async () => {
      const result = await run(await fixture('port', 'console.log("port=" + process.env.IGNITE_AUDIT_PORT)')).done
      assert.equal(result.code, 0, result.output)
      assert.match(result.output, /port=41234/)
      await gone()
    })
    await t.test('ポートを知らせないサーバーでは監査を始めない', async () => {
      const root = await fixture('noport', 'console.log("監査を実行")')
      await writeFile(path.join(root, 'scripts/audit-server.mjs'), "process.send({ready:true}); setInterval(()=>{},1000)")
      const result = await run(root).done
      assert.notEqual(result.code, 0)
      assert.doesNotMatch(result.output, /監査を実行/)
      await gone()
    })
    await t.test('監査失敗でも解放', async () => {
      assert.equal((await run(await fixture('fail', 'process.exit(7)')).done).code, 7)
      await gone()
    })
    for (const signal of ['SIGTERM', 'SIGINT']) await t.test(`${signal}で子群終了と解放`, async () => {
      const marker = path.join(dir, `${signal}.pid`)
      const child = run(await fixture(signal, `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid));setInterval(()=>{},1000)`))
      await waitForFile(marker)
      const pid = Number(await readFile(marker, 'utf8'))
      child.kill(signal)
      const result = await child.done
      assert.equal(result.code, signal === 'SIGTERM' ? 143 : 130, result.output)
      assert.ok(!result.output.includes('停止を確認できません'), result.output)
      assert.throws(() => process.kill(pid, 0))
      await gone()
    })
    await t.test('起動失敗・起動期限でも解放', async () => {
      const root = await fixture('startup', '')
      await writeFile(path.join(root, 'scripts/audit-server.mjs'), 'process.exit(1)')
      assert.equal((await run(root).done).code, 1); await gone()
      await writeFile(path.join(root, 'scripts/audit-server.mjs'), 'setInterval(()=>{},1000)')
      assert.equal((await run(root).done).code, 1); await gone()
    })
    await t.test('監査中のサーバー終了は監査も失敗・停止する', async () => {
      const marker = path.join(dir, 'server-death.pid')
      const root = await fixture('server-death', `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid));setInterval(()=>{},1000)`)
      await writeFile(path.join(root, 'scripts/audit-server.mjs'), 'process.send({ready:true,port:41234});setTimeout(()=>process.exit(0),500)')
      assert.equal((await run(root).done).code, 1)
      const pid = Number(await readFile(marker, 'utf8'))
      assert.throws(() => process.kill(pid, 0))
      await gone()
    })
    await t.test('同じ待機区間でサーバー終了と監査成功が届いても失敗', async () => {
      const root = await fixture('both-exit', 'setInterval(()=>{},1000)')
      // イベントがポーリング再開前に両方届いた状態を固定する。
      await writeFile(path.join(root, 'scripts/audit-design.mjs'), source.replace(
        '  while (audit.result === undefined) {',
        '  server.result = 0; audit.result = 0;\n  while (audit.result === undefined) {'))
      assert.equal((await run(root).done).code, 1)
      await gone()
    })
    for (const errorCode of ['ESRCH', 'EPERM']) await t.test(`停止要求直前に群が消えて${errorCode}になっても解放`, async () => {
      const root = await fixture(`kill-race-${errorCode}`, '')
      const inject = `
const realKill = process.kill.bind(process)
process.kill = (pid, signal) => {
  if (pid < 0 && signal === 'SIGTERM') {
    realKill(pid, 'SIGKILL')
    console.log('停止直前終了を注入')
    throw Object.assign(new Error('終了済み'), {code:'${errorCode}'})
  }
  return realKill(pid, signal)
}
`
      await writeFile(path.join(root, 'scripts/audit-design.mjs'), inject + source)
      const result = await run(root).done
      assert.match(result.output, /停止直前終了を注入/)
      assert.equal(result.code, 0, result.output)
      await gone()
    })
    await t.test('送信エラーで群が生存している場合はロックを保持', async () => {
      const marker = path.join(dir, 'denied-groups')
      const root = await fixture('denied', '')
      const inject = `
import {appendFileSync} from 'node:fs'
const realKill = process.kill.bind(process)
process.kill = (pid, signal) => {
  if (pid < 0 && signal === 'SIGTERM') {
    appendFileSync(${JSON.stringify(marker)}, String(pid)+'\\n')
    throw Object.assign(new Error('停止権限なし'), {code:'EPERM'})
  }
  return realKill(pid, signal)
}
`
      await writeFile(path.join(root, 'scripts/audit-design.mjs'), inject + source)
      try {
        const result = await finishWithin(run(root))
        assert.equal(result.code, 1, result.output)
        assert.match(result.output, /停止権限なし/)
        await access(lock)
      } finally {
        for (const group of (await readFile(marker, 'utf8')).trim().split('\n').map(Number)) {
          try { process.kill(group, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error }
        }
        await rm(lock, {recursive:true})
      }
    })
    for (const persistent of [false, true]) await t.test(`生存照会EPERMが${persistent ? '継続したら保持して有限終了' : '一時的なら消滅確認後に解放'}`, async () => {
      const marker = path.join(dir, `probe-${persistent}.pid`)
      const root = await fixture(`probe-${persistent}`, '')
      await writeFile(path.join(root, 'scripts/audit-server.mjs'), `
import {writeFileSync} from 'node:fs'
writeFileSync(${JSON.stringify(marker)}, String(process.pid))
process.send({ready:true,port:41234});setInterval(()=>{},1000)
`)
      const inject = `
import {readFileSync} from 'node:fs'
const realKill = process.kill.bind(process)
let probes = 0
process.kill = (pid, signal) => {
  if (pid < 0 && signal === 0 && pid === -Number(readFileSync(${JSON.stringify(marker)}, 'utf8'))) {
    probes++
    if (${persistent} || probes <= 3) {
      console.log('生存照会EPERMを注入')
      throw Object.assign(new Error('生存照会不能'), {code:'EPERM'})
    }
  }
  return realKill(pid, signal)
}
`
      await writeFile(path.join(root, 'scripts/audit-design.mjs'), inject + source)
      try {
        const result = await finishWithin(run(root))
        assert.match(result.output, /生存照会EPERMを注入/)
        assert.equal(result.code, persistent ? 1 : 0, result.output)
        if (persistent) {
          assert.match(result.output, /停止を確認できません/)
          await access(lock)
        } else {
          assert.equal(result.output.match(/生存照会EPERMを注入/g).length, 3)
          await gone()
        }
      } finally {
        const group = -Number(await readFile(marker, 'utf8'))
        try { process.kill(group, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error }
        await rm(lock, {recursive:true, force:true})
      }
    })
    await t.test('所有情報読取直後に先行が解放したら取得を再試行', async () => {
      const root = await fixture('release-race', '')
      await mkdir(lock)
      await writeFile(path.join(lock, 'owner.json'), JSON.stringify({pid:2147483647}))
      // EEXISTと所有情報読取の後、先行監査の解放と終了を固定する。
      await writeFile(path.join(root, 'scripts/audit-design.mjs'), source.replace(
        '    if (owner && Number.isInteger(owner.pid)',
        "    await rm(lock, {recursive:true, force:true})\n    if (owner && Number.isInteger(owner.pid)"))
      assert.equal((await run(root).done).code, 0)
      await gone()
    })
    await t.test('残骸と待機期限は削除せず明示', async () => {
      await mkdir(lock)
      const root = await fixture('locked', '')
      await writeFile(path.join(lock, 'owner.json'), JSON.stringify({pid: 2147483647}))
      const stale = await run(root).done
      assert.match(stale.output, /ロックが残っています/)
      assert.notEqual(stale.code, 0)
      assert.match(stale.output, /harness-metric: stage=audit-lock seconds=\d+\.\d{3}/)
      await access(lock)
      await writeFile(path.join(lock, 'owner.json'), JSON.stringify({pid: process.pid}))
      assert.match((await run(root).done).output, /30分を超えて保持/)
      await access(lock)
      await rm(lock, {recursive:true})
    })
    // 所有者を順に入れ替えて、複数の監査が並んだ状態を再現する。
    async function rotateOwners(until) {
      await mkdir(lock)
      for (let i = 0; !until(i); i++) {
        await writeFile(path.join(lock, 'owner.json'), JSON.stringify({pid: process.pid, root: `queued-${i}`}))
        await delay(2000)
      }
    }
    await t.test('所有者が入れ替わる間は保持の上限を超えても待ち続ける', async () => {
      const root = await fixture('queued', 'console.log("順番が来た")')
      const child = run(root)
      await rotateOwners(i => i === 3) // 約6秒。保持の上限（試験では3秒）より長い
      await rm(lock, {recursive:true})
      const result = await finishWithin(child)
      assert.equal(result.code, 0, result.output)
      assert.match(result.output, /順番が来た/)
      // 待っている間も出力が続く（出力が止まると呼び出し元に固まったと見なされる）
      assert.match(result.output, /\[audit\] 待機中: \d+秒（ロックの所有: queued-\d+）/)
      await gone()
    })
    await t.test('所有者が入れ替わり続けても全体の上限で打ち切る', async () => {
      const child = run(await fixture('starved', ''))
      let done = false
      child.done.then(() => { done = true })
      await rotateOwners(i => done || i === 10)
      const result = await finishWithin(child)
      assert.notEqual(result.code, 0)
      assert.match(result.output, /全体で3時間を超えました/)
      await access(lock)
      await rm(lock, {recursive:true})
    })
  } finally { await rm(dir, {recursive:true, force:true}) }
})
