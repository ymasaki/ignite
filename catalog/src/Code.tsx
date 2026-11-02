import { CodeBlock } from '@ymasaki/ignite'
import { Page, Spec } from './kit'

const CODE_TS = `// 失敗したら間隔をのばして再試行する
export async function retry<T>(run: () => Promise<T>, times = 3): Promise<T> {
  for (let i = 0; i < times; i++) {
    try {
      return await run() // 成功したら返す
    } catch (e) {
      if (i === times - 1) throw e
      await sleep(200 * 2 ** i)
    }
  }
  throw new Error("再試行の回数を超えました")
}`
const CODE_JSON = `{
  "name": "売上レポート",
  "retry": 3,
  "enabled": true,
  "owner": null
}`
const CODE_SQL = `-- 月ごとの売上（10 万円以上）
SELECT month, SUM(amount) AS total
FROM sales
WHERE status = '確定' AND amount >= 100000
GROUP BY month
ORDER BY month DESC;`
const CODE_SHELL = `# 検査してから更新する
$ npx ignite check --staged
$ npm run ignite:upgrade -- --yes`
const CODE_LOG = `2026-11-02 09:14:03 INFO  同期を始めました
2026-11-02 09:14:05 WARN  応答が遅れています（2,140ms）
2026-11-02 09:14:09 ERROR 接続できませんでした code=ETIMEDOUT
2026-11-02 09:14:12 INFO  再試行します
2026-11-02 09:14:14 INFO  同期が終わりました`
const CODE_LONG = 'これは折り返しの見本です。一行が長いログや説明文を、横にスクロールせずに読めるようにします。The quick brown fox jumps over the lazy dog, and keeps on running to the end of the line.' // design-ok: 折り返しを見せる長い行
const CODE_GRID = `| 項目 | code | 状態       |
|------|------|------------|
| 売上 | A-01 | 確定       |
| 原価 | B-22 | 仮         |
| abcd | C-03 | ok         |`

export function CodePage({ target }: { target?: string | null }) {
  const p = 'code'
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="lines"><CodeBlock title="retry.ts" language="ts" lineNumbers code={CODE_TS} /></Spec>
      <Spec page={p} id="json"><CodeBlock title="settings.json" language="json" code={CODE_JSON} /></Spec>
      <Spec page={p} id="sql"><CodeBlock language="sql" code={CODE_SQL} /></Spec>
      <Spec page={p} id="shell"><CodeBlock language="shell" code={CODE_SHELL} /></Spec>
      <Spec page={p} id="log"><CodeBlock title="sync.log" language="log" maxLines={3} code={CODE_LOG} /></Spec>
      <Spec page={p} id="wrap"><CodeBlock title="長い行の折り返し" wrap code={CODE_LONG} /></Spec>
      <Spec page={p} id="grid"><CodeBlock title="桁の確認" code={CODE_GRID} /></Spec>
    </Page>
  )
}
