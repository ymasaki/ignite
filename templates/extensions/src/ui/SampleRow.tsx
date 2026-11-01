import { Avatar, EntityRow } from '@ymasaki/ignite'

/** 中立なサンプル。実アプリではアプリ所有のデータ型から値を渡す */
export interface SampleItem { name: string; initial: string; ready: boolean }

export function SampleRow({ item }: { item: SampleItem }) {
  return <EntityRow lead={<Avatar initial={item.initial} />} title={item.name} trailing={
    <span className="appx-state" data-appx-ready={item.ready}>{item.ready ? '準備済み' : '下書き'}</span>
  } />
}
