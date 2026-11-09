import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Crumbs } from '../src/ui/Layout'

const seps = (variant: 'plain' | 'boxed', current?: string) =>
  renderToStaticMarkup(<Crumbs items={['A', 'B']} label={(x) => x} onPick={() => undefined} variant={variant} current={current} />).split('›').length - 1

describe('Crumbs の区切り', () => {
  it('項目のあいだと、今いる場所の前に 1 つずつ', () => {
    expect(seps('plain')).toBe(1)
    expect(seps('plain', '現在地')).toBe(2)
  })
  it('枠付きは末尾にも 1 つ。今いる場所を添えても続けて 2 つは出さない', () => {
    expect(seps('boxed')).toBe(2)
    expect(seps('boxed', '現在地')).toBe(2)
  })
})
