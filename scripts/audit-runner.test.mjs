// 実プロセスでロック・失敗・中断を確認する。固定5198の他者のサーバーには触れない。
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
    .replace('600000', '3000').replace('60000', '600')
  async function fixture(name, body) {
    const root = path.join(dir, name)
    await mkdir(path.join(root, 'scripts'), { recursive: true })
    await mkdir(path.join(root, 'node_modules/@playwright/test'), { recursive: true })
    await writeFile(path.join(root, 'scripts/audit-design.mjs'), source)
    await writeFile(path.join(root, 'scripts/audit-server.mjs'), "process.send({ready:true}); setInterval(()=>{},1000)")
    await writeFile(path.join(root, 'node_modules/@playwright/test/cli.js'), body)
    return root
  }
  function run(root) {
    const child = spawn(process.execPath, ['scripts/audit-design.mjs'], { cwd: root })
    let output = ''
    child.stdout.on('data', x => { output += x })
    child.stderr.on('data', x => { output += x })
    child.done = new Promise(resolve => child.on('exit', code => resolve({code, output})))
    return child
  }
  async function gone() { await assert.rejects(access(lock)) }
  try {
    await t.test('異なる版が同時開始しても順番に自分の版を実行', async () => {
      const a = await fixture('a', 'console.log("版A"); setTimeout(()=>{},200)')
      const b = await fixture('b', 'console.log("版B")')
      const results = await Promise.all([run(a).done, run(b).done])
      assert.equal(results[0].code, 0); assert.equal(results[1].code, 0)
      assert.match(results[0].output, /版A/); assert.match(results[1].output, /版B/)
      assert.ok(results.some(x => x.output.includes('他の監査を待機')))
      await gone()
    })
    await t.test('監査失敗でも解放', async () => {
      assert.equal((await run(await fixture('fail', 'process.exit(7)')).done).code, 7)
      await gone()
    })
    for (const signal of ['SIGTERM', 'SIGINT']) await t.test(`${signal}で子群終了と解放`, async () => {
      const marker = path.join(dir, `${signal}.pid`)
      const child = run(await fixture(signal, `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid));setInterval(()=>{},1000)`))
      for (let i=0;i<100;i++) { try { await access(marker); break } catch { await delay(20) } }
      const pid = Number(await readFile(marker, 'utf8'))
      child.kill(signal)
      assert.notEqual((await child.done).code, 0)
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
    await t.test('残骸と待機期限は削除せず明示', async () => {
      await mkdir(lock)
      const root = await fixture('locked', '')
      await writeFile(path.join(lock, 'owner.json'), JSON.stringify({pid: 2147483647}))
      assert.match((await run(root).done).output, /ロックが残っています/)
      await access(lock)
      await writeFile(path.join(lock, 'owner.json'), JSON.stringify({pid: process.pid}))
      assert.match((await run(root).done).output, /待機が10分を超えました/)
      await access(lock)
    })
  } finally { await rm(dir, {recursive:true, force:true}) }
})
