import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withPreparation } from '../audit/lifecycle'
import { hasVerdict, markRunning, markVerdict, recordsDir, runningRecords, startRun, summarize, writeAtomic, writeRecord } from '../audit/records'

describe('axe の前処理と復元', () => {
  it.each(['success', 'prepare', 'measure', 'restore'] as const)('%s でも復元を待ち、失敗を隠さない', async (failure) => {
    const calls: string[] = []
    const action = async (name: string) => {
      calls.push(name)
      if (name === failure) throw new Error(name)
    }
    const result = withPreparation(() => action('prepare'), () => action('restore'), async () => { await action('measure'); return 42 })
    if (failure === 'success') await expect(result).resolves.toBe(42)
    else await expect(result).rejects.toThrow(failure)
    expect(calls).toEqual(failure === 'prepare' ? ['prepare', 'restore'] : ['prepare', 'measure', 'restore'])
  })
})

describe('監査の記録（worker をまたいだ集計）', () => {
  const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ignite-records-'))
  const finding = (where: string) => ({ rule: '文字の大きさ（3 章）', where, expected: '13px', actual: '15px' })

  it('同時に始めても前回の画像は一度だけ消し、片付けのあとに書いた画像と記録の置き場は残す', async () => {
    const outDir = temp()
    const dir = recordsDir(path.join(outDir, 'artifacts'))
    fs.writeFileSync(path.join(outDir, '01-old.png'), '')
    fs.writeFileSync(path.join(outDir, 'report.md'), 'old')
    // 同時に始まった worker のうち、記録の置き場を作れた 1 つだけが片付け、ほかは終わるまで待つ
    await Promise.all([startRun(outDir, dir), startRun(outDir, dir)])
    fs.writeFileSync(path.join(outDir, '02-new.png'), '')
    // 片付けのあとに始まった worker は消さない
    await startRun(outDir, dir)
    expect(fs.readdirSync(outDir).sort()).toEqual(['02-new.png', 'artifacts'])
  })

  it('片付けが終わらなければ待ち続けずに失敗する', async () => {
    const outDir = temp()
    const dir = recordsDir(outDir)
    fs.mkdirSync(dir, { recursive: true })
    await expect(startRun(outDir, dir, 200)).rejects.toThrow('片付け')
  })

  it('書いた順に関係なく、定義の順に集計する', () => {
    const dir = recordsDir(temp())
    writeRecord(dir, 10, { findings: [{ key: 'a', screen: '後', finding: finding('.a 後') }], shots: ['02.png'], hovered: [['button.x', '後'], ['a.y', '後']] })
    writeRecord(dir, 2, { findings: [{ key: 'a', screen: '先', finding: finding('.a 先') }, { key: 'b', screen: '先', finding: finding('.b') }], shots: ['01.png'], hovered: [['button.x', '先'], ['a.y', '']] })
    const summary = summarize(dir)
    expect(summary.findings.map((f) => [f.where, f.count, [...f.screens]])).toEqual([['.a 先', 2, ['先', '後']], ['.b', 1, ['先']]])
    expect(summary.shots).toEqual(['01.png', '02.png'])
    // 名前は先に見つけたものを使い、空のときだけ後の名前で補う
    expect([...summary.hovered]).toEqual([['button.x', '先'], ['a.y', '後']])
  })

  it('終わっていない測定を判定に知らせ、記録を書いたら外す', () => {
    const dir = recordsDir(temp())
    markRunning(dir, 3)
    markRunning(dir, 1)
    expect(runningRecords(dir)).toEqual([1, 3])
    writeRecord(dir, 3, { findings: [], shots: [], hovered: [] })
    expect(runningRecords(dir)).toEqual([1])
  })

  it('判定のあとは、遅れて終わった worker がレポートを書き直さないよう印を残す', () => {
    const outDir = temp()
    const dir = recordsDir(outDir)
    fs.mkdirSync(dir, { recursive: true })
    expect(hasVerdict(dir)).toBe(false)
    markVerdict(dir)
    expect(hasVerdict(dir)).toBe(true)
    writeAtomic(path.join(outDir, 'report.md'), '# 監査')
    expect(fs.readdirSync(outDir).sort()).toEqual(['.ignite-audit', 'report.md'])
  })
})
