import { describe, expect, it } from 'vitest'
import { withPreparation } from '../audit/lifecycle'

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
