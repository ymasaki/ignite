// バージョン履歴の形と読むときのまとめ方（アプリごとの履歴の中身はアプリが持つ。表示は ui/Releases.tsx）。

export type ReleaseCategory = 'added' | 'improved' | 'fixed'

export const RELEASE_CATEGORIES: { key: ReleaseCategory; label: string }[] = [
  { key: 'added', label: '機能追加' },
  { key: 'improved', label: '改善' },
  { key: 'fixed', label: '不具合修正' },
]

export interface ReleaseItem {
  category: ReleaseCategory
  text: string
}

export interface Release {
  version: string
  /** 初回公開日（YYYY-MM-DD） */
  date: string
  items: ReleaseItem[]
}

/** 採番の粒度は保ち、読むときは同じ日の変更をまとめる（新しい順の履歴を受け取り、日付ごとに分ける） */
export function releaseDays(releases: Release[]): [string, Release[]][] {
  const days = new Map<string, Release[]>()
  for (const release of releases) {
    const day = days.get(release.date)
    if (day) day.push(release)
    else days.set(release.date, [release])
  }
  return [...days]
}
