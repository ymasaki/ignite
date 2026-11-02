# カタログ監査の実行

`npm run audit:design` を使う。Playwrightへの引数も渡せる（例: `npm run audit:design -- --grep DatePicker`）。直接 `playwright test -c catalog/playwright.audit.config.ts` は受け付けない。

監査用5198は `/tmp/ignite-catalog-audit-5198.lock` の共通ロックでworktree間を直列化する。先行監査を最大10分待ち、Viteの待受開始は最大60秒待つ。Vite自身の待受成功通知後に、そのworktreeのPlaywrightを実行する。成功・失敗・INT/TERM/HUPで、自分が起動したPlaywrightとViteのプロセス群を終了し、停止確認後にロックを解放する。停止できなければロックを残して失敗を返す。生存照会が権限エラーになった場合も終了とは見なさず、有限の停止待ちで消滅を確認できた場合だけ解放する。

既に5198が使われている場合は、既存サーバーを停止・流用せず失敗する。古い監査コマンドはこのロックを使わないため、所有元の監査を終了してから再実行する。

SIGKILL、OS停止など終了処理が走らない場合はサーバーやロックが残りうる。次回は所有PIDが終了した残骸を検出して失敗する。所有情報が欠けている場合やPIDが再利用された場合も10分で打ち切る。`owner.json` のPID・worktreeと5198の所有元を確認し、所有元でプロセスを終了してからロックを手動で除去する。他者のプロセスをkillしたり、所有確認なしでロックを消したりしない。

通常表示のDevBoardショートカットは従来の `http://localhost:5199` と `bash scripts/start-catalog.sh` を使う。監査ロックとは独立しており、この修正ではWebDockへ移行しない。
