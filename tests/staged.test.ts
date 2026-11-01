import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { main } from '../cli/check'

it.each(['.', 'app'])('--staged は %s から index を読み、未stageの内容を読まない', (subdir) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-staged-'))
  const root = path.join(repo, subdir)
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    fs.mkdirSync(path.join(root, 'web/styles'), { recursive: true })
    fs.writeFileSync(path.join(root, 'ignite.config.json'), JSON.stringify({ source: ['web'], styles: ['web/styles'] }))
    const css = path.join(root, 'web/styles/a.css')
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' })
    git('init', '--quiet')
    const bad = '.a{color:#123456}\n'
    const good = '.a{color:var(--ink)}\n'
    fs.writeFileSync(css, bad)
    git('add', '.')
    fs.writeFileSync(css, good)
    expect(main(root, ['--staged'])).toBe(1)
    expect(main(root, [])).toBe(0)
    git('add', '.')
    fs.writeFileSync(css, bad)
    expect(main(root, ['--staged'])).toBe(0)
    expect(main(root, [])).toBe(1)
  } finally {
    log.mockRestore()
    fs.rmSync(repo, { recursive: true, force: true })
  }
})
