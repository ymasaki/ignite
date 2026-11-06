import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Stepper } from '../src/ui/Month'

const render = (label: string, display?: React.ReactNode, value = 'a') => renderToStaticMarkup(
  <Stepper label="対象" prevLabel="前" nextLabel="次" value={value} options={[{ value: 'a', label }]} onChange={() => {}} display={display} />,
)

describe('Stepper の既定ラベル', () => {
  it('数字を回し、前後の文字と空白を保つ', () => {
    const html = render('第 12 週')
    expect(html).toContain('class="roll"')
    expect(html).toContain('class="roll-sr">12</span>')
    expect(html).toContain('第 ')
    expect(html).toContain(' 週')
  })
  it.each(['番号 001', '番号 9007199254740992', '番号 9007199254740993', '番号 1000000000000000000000', '今週'])('%s の原文を保つ', label => {
    const html = render(label)
    expect(html).toContain(`data-fit="main">${label}</span>`)
    expect(html).not.toContain('class="roll"')
  })
  it('安全な整数の上限は回せる', () => {
    expect(render('9007199254740991')).toContain('class="roll-sr">9007199254740991</span>')
  })
  it('値が見つからない場合も先頭の項目を表示する', () => {
    expect(render('第 1 週', undefined, 'missing')).toContain('class="roll-sr">1</span>')
  })
  it.each([false, '', 0, <strong key="custom">独自</strong>])('独自の表示を優先する（%s）', display => {
    expect(render('第 1 週', display)).not.toContain('class="roll"')
  })
})
