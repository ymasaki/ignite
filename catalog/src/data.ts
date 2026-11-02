// カタログのダミーデータ（架空の案件管理）
export interface Project {
  id: string
  name: string
  owner: string
  ownerReading: string
  reading: string
  initial: string
  tone: string
  status: '進行中' | '完了' | '保留'
  tasks: number
  note: string
}

export const PROJECTS: Project[] = [
  { id: 'p1', name: 'ウェブサイト刷新', owner: '佐藤 葵', ownerReading: 'さとう あおい', reading: 'うぇぶさいとさっしん', initial: '佐', tone: 'c1', status: '進行中', tasks: 42, note: 'デザインを更新し、表示速度を改善する' },
  { id: 'p2', name: '請求の自動化', owner: '鈴木 陸', ownerReading: 'すずき りく', reading: 'せいきゅうのじどうか', initial: '鈴', tone: 'c2', status: '進行中', tasks: 18, note: '月末の手作業を減らす' },
  { id: 'p3', name: 'モバイルアプリ', owner: '高橋 結', ownerReading: 'たかはし ゆい', reading: 'もばいるあぷり', initial: '高', tone: 'c3', status: '保留', tasks: 7, note: '次の四半期に再開する' },
  { id: 'p4', name: '問い合わせ窓口', owner: '田中 蓮', ownerReading: 'たなか れん', reading: 'といあわせまどぐち', initial: '田', tone: 'c4', status: '完了', tasks: 25, note: '受付から回答までを一本化した' },
  { id: 'p5', name: 'データ基盤の移行', owner: '伊藤 楓', ownerReading: 'いとう かえで', reading: 'でーたきばんのいこう', initial: '伊', tone: 'c5', status: '進行中', tasks: 31, note: '段階的に切り替える' },
  { id: 'p6', name: '社内勉強会', owner: '渡辺 湊', ownerReading: 'わたなべ みなと', reading: 'しゃないべんきょうかい', initial: '渡', tone: 'c6', status: '完了', tasks: 4, note: '月に 1 回開く' },
]

export const MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
