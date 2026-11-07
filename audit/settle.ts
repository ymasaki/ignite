import type { Page } from '@playwright/test'

/** フォントと現在の有限アニメーションを待つ。非同期データの準備は open / act 側で待つ。 */
export async function waitForVisualState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
      // SideStatusの更新通知（8秒）など、既存の有限アニメーションも最後まで測る。
      timer = setTimeout(() => reject(new Error('監査の描画待ちが10秒を超えました')), 10000)
    })
    const settle = async () => {
      let quietFrames = 0
      while (!cancelled) {
        await document.fonts.ready
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (cancelled) return
        const animations = document.getAnimations().filter((animation) =>
          (animation.pending || animation.playState === 'running') &&
          Number.isFinite(animation.effect?.getComputedTiming().endTime),
        )
        if (animations.length) {
          quietFrames = 0
          // 終了処理が次の動きを始める場合も、キャンセルされた場合も次のフレームで再走査する。
          await Promise.all(animations.map((animation) => animation.finished.catch(() => {})))
        } else if (++quietFrames >= 2) return
      }
    }
    try {
      await Promise.race([settle(), deadline])
    } finally {
      cancelled = true
      clearTimeout(timer)
    }
  })
}
