// 配布物（dist/）を作る。部品は 1 つの ESM に、CSS は読む順のまま 1 つに、CLI と監査は Node 向けにまとめ、型は tsc で出す。
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })

await build({ entryPoints: [path.join(root, 'src/index.ts')], outfile: path.join(dist, 'index.js'), bundle: true, format: 'esm', jsx: 'automatic', target: 'es2022', external: ['react', 'react/jsx-runtime', 'react-dom', '@tabler/icons-react'] })
await build({ entryPoints: [path.join(root, 'audit/index.ts')], outfile: path.join(dist, 'audit.js'), bundle: true, format: 'esm', platform: 'node', target: 'node20', external: ['@playwright/test', '@axe-core/playwright'] })
await build({ entryPoints: [path.join(root, 'cli/index.ts')], outfile: path.join(dist, 'cli.js'), bundle: true, format: 'esm', platform: 'node', target: 'node20', banner: { js: '#!/usr/bin/env node' } })
fs.chmodSync(path.join(dist, 'cli.js'), 0o755)

/** @import の順に中身を展開する（読む順がカスケードの決まりなので、順番を変えない） */
function inline(file) {
  return fs.readFileSync(file, 'utf8').replace(/^@import '([^']+)';$/gm, (_, rel) => inline(path.resolve(path.dirname(file), rel)))
}
fs.writeFileSync(path.join(dist, 'styles.css'), inline(path.join(root, 'src/styles/index.css')))
fs.writeFileSync(path.join(dist, 'tokens.css'), inline(path.join(root, 'src/styles/tokens.css')))

const tsc = path.join(root, 'node_modules/.bin/tsc')
execFileSync(tsc, ['-p', path.join(root, 'tsconfig.build.json')], { stdio: 'inherit', cwd: root })
