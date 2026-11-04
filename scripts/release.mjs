// 本番操作専用。固定コミットを検査し、Private GitHub Releaseへ同じ配布物を渡す。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = 'ymasaki/ignite'
// ghの有効アカウントは他の作業で切り替わる。Privateの公開先は常にこのアカウントで操作する。
const ACCOUNT = 'ymasaki'
const base = `repos/${REPO}`
const hash = data => createHash('sha256').update(data).digest('hex')
function assert(ok, message) { if (!ok) throw new Error(message) }
export function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { maxBuffer: 32 * 1024 * 1024, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const error = new Error(`${cmd} ${args.join(' ')} が失敗しました\n${result.stderr?.toString() || ''}`)
    error.notFound = /\(HTTP 404\)/.test(result.stderr?.toString() || '')
    throw error
  }
  return result.stdout || Buffer.alloc(0)
}

// 環境変数のトークンではなく、ghに保存した公開用アカウントのトークンを取り出す。
export function accountToken(run = command) {
  const env = { ...process.env }
  delete env.GH_TOKEN
  delete env.GITHUB_TOKEN
  let token = ''
  try { token = run('gh', ['auth', 'token', '--hostname', 'github.com', '--user', ACCOUNT], { env }).toString().trim() } catch {}
  assert(token, `ghに${ACCOUNT}アカウントの認証がありません。gh auth login --hostname github.com で${ACCOUNT}としてログインしてください`)
  return token
}

export function buildPackage(root, commit, destination, run) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-release-'))
  try {
    const archive = run('git', ['archive', commit], { cwd: root })
    run('tar', ['-x', '-C', work], { input: archive })
    run('npm', ['ci', '--include=dev'], { cwd: work, stdio: 'inherit' })
    run('bash', ['scripts/test.sh'], { cwd: work, stdio: 'inherit' })
    run('npm', ['pack', '--pack-destination', destination], { cwd: work, stdio: 'inherit' })
  } finally { fs.rmSync(work, { recursive: true, force: true }) }
}

