import { IconFolder, IconLayoutGrid, IconListDetails } from '@tabler/icons-react'
import { Avatar, Button, Canvas, IconBox, TreeCard, TreeChart, TreePill, type CanvasApi, type TreeItem } from '@ymasaki/ignite'
import { useRef, useState } from 'react'
import { Case, Cases, Spec } from './kit'
import { PAGES } from './nav'

// 見本のツリー: このカタログの目録（区分 → ページ → 標本）。区分は丸い節で、その下にページを列に並べ、標本は縦に積む
type Node = TreeItem & { kind: 'root' | 'group' | 'page' | 'spec'; title: string; count: number; children?: Node[] }
const GROUPS = ['基礎', '部品', '画面の型']
const ROOT: Node = {
  id: 'root',
  kind: 'root',
  title: 'Ignite カタログ',
  count: PAGES.reduce((n, p) => n + p.specs.length, 0),
  children: GROUPS.map((g) => {
    const pages = PAGES.filter((p) => p.group === g)
    return {
      id: `g-${g}`,
      kind: 'group',
      title: g,
      count: pages.length,
      columns: true,
      children: pages.map((p) => ({
        id: `p-${p.key}`,
        kind: 'page',
        title: p.label,
        count: p.specs.length,
        children: p.specs.map((s) => ({ id: `s-${p.key}-${s.id}`, kind: 'spec', title: s.title, count: s.parts?.length ?? 0 })),
      })),
    }
  }),
}

function CatalogTree() {
  const api = useRef<CanvasApi>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(['p-motion', 'p-charts']))
  const pick = (id: string) => setSel(sel === id ? null : id)
  return (
    <div className="cat-stack">
      <div className="cat-row">
        <Button onClick={() => { setSel('p-charts'); api.current?.centerOn('p-charts') }}>グラフと数字へ移動</Button>
        <Button onClick={() => setOpen(new Set(PAGES.map((p) => `p-${p.key}`)))}>すべて開く</Button>
        <Button onClick={() => setOpen(new Set())}>すべて閉じる</Button>
      </div>
      <div className="cat-canvas">
        <Canvas label="カタログの目録" apiRef={api} height={520}>
          <TreeChart<Node>
            root={ROOT}
            open={open}
            onToggle={(id, o) => setOpen((s) => { const n = new Set(s); if (o) n.add(id); else n.delete(id); return n })}
            selected={sel}
            render={(n, state) => {
              if (n.kind === 'group') return <TreePill label="区分" title={n.title} name={`区分 ${n.title}`} lead={<Avatar initial={n.title[0]} tone="c1" size="sm" />} selected={sel === n.id} onClick={() => pick(n.id)} />
              const name = `${n.title}${n.kind === 'page' ? `、標本 ${n.count} 件` : ''}`
              return (
                <TreeCard
                  size={n.kind === 'root' ? 'lg' : n.kind === 'page' ? 'md' : 'sm'}
                  level={n.kind === 'root' ? 1 : n.kind === 'page' ? 2 : 4}
                  label={n.kind === 'root' ? 'デザインシステム' : undefined}
                  lead={n.kind === 'page' ? <IconFolder size={16} stroke={1.8} /> : undefined}
                  title={n.title}
                  name={name}
                  sub={n.kind === 'root' ? `${PAGES.length} ページ` : n.kind === 'spec' && n.count ? `部品 ${n.count}` : undefined}
                  meta={n.kind !== 'spec' ? <><IconListDetails size={12} stroke={1.8} />{n.count}</> : undefined}
                  more={`標本 ${n.count} 件`}
                  selected={sel === n.id}
                  onClick={() => pick(n.id)}
                  state={state}
                />
              )
            }}
          />
        </Canvas>
      </div>
    </div>
  )
}

// 自由な配置の見本: ツリーでない中身でも、data-node を付けた要素はミニマップに出る
const BOARD = Array.from({ length: 24 }, (_, i) => ({ id: `b${i + 1}`, title: `ボード ${i + 1}`, count: (i * 7) % 12 }))

/** 「グラフと数字」のページの末尾に置くキャンバスとツリーの見本（左メニューを伸ばさないよう、図の部品の仲間として同じページに置く） */
export function DiagramSpecs({ page: p }: { page: string }) {
  const [sel, setSel] = useState<string | null>(null)
  return (
    <>
      <Spec page={p} id="tree"><CatalogTree /></Spec>
      <Spec page={p} id="free">
        <div className="cat-canvas">
          <Canvas label="ボードの並び" start="fit" height={360}>
            <div className="cat-board">
              {BOARD.map((b) => (
                <div key={b.id} data-node={b.id} data-on={sel === b.id || undefined}>
                  <TreeCard title={b.title} name={b.title} lead={<IconLayoutGrid size={16} stroke={1.8} />} meta={b.count} sub="カード" selected={sel === b.id} onClick={() => setSel(sel === b.id ? null : b.id)} />
                </div>
              ))}
            </div>
          </Canvas>
        </div>
      </Spec>
      <Spec page={p} id="nodes">
        <Cases cols={3}>
          <Case label="大"><TreeCard size="lg" level={1} label="種別" title="いちばん上の節" name="いちばん上の節" sub="担当 佐藤 葵" meta="128" /></Case>
          <Case label="中"><TreeCard size="md" level={2} lead={<IconFolder size={16} stroke={1.8} />} title="列の先頭" name="列の先頭" meta="12" /></Case>
          <Case label="小"><TreeCard title="積んだ節" name="積んだ節" sub="担当なし" meta="3" /></Case>
          <Case label="選んでいる"><TreeCard title="選んでいる節" name="選んでいる節" selected meta="5" /></Case>
          <Case label="点線"><TreeCard dashed title="補助の節" name="補助の節" meta="6" /></Case>
          <Case label="薄い"><TreeCard dim title="強調の外" name="強調の外" meta="2" /></Case>
          <Case label="丸い節"><TreePill label="まとめ役" title="佐藤 葵" name="まとめ役 佐藤 葵" lead={<Avatar initial="佐" tone="c2" size="sm" />} onClick={() => {}} /></Case>
          <Case label="丸い節・選んでいる"><TreePill label="まとめ役" title="田中 蓮" name="まとめ役 田中 蓮" lead={<Avatar initial="田" tone="c3" size="sm" />} selected onClick={() => {}} /></Case>
          <Case label="丸い節・アイコン"><TreePill label="区分" title="共通" lead={<IconBox><IconFolder size={14} stroke={1.8} /></IconBox>} /></Case>
        </Cases>
      </Spec>
    </>
  )
}
