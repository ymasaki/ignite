// バージョン履歴の詳細パネル（設定の画面の「バージョン」から開く）。日付ごとのまとまりに、機能追加・改善・不具合修正の順で並べる

import { IconHistory } from '@tabler/icons-react'

import { fmtDate } from '../format/date'
import { RELEASE_CATEGORIES, releaseDays, type Release } from '../releases'
import { IconBox } from './Avatar'
import { Prose, Section, SubHeading } from './Layout'
import { PanelBody, PanelFrame, PanelHeader } from './Panel'

/** releases は新しい順。current はいまのバージョン、onClose は詳細を閉じる */
export function ReleasePanel({ releases, current, onClose }: { releases: Release[]; current: string; onClose?: () => void }) {
  return (
    <PanelFrame>
      <PanelHeader
        visual={<IconBox size="xl"><IconHistory size={28} stroke={1.5} /></IconBox>}
        smallVisual={<IconBox><IconHistory size={16} stroke={1.7} /></IconBox>}
        kicker="このアプリについて"
        title="バージョン履歴"
        lines={<div className="prof-r num">いまのバージョン {current}</div>}
        stickySub={current}
        onClose={onClose}
      />
      <PanelBody>
        {releaseDays(releases).map(([date, day]) => {
          const newest = day[0].version
          const oldest = day[day.length - 1].version
          return (
            <Section key={date} title={fmtDate(date)} count={oldest === newest ? newest : `${oldest}〜${newest}`}>
              {RELEASE_CATEGORIES.map(({ key, label }) => {
                const items = day.flatMap((r) => r.items).filter((item) => item.category === key)
                return items.length > 0 && (
                  <div key={key}>
                    <SubHeading>{label}</SubHeading>
                    <Prose>{items.map((item) => `・${item.text}`).join('\n')}</Prose>
                  </div>
                )
              })}
            </Section>
          )
        })}
      </PanelBody>
    </PanelFrame>
  )
}