export function release({ root, commit: requested = process.env.DEVBOARD_COMMIT, prepareOnly = false, run = command, build = buildPackage, token = accountToken }) {
  const git = (...args) => run('git', args, { cwd: root }).toString().trim()
  const commit = git('rev-parse', 'HEAD')
  assert(!requested || requested === commit, '対象コミットとHEADが一致しません')
  assert(!git('status', '--porcelain', '--untracked-files=all'), '未コミットの変更があります')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json')))
  const version = manifest.version
  assert(/^\d+\.\d+\.\d+$/.test(version), '配布版は安定版の数値3項目で指定してください')
  assert(manifest.name === '@ymasaki/ignite', 'パッケージ名が一致しません')
  const tag = `v${version}`
  const filename = `ymasaki-ignite-${version}.tgz`
  const names = [filename, 'SHA256SUMS', 'COMMIT']
  const output = path.join(root, 'releases')
  fs.mkdirSync(output, { recursive: true })
  const lock = path.join(output, `.${version}.lock`)
  // 残骸は勝手に削除しない。公開の途中停止も再照合してから再開する。
  fs.mkdirSync(lock)
  let stage
  let env
  // GitHubへ触る呼び出しはすべて公開用アカウントのトークンで行う。
  const gh = args => run('gh', args, { env: (env ??= { ...process.env, GH_TOKEN: token() }) })
  const api = (endpoint, args = []) => JSON.parse(gh(['api', '--hostname', 'github.com', endpoint, ...args]).toString())
  const privateRepo = () => assert(api(base).private === true, 'GitHubリポジトリがPrivateではありません')
  const tagCommit = () => {
    try { api(`${base}/git/ref/tags/${tag}`) } catch (error) {
      if (error.notFound) return null
      throw error
    }
    // commits APIで注釈付きタグも元コミットまで解決する。
    return api(`${base}/commits/${tag}`).sha
  }
  const isAncestor = (older, newer) => {
    try { git('merge-base', '--is-ancestor', older, newer); return true } catch { return false }
  }
  // GitHubのmainを対象コミットまで早送りする。強制上書き・main以外の参照の送信はしない。
  const syncMain = () => {
    const remoteMain = api(`${base}/git/ref/heads/main`).object.sha
    if (remoteMain === commit || isAncestor(commit, remoteMain)) return
    assert(isAncestor(remoteMain, commit), 'GitHubのmainが対象コミットの祖先ではありません。分岐を確認してください')
    // 保存済みの別認証（キーチェーン等）を使わず、gh経由で同じトークンを渡す。
    run('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', `https://github.com/${REPO}.git`, `${commit}:refs/heads/main`], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env })
  }
  const checkTag = (required = false) => {
    const found = tagCommit()
    assert(found ? found === commit : !required, '同版のタグが別コミットを指すか、公開済みタグがありません')
    return found
  }
  const getRelease = () => {
    const matches = api(`${base}/releases`, ['--paginate', '--slurp']).flat().filter(item => item.tag_name === tag)
    assert(matches.length <= 1, '同版のReleaseが複数あります')
    return matches[0]
  }
  try {
    if (!prepareOnly) {
      privateRepo()
      syncMain()
      assert(api(`${base}/commits/${commit}`).sha === commit, '元コミットがGitHubに同期されていません')
      checkTag()
    }
    const directory = path.join(output, version)
    const read = name => fs.readFileSync(path.join(directory, name))
    if (!fs.existsSync(directory)) {
      stage = fs.mkdtempSync(path.join(output, `.${version}-`))
      build(root, commit, stage, run)
      assert(fs.readdirSync(stage).join() === filename, '配布物の名前か数が一致しません')
      const packed = JSON.parse(run('tar', ['-xOf', path.join(stage, filename), 'package/package.json']).toString())
      assert(packed.version === version && packed.name === manifest.name, 'tgz内の版か名前が一致しません')
      const digest = hash(fs.readFileSync(path.join(stage, filename)))
      fs.writeFileSync(path.join(stage, 'SHA256SUMS'), `${digest}  ${filename}\n`)
      fs.writeFileSync(path.join(stage, 'COMMIT'), `${commit}\n`)
      const hashes = Object.fromEntries(names.map(name => [name, hash(fs.readFileSync(path.join(stage, name)))]))
      fs.writeFileSync(path.join(stage, 'VERIFIED.json'), JSON.stringify({ version, commit, hashes }, null, 2) + '\n')
      fs.renameSync(stage, directory)
      stage = undefined
    }
    const verified = JSON.parse(read('VERIFIED.json'))
    assert(verified.version === version && verified.commit === commit, '既存配布物の検証コミット・版が一致しません。版を上げてください')
    for (const name of names) assert(verified.hashes[name] === hash(read(name)), `保存済み配布物が変わっています: ${name}`)
    assert(read('COMMIT').toString() === `${commit}\n`, 'COMMITが一致しません')
    assert(read('SHA256SUMS').toString() === `${hash(read(filename))}  ${filename}\n`, 'SHA256SUMSが一致しません')
    if (prepareOnly) return directory
    privateRepo()
    let remote = getRelease()
    if (!remote) {
      const notes = `元コミット: ${commit}\nSHA256: ${hash(read(filename))}\n\n互換性の注意は同梱CHANGELOG.mdを確認してください。`
      remote = api(`${base}/releases`, ['--method', 'POST', '-f', `tag_name=${tag}`, '-f', `target_commitish=${commit}`, '-f', `name=Ignite ${version}`, '-f', `body=${notes}`, '-F', 'draft=true'])
    }
    const checkRemote = item => {
      assert(item.tag_name === tag, 'Releaseのタグが一致しません')
      const found = checkTag(!item.draft)
      if (item.draft && !found) assert(item.target_commitish === commit, 'draftの元コミットが一致しません')
    }
    checkRemote(remote)
    const assets = () => api(`${base}/releases/${remote.id}/assets`, ['--paginate', '--slurp']).flat()
    const verifyAssets = (items, complete) => {
      assert(new Set(items.map(a => a.name)).size === items.length, '添付名が重複しています')
      for (const asset of items) {
        assert(names.includes(asset.name), `想定外の添付があります: ${asset.name}`)
        const data = gh(['api', '--hostname', 'github.com', `${base}/releases/assets/${asset.id}`, '-H', 'Accept: application/octet-stream'])
        assert(hash(data) === verified.hashes[asset.name], `GitHubの添付が一致しません: ${asset.name}`)
      }
      if (complete) assert(items.length === names.length, 'GitHubの添付が不足しています')
    }
    const present = assets()
    verifyAssets(present, !remote.draft)
    if (remote.draft) {
      for (const name of names) if (!present.some(a => a.name === name)) {
        // --clobberを使わない。競合や応答喪失は次回に読み直す。
        privateRepo()
        gh(['release', 'upload', tag, path.join(directory, name), '--repo', `github.com/${REPO}`])
      }
      verifyAssets(assets(), true)
      privateRepo()
      remote = api(`${base}/releases/${remote.id}`)
      checkRemote(remote)
      if (remote.draft) remote = api(`${base}/releases/${remote.id}`, ['--method', 'PATCH', '-F', 'draft=false'])
    }
    assert(!remote.draft, 'Releaseが公開されていません')
    checkRemote(remote)
    verifyAssets(assets(), true)
    console.log(`GitHub Release: ${remote.html_url}`)
    return remote.html_url
  } finally {
    if (stage) fs.rmSync(stage, { recursive: true, force: true })
    fs.rmdirSync(lock)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  try { console.log(release({ root, prepareOnly: process.argv.includes('--prepare-only') })) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
