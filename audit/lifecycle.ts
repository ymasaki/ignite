/** 前処理の途中で失敗しても復元する。復元の失敗も呼出元へ伝える。 */
export async function withPreparation<T>(prepare: () => Promise<unknown>, restore: () => Promise<unknown>, run: () => Promise<T>): Promise<T> {
  try {
    await prepare()
    return await run()
  } finally {
    await restore()
  }
}
