// 共通hookは、完成済みの薄い入口だけを排他的に公開する。
import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const hook = `#!/bin/sh
# Ignite の管理する pre-commit（本体は実行元のworktree）。
set -eu
cd "$(git rev-parse --show-toplevel)"
index=$(git ls-files --stage -- scripts/pre-commit.mjs)
head_files=''
if head=$(git rev-parse --verify --quiet HEAD); then
  head_files=$(git ls-tree --name-only "$head" -- scripts/pre-commit.mjs)
else
  rc=$?
  [ "$rc" -eq 1 ] || exit "$rc"
fi
if [ -z "$index" ] && [ -z "$head_files" ]; then
  echo '[ignite-hook] 導入前の版なのでコミット検査を行いません' >&2
  exit 0
fi
if [ ! -f scripts/pre-commit.mjs ] || [ ! -f scripts/test.sh ]; then
  echo '[ignite-hook] コミット検査の本体がありません。作業ファイルを復元してください' >&2
  exit 1
fi
exec bash scripts/test.sh --commit
`

export async function installHook(root, { beforePublish = async () => {} } = {}) {
  const config = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' })
  if (config.error || ![0, 1].includes(config.status)) throw new Error('core.hooksPathを確認できません')
  if (config.status === 0) throw new Error('core.hooksPathが設定済みです。既存のhookを保護して導入を止めます')
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim()
  const directory = path.join(common, 'hooks')
  await fs.mkdir(directory, { recursive: true })
  const target = path.join(directory, 'pre-commit')
  const temporary = await fs.mkdtemp(path.join(directory, '.ignite-hook-'))
  try {
    const source = path.join(temporary, 'pre-commit')
    await fs.writeFile(source, hook, { mode: 0o755 })
    await fs.chmod(source, 0o755)
    await beforePublish(source, target)
    try { await fs.link(source, target) } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const stat = await fs.lstat(target)
      const executable = await fs.access(target, constants.X_OK).then(() => true, () => false)
      if (!stat.isFile() || !executable || await fs.readFile(target, 'utf8') !== hook) {
        throw new Error('既存のpre-commitを保護して導入を止めます（上書きしません）')
      }
    }
  } finally { await fs.rm(temporary, { recursive: true, force: true }) }
  console.log('[ignite-hook] 共通pre-commitを確認しました')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await installHook(process.cwd()) } catch (error) { console.error(error.message); process.exitCode = 1 }
}
