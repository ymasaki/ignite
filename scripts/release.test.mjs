// GitHubにも配布用検査にも接続しない。失敗した段階からの再実行を確認する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { release, buildPackage, command } from './release.mjs'

const commit = 'a'.repeat(40)
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-release-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@ymasaki/ignite', version: '1.3.1' }))
  const state = { private: true, synced: true, dirty: false, tag: null, remote: null, assets: [], builds: 0, writes: 0, calls: [], failUpload: false, losePublish: false }
  const filename = 'ymasaki-ignite-1.3.1.tgz'
  const json = value => Buffer.from(JSON.stringify(value))
  const run = (cmd, args) => {
    state.calls.push([cmd, args])
    if (cmd === 'git') return Buffer.from(args[0] === 'rev-parse' ? commit : state.dirty ? ' M package.json' : '')
    if (cmd === 'tar') return json({ name: '@ymasaki/ignite', version: '1.3.1' })
    assert.equal(cmd, 'gh')
    if (args[0] === 'release') {
      assert.ok(!args.includes('--clobber'))
      assert.ok(args.includes('github.com/ymasaki/ignite'))
      state.writes++
      const name = path.basename(args[3])
      state.assets.push({ id: state.assets.length + 1, name, data: fs.readFileSync(args[3]) })
      if (state.failUpload) { state.failUpload = false; throw Error('添付成功後の応答喪失') }
      return Buffer.alloc(0)
    }
    const endpoint = args[3]
    const method = args.includes('--method') ? args[args.indexOf('--method') + 1] : 'GET'
    if (endpoint === 'repos/ymasaki/ignite') return json({ private: state.private })
    if (endpoint.endsWith(`/commits/${commit}`)) {
      if (!state.synced) throw Error('同期されていない')
      return json({ sha: commit })
    }
    if (endpoint.endsWith('/git/ref/tags/v1.3.1')) {
      if (!state.tag) throw Object.assign(Error('Not Found (HTTP 404)'), { notFound: true })
      return json({ object: { sha: state.tag } })
    }
    if (endpoint.endsWith('/commits/v1.3.1')) {
      if (!state.tag) throw Object.assign(Error('Not Found (HTTP 404)'), { notFound: true })
      return json({ sha: state.tag })
    }
    if (endpoint.endsWith('/releases')) {
      if (method === 'POST') {
        assert.ok(args.includes('target_commitish=' + commit))
        assert.ok(args.includes('draft=true'))
        state.writes++
        state.remote = { id: 17, draft: true, tag_name: 'v1.3.1', target_commitish: commit, html_url: 'https://github.com/ymasaki/ignite/releases/tag/v1.3.1' }
        return json(state.remote)
      }
      return json([state.remote ? [state.remote] : []])
    }
    if (endpoint.endsWith('/releases/17')) {
      if (method === 'PATCH') {
        state.writes++
        state.remote.draft = false
        state.tag = commit
        if (state.losePublish) { state.losePublish = false; throw Error('公開成功後の応答喪失') }
      }
      return json(state.remote)
    }
    if (endpoint.endsWith('/releases/17/assets')) return json([state.assets.map(({ id, name }) => ({ id, name }))])
    const asset = state.assets.find(a => endpoint.endsWith(`/releases/assets/${a.id}`))
    if (asset) return asset.data
    throw Error(`想定外: ${cmd} ${args}`)
  }
  const build = (_root, _commit, stage) => { state.builds++; fs.writeFileSync(path.join(stage, filename), '固定tgz') }
  const perform = options => release({ root, commit, run, build, ...options })
  return { root, state, filename, perform, run }
}

