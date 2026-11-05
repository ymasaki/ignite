// GitHubにも配布用検査にも接続しない。失敗した段階からの再実行を確認する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { release, buildPackage, command, accountToken, outsidePackage } from './release.mjs'

const commit = 'a'.repeat(40)
const older = 'c'.repeat(40) // 手元で対象コミットの祖先
const newer = 'd'.repeat(40) // 手元で対象コミットの子孫
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-release-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@ymasaki/ignite', version: '1.3.1' }))
  const state = { synced: true, dirty: false, tag: null, remote: null, assets: [], builds: 0, writes: 0, calls: [], failUpload: false, losePublish: false, main: commit, pushes: [], failPush: false, head: commit, changed: [] }
  const filename = 'ymasaki-ignite-1.3.1.tgz'
  const json = value => Buffer.from(JSON.stringify(value))
  const run = (cmd, args, options = {}) => {
    state.calls.push([cmd, args, options])
    if (cmd === 'git' && args[0] === 'merge-base') {
      const [, , a, b] = args
      const line = [older, commit, newer]
      if (!line.includes(a) || !line.includes(b) || line.indexOf(a) > line.indexOf(b)) throw Error('祖先ではない')
      return Buffer.alloc(0)
    }
    if (cmd === 'git' && args.includes('push')) {
      assert.equal(options.env?.GH_TOKEN, 'ymasaki-token')
      args = args.slice(args.indexOf('push'))
      state.pushes.push(args)
      if (state.failPush) throw Error('push失敗')
      state.main = args.at(-1).split(':')[0]
      return Buffer.alloc(0)
    }
    if (cmd === 'git' && args[0] === 'diff') return Buffer.from(state.changed.join('\n'))
    if (cmd === 'git') return Buffer.from(args[0] === 'rev-parse' ? state.head : state.dirty ? ' M package.json' : '')
    if (cmd === 'tar') return json({ name: '@ymasaki/ignite', version: '1.3.1' })
    assert.equal(cmd, 'gh')
    assert.equal(options.env?.GH_TOKEN, 'ymasaki-token')
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
    if (endpoint.endsWith('/git/ref/heads/main')) return json({ object: { sha: state.main } })
    const sha = endpoint.match(/\/commits\/([0-9a-f]{40})$/)?.[1]
    if (sha) {
      const line = [older, commit, newer]
      if (!state.synced || line.indexOf(sha) < 0 || line.indexOf(sha) > line.indexOf(state.main)) throw Error('No commit found (HTTP 422)')
      return json({ sha })
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
        state.tag = state.remote.target_commitish
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
  const token = () => { state.tokens = (state.tokens || 0) + 1; return 'ymasaki-token' }
  const perform = options => release({ root, commit, run, build, token, wait: () => { state.waits = (state.waits || 0) + 1 }, ...options })
  return { root, state, filename, perform, run }
}

test('固定物を公開し、再実行は読み取りだけで成功する', t => {
  const { perform, state } = fixture(t)
  assert.match(perform(), /v1.3.1$/)
  assert.equal(state.builds, 1)
  assert.equal(state.writes, 5) // draft・添付3つ・公開
  perform()
  assert.equal(state.builds, 1)
  assert.equal(state.writes, 5)
})
for (const [label, change] of [
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
test('GitHubのmainが遅れていれば早送りだけで送ってから公開する', t => {
  const { perform, state } = fixture(t)
  state.main = older
  assert.match(perform(), /v1.3.1$/)
  assert.deepEqual(state.pushes, [['push', 'https://github.com/ymasaki/ignite.git', `${commit}:refs/heads/main`]])
  perform()
  assert.equal(state.pushes.length, 1)
})
test('GitHubのmainが同じか先にあれば送らない', t => {
  for (const main of [commit, newer]) {
    const { perform, state } = fixture(t)
    state.main = main
    perform()
    assert.deepEqual(state.pushes, [])
    assert.equal(state.main, main)
  }
})
for (const [label, change, pattern] of [
  ['GitHubのmainが分岐', s => { s.main = 'e'.repeat(40) }, /祖先ではありません/],
  ['push失敗', s => { s.main = older; s.failPush = true }, /push失敗/],
]) test(`${label}なら強制せず配布を始めない`, t => {
  const { perform, state } = fixture(t)
  change(state)
  assert.throws(() => perform(), pattern)
  assert.ok(state.pushes.every(args => !args.some(a => a.startsWith('-'))))
  assert.equal(state.builds, 0)
  assert.equal(state.writes, 0)
})
test('ghの有効アカウントによらず、送信の認証にymasakiのトークンだけを使う', t => {
  const { perform, state } = fixture(t)
  state.main = older
  perform()
  assert.equal(state.tokens, 1)
  const push = state.calls.find(([cmd, args]) => cmd === 'git' && args.includes('push'))
  assert.deepEqual(push[1].slice(0, 4), ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'])
})
test('ymasakiの認証がなければGitHubへ触らず停止する', t => {
  const { perform, state } = fixture(t)
  assert.throws(() => perform({ token: () => accountToken(() => { throw Error('no account') }) }), /ymasaki.*ログイン/)
  assert.ok(!state.calls.some(([cmd]) => cmd === 'gh'))
  assert.equal(state.builds, 0)
})
test('トークンは環境変数を外してymasaki指定で取り出す', () => {
  const calls = []
  process.env.GH_TOKEN = 'other'
  try {
    assert.equal(accountToken((cmd, args, options) => { calls.push([cmd, args, options]); return Buffer.from('tok\n') }), 'tok')
  } finally { delete process.env.GH_TOKEN }
  assert.deepEqual(calls[0][1], ['auth', 'token', '--hostname', 'github.com', '--user', 'ymasaki'])
  assert.equal(calls[0][2].env.GH_TOKEN, undefined)
})
test('準備だけならGitHubへ送らない', t => {
  const { perform, state } = fixture(t)
  state.main = older
  perform({ prepareOnly: true })
  assert.deepEqual(state.pushes, [])
  assert.ok(!state.calls.some(([cmd]) => cmd === 'gh'))
  assert.equal(state.tokens, undefined)
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
test('公開済みの版のあとが配布物外の変更だけなら、版を据え置いて既存のReleaseを照合して成功する', t => {
  const { perform, state } = fixture(t)
  perform()
  const { builds, writes } = state
  state.head = newer
  state.changed = ['devboard.json', '.github/workflows/pages.yml']
  assert.match(perform({ commit: newer }), /v1.3.1$/)
  assert.deepEqual(state.pushes.at(-1), ['push', 'https://github.com/ymasaki/ignite.git', `${newer}:refs/heads/main`])
  assert.equal(state.builds, builds)
  assert.equal(state.writes, writes)
  assert.equal(state.tag, commit)
})
test('公開済みの版のあとに配布物に関わる変更があれば、版を上げるよう求めて書き込まない', t => {
  const { perform, state } = fixture(t)
  perform()
  const { builds, writes } = state
  state.head = newer
  state.changed = ['devboard.json', 'src/index.ts']
  assert.throws(() => perform({ commit: newer }), /版を上げてください: src\/index.ts/)
  assert.equal(state.builds, builds)
  assert.equal(state.writes, writes)
})
test('公開済みタグが対象コミットの祖先でなければ据え置かない', t => {
  const { perform, state } = fixture(t)
  state.tag = 'b'.repeat(40)
  assert.throws(() => perform(), /祖先ではありません。版を上げてください/)
  assert.equal(state.writes, 0)
})
test('配布物外とみなすのは配布にもビルドにも入らないパスだけ', () => {
  for (const file of ['devboard.json', 'AGENTS.md', 'CLAUDE.md', '.github/workflows/pages.yml', 'scripts/release.mjs']) assert.ok(outsidePackage(file), file)
  for (const file of ['package.json', 'package-lock.json', 'docs/releasing.md', 'DESIGN.md', 'CHANGELOG.md', 'src/index.ts', 'scripts/build.mjs', 'templates/AGENTS.md', 'catalog/main.tsx']) assert.ok(!outsidePackage(file), file)
})
const timeout = () => Object.assign(Error('dial tcp: i/o timeout'), { network: true })
test('読み取りの通信が途切れても再試行して公開まで進む', t => {
  const { perform, state, run } = fixture(t)
  let failures = 2
  const flaky = (cmd, args, options) => {
    if (cmd === 'gh' && args[3]?.endsWith('/git/ref/tags/v1.3.1') && failures-- > 0) throw timeout()
    return run(cmd, args, options)
  }
  assert.match(perform({ run: flaky }), /v1.3.1$/)
  assert.equal(state.waits, 2)
})
test('読み取りの通信が途切れ続けたら書き込まずに停止する', t => {
  const { perform, state, run } = fixture(t)
  let tries = 0
  const down = (cmd, args, options) => {
    if (cmd === 'gh' && args[3]?.endsWith('/git/ref/tags/v1.3.1')) { tries++; throw timeout() }
    return run(cmd, args, options)
  }
  assert.throws(() => perform({ run: down }), /i\/o timeout/)
  assert.equal(tries, 3)
  assert.equal(state.writes, 0)
  assert.equal(state.builds, 0)
})
test('書き込みの通信失敗は再試行しない', t => {
  const { perform, state, run } = fixture(t)
  let posts = 0
  const lost = (cmd, args, options) => {
    if (cmd === 'gh' && args.includes('POST')) { posts++; throw timeout() }
    return run(cmd, args, options)
  }
  assert.throws(() => perform({ run: lost }), /i\/o timeout/)
  assert.equal(posts, 1)
  assert.equal(state.waits, undefined)
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
  assert.throws(() => command(process.execPath, ['-e', 'process.stderr.write("Get \\"https://api.github.com/x\\": dial tcp 1.2.3.4:443: i/o timeout");process.exit(1)']), error => error.network === true)
  assert.throws(() => command(process.execPath, ['-e', 'process.stderr.write("gh: Server Error (HTTP 502)");process.exit(1)']), error => error.network === false)
})
