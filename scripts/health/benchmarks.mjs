import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { root, outputPath, writeOutput, temporary } from './common.mjs'

const output = outputPath()
await temporary(async (dir) => {
  const outfile = path.join(dir, 'benchmarks.mjs')
  await build({ entryPoints: [path.join(root, 'scripts/health/benchmarks.ts')], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: true })
  const { benchmarks } = await import(pathToFileURL(outfile).href)
  const result = benchmarks()
  writeOutput(output, result)
  console.log(result)
})
