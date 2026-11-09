import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compare, entriesBetween } from '../cli/changelog'
import { sync, withBlock } from '../cli/sync'

const repo = path.resolve(import.meta.dirname, '..')

describe('変更履歴の取り出し', () => {
  const log = '# 変更履歴\n\n## 2.0.0（2026-12-01）\n\n### 破壊的変更\n\n- a\n\n## 1.2.0（2026-11-01）\n\n### 追加\n\n- b\n\n## 1.0.0\n\n- c\n'
  it('入った版だけを新しい順に返し、破壊的変更に印を付ける', () => {
    expect(entriesBetween(log, '1.0.0', '2.0.0').map((e) => [e.version, e.breaking])).toEqual([['2.0.0', true], ['1.2.0', false]])
    expect(entriesBetween(log, '2.0.0', '2.0.0')).toEqual([])
  })
  it('版は数で比べる', () => {
    expect(compare('1.10.0', '1.9.0')).toBeGreaterThan(0)
  })
})

describe('AI エージェント向けの決まりの同期', () => {
  const pkg = { dir: repo, version: '9.9.9' }
  it('節を足す・置き換える。節の外は変えない', () => {
    const one = withBlock('# app\n', '<!-- ignite:begin 1 -->\nA\n<!-- ignite:end -->\n')
    expect(one).toContain('# app')
    const two = withBlock(`${one}\n後ろの文\n`, '<!-- ignite:begin 2 -->\nB\n<!-- ignite:end -->\n')
    expect(two).toContain('B')
    expect(two).not.toContain('A\n')
    expect(two).toContain('後ろの文')
  })
  it('節の文に $& などがあっても、そのまま書く', () => {
    const one = withBlock('# app\n', '<!-- ignite:begin 1 -->\nA\n<!-- ignite:end -->\n')
    const section = "<!-- ignite:begin 2 -->\n$& と $' と $1\n<!-- ignite:end -->\n"
    expect(withBlock(one, section)).toBe(`# app\n\n${section}`)
  })
  it('sync のあとは --check が空で、手で崩すと古いと返す', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-sync-'))
    try {
      expect(sync(dir, pkg)).toEqual(['AGENTS.md', '.claude/skills/ignite-audit/SKILL.md', '.agents/skills/ignite-audit/SKILL.md'])
      expect(sync(dir, pkg, true)).toEqual([])
      fs.appendFileSync(path.join(dir, '.claude/skills/ignite-audit/SKILL.md'), 'x')
      expect(sync(dir, pkg, true)).toEqual(['.claude/skills/ignite-audit/SKILL.md'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
  it('CLAUDE.md があれば同じ節を入れる', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-sync-'))
    try {
      fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# c\n')
      sync(dir, pkg)
      expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')).toContain('ignite:begin 9.9.9')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
