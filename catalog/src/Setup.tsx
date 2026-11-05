import { Code, CodeBlock, KeyValues, Notice } from '@ymasaki/ignite'
import { version } from '../../package.json'
import { Page, Spec } from './kit'

// 採用の手順（正本は docs/adopting.md）。命令はそのまま写せる形で置き、説明は見出しとラベルに留める
const TGZ = `ymasaki-ignite-${version}.tgz`

const GET = `# GitHub Release から取り、ハッシュを照合する
$ gh release download v${version} --repo github.com/ymasaki/ignite --dir ./ignite-download
$ (cd ignite-download && shasum -a 256 -c SHA256SUMS)
$ mkdir -p vendor && cp ignite-download/${TGZ} vendor/
$ npm install --save-exact ./vendor/${TGZ} --ignore-scripts`
const INSTALL = `$ npm install react react-dom @tabler/icons-react
$ npm install -D @playwright/test @axe-core/playwright
$ npx playwright install chromium`
const INSTALL_APP = `$ npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom`
const INIT = `# 既存のアプリ
$ npx ignite init
# 新しいアプリ（ひな形ごと置く）
$ npx ignite init --app`
const MAIN = `import '@ymasaki/ignite/styles.css'
import './styles/app.css' // アプリのテーマは後に読む
import { startAssist, startTheme } from '@ymasaki/ignite'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

void startTheme(Object.fromEntries(new URLSearchParams(location.search)))
startAssist()
createRoot(document.getElementById('root')!).render(<App />)`
const APP = `<AppShell side={...} title="一覧">
  <Board>
    <ListScreen ... />
  </Board>
</AppShell>`
const CONFIG = `{
  "source": ["src"],
  "screens": ["src/app", "src/screens"],
  "parts": ["src/components"],
  "styles": ["src/styles"],
  "themes": ["src/styles/theme.css"],
  "ignore": [],
  "forbiddenWords": [],
  "maxText": 32
}`
const AUDIT = `defineIgniteAudit({
  screens: [
    { name: '一覧', path: '/' },
    { name: '詳細', path: '/?open=1' },
  ],
})`
const VERIFY = `# ソースの検査（pre-commit では --staged）
$ npx ignite check
# 描いた画面の監査
$ npm run ignite:audit`
const UPGRADE = `# 次の版を Release から取り、照合してから
$ npx ignite upgrade ./vendor/ymasaki-ignite-次の版.tgz
# 決まりが版とそろっているか（CI 向け）
$ npx ignite sync --check`

export function SetupPage({ target }: { target?: string | null }) {
  const p = 'setup'
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="need">
        <KeyValues rows={[
          ['Node.js', '22.12.0 以上'],
          ['画面', 'React・react-dom'],
          ['アイコン', '@tabler/icons-react'],
          ['監査', '@playwright/test・@axe-core/playwright'],
          ['今の版', version, { num: true }],
        ]} />
        <Notice tone="info">詳しい手順は docs/adopting.md にある</Notice>
      </Spec>
      <Spec page={p} id="get">
        <CodeBlock title="Release から入れる" language="shell" wrap code={GET} />
        <KeyValues rows={[
          ['添付', `${TGZ}・SHA256SUMS・COMMIT`],
          ['コミット', 'vendor の tgz・package.json・lockfile'],
        ]} />
      </Spec>
      <Spec page={p} id="install">
        <CodeBlock title="依存" language="shell" wrap code={INSTALL} />
        <CodeBlock title="ひな形を動かすとき" language="shell" wrap code={INSTALL_APP} />
      </Spec>
      <Spec page={p} id="init">
        <CodeBlock title="初期化の命令" language="shell" wrap code={INIT} />
        <KeyValues rows={[
          ['ignite.config.json', 'ソースの検査の設定'],
          ['e2e/ignite.audit.ts', '監査する画面の一覧'],
          ['playwright.ignite.config.ts', '監査の実行の設定'],
          ['AGENTS.md', 'AI エージェント向けの決まり'],
          ['package.json', 'ignite:check などの入口'],
        ]} />
        <Notice tone="info">置いてあるファイルは上書きしない</Notice>
      </Spec>
      <Spec page={p} id="wire">
        <CodeBlock title="src/main.tsx" language="ts" lineNumbers code={MAIN} />
        <KeyValues rows={[
          ['index.html', 'テーマを当てるスクリプトと書体の link'],
          ['写す元', <Code key="t">templates/app/index.html</Code>],
          ['画面の枠', 'AppShell と Board'],
          ['画面の型', 'ListScreen・DashboardScreen・SettingsScreen'],
          ['設定の画面', 'ThemeSettings・AssistSettings'],
        ]} />
        <CodeBlock title="App.tsx の形" language="ts" code={APP} />
      </Spec>
      <Spec page={p} id="config">
        <CodeBlock title="ignite.config.json" language="json" code={CONFIG} />
        <CodeBlock title="e2e/ignite.audit.ts" language="ts" code={AUDIT} />
        <KeyValues rows={[
          ['screens', '画面。素の要素と長い文言を止める'],
          ['themes', '色を書いてよいトークンの定義'],
          ['forbiddenWords', '画面に直書きしない語'],
          ['URL', '?skin= と ?mode= を受ける'],
        ]} />
      </Spec>
      <Spec page={p} id="verify">
        <CodeBlock title="検査と監査" language="shell" wrap code={VERIFY} />
        <KeyValues rows={[['監査の結果', <Code key="r">test-results-audit/report.md</Code>]]} />
      </Spec>
      <Spec page={p} id="upgrade">
        <CodeBlock title="次の版へ" language="shell" wrap code={UPGRADE} />
        <Notice tone="info">変更点は CHANGELOG.md で確かめる</Notice>
        <KeyValues rows={[['一緒にコミット', 'package.json・lockfile・規約・スキル']]} />
      </Spec>
      <Spec page={p} id="rules">
        <KeyValues rows={[
          ['部品の見た目', 'アプリの CSS で上書きしない'],
          ['足りない見た目', 'Ignite に修飾を足す'],
          ['アプリのコード', 'Ignite に書かない'],
          ['版', '固定し、lockfile とコミットする'],
        ]} />
      </Spec>
    </Page>
  )
}