test('Privateで固定物を公開し、再実行は読み取りだけで成功する', t => {
  const { perform, state } = fixture(t)
  assert.match(perform(), /v1.3.1$/)
  assert.equal(state.builds, 1)
  assert.equal(state.writes, 5) // draft・添付3つ・公開
  perform()
  assert.equal(state.builds, 1)
  assert.equal(state.writes, 5)
})
for (const [label, change] of [
  ['Public', s => { s.private = false }],
  ['未同期', s => { s.synced = false }],
  ['他のタグコミット', s => { s.tag = 'b'.repeat(40) }],
  ['未コミット変更', s => { s.dirty = true }],
]) test(`${label}なら配布を始めない`, t => {
  const { perform, state } = fixture(t)
  change(state)
  assert.throws(() => perform())
  assert.equal(state.builds, 0)
  assert.equal(state.writes, 0)
})
test('指定コミット不一致を止める', t => {
  const { perform } = fixture(t)
  assert.throws(() => perform({ commit: 'b'.repeat(40) }), /HEAD/)
})
test('添付成功後に応答が失われても、次回は残りだけを添付する', t => {
  const { perform, state } = fixture(t)
  state.failUpload = true
  assert.throws(() => perform(), /応答喪失/)
  assert.equal(state.remote.draft, true)
  assert.equal(state.assets.length, 1)
  perform()
  assert.equal(state.assets.length, 3)
  assert.equal(state.builds, 1)
})
test('公開成功後の応答喪失も、再実行でpublishedを照合して成功する', t => {
  const { perform, state } = fixture(t)
  state.losePublish = true
  assert.throws(() => perform(), /応答喪失/)
  assert.equal(state.remote.draft, false)
  const writes = state.writes
  perform()
  assert.equal(state.writes, writes)
})
for (const label of ['違う添付', '余計な添付', '違うdraft元コミット']) test(`${label}は変更せず停止する`, t => {
  const { perform, state } = fixture(t)
  state.failUpload = true
  assert.throws(() => perform())
  if (label === '違う添付') state.assets[0].data = Buffer.from('別物')
  if (label === '余計な添付') state.assets.push({ id: 9, name: 'extra', data: Buffer.alloc(0) })
  if (label === '違うdraft元コミット') state.remote.target_commitish = 'main'
  const writes = state.writes
  assert.throws(() => perform())
  assert.equal(state.writes, writes)
  assert.equal(state.remote.draft, true)
})
test('公開前にPrivateでなくなったらdraftのまま停止', t => {
  const { perform, state, run } = fixture(t)
  const changing = (cmd, args, options) => {
    if (cmd === 'gh' && args[3] === 'repos/ymasaki/ignite' && state.assets.length === 3) state.private = false
    return run(cmd, args, options)
  }
  assert.throws(() => perform({ run: changing }), /Private/)
  assert.equal(state.remote.draft, true)
})
test('API失敗を不存在として新規作成しない', t => {
  const { perform, state, run } = fixture(t)
  const failure = (cmd, args, options) => {
    if (cmd === 'gh' && args[3].endsWith('/releases')) throw Error('HTTP 403')
    return run(cmd, args, options)
  }
  assert.throws(() => perform({ run: failure }), /403/)
  assert.equal(state.writes, 0)
})
test('ローカルの検証記録なし・改変・別コミットを再利用しない', t => {
  const { perform, root, filename } = fixture(t)
  const dir = perform({ prepareOnly: true })
  assert.equal(dir, path.join(root, 'releases/1.3.1'))
  const record = fs.readFileSync(path.join(dir, 'VERIFIED.json'))
  fs.unlinkSync(path.join(dir, 'VERIFIED.json'))
  assert.throws(() => perform({ prepareOnly: true }))
  fs.writeFileSync(path.join(dir, 'VERIFIED.json'), record)
  fs.writeFileSync(path.join(dir, filename), '改変')
  assert.throws(() => perform({ prepareOnly: true }), /変わっています/)
  fs.writeFileSync(path.join(dir, filename), '固定tgz')
  const modified = JSON.parse(record); modified.commit = 'b'.repeat(40)
  fs.writeFileSync(path.join(dir, 'VERIFIED.json'), JSON.stringify(modified))
  assert.throws(() => perform({ prepareOnly: true }), /コミット/)
})
test('検査失敗は版ディレクトリも検証記録も残さない', t => {
  const { perform, root, state } = fixture(t)
  assert.throws(() => perform({ build: () => { throw Error('検査NG') } }), /検査NG/)
  assert.deepEqual(fs.readdirSync(path.join(root, 'releases')), [])
  assert.equal(state.writes, 0)
  perform()
})
test('同版ロックは削除・上書きせず停止', t => {
  const { perform, root, state } = fixture(t)
  const lock = path.join(root, 'releases/.1.3.1.lock')
  fs.mkdirSync(lock, { recursive: true })
  assert.throws(() => perform(), /EEXIST/)
  assert.ok(fs.existsSync(lock))
  assert.equal(state.builds, 0)
})
test('固定コピーではarchive→依存復元→必須検査→packの順を守る', () => {
  const calls = []
  buildPackage('/tmp', commit, '/tmp', (cmd, args) => { calls.push([cmd, args]); return Buffer.alloc(0) })
  assert.deepEqual(calls.map(c => c[0]), ['git', 'tar', 'npm', 'bash', 'npm'])
  assert.deepEqual(calls[0][1], ['archive', commit])
  assert.deepEqual(calls[3][1], ['scripts/test.sh'])
  assert.deepEqual(calls[4][1], ['pack', '--pack-destination', '/tmp'])
})
test('実コマンドの404とその他の失敗を区別する', () => {
  assert.throws(() => command(process.execPath, ['-e', 'process.stderr.write("Not Found (HTTP 404)");process.exit(1)']), error => error.notFound === true)
  assert.throws(() => command(process.execPath, ['-e', 'process.stderr.write("HTTP 403");process.exit(1)']), error => error.notFound === false)
})
