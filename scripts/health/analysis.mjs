import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { Linter } from 'eslint'
import parser from '@typescript-eslint/parser'
import sonar from 'eslint-plugin-sonarjs'
import { root, sourceFiles, outputPath, writeOutput, temporary } from './common.mjs'

function tokenLines(tokens, text) {
  const lines = new Set()
  for (const token of tokens) {
    text.slice(...token.range).split(/\r\n|\r|\n/).forEach((part, i) => {
      if (part.trim()) lines.add(token.loc.start.line + i)
    })
  }
  return lines
}

function declaration(node) {
  if (node.parent?.type === 'VariableDeclarator') return node.parent
  if (['MethodDefinition', 'Property'].includes(node.parent?.type)) return node.parent
  return node
}

function functionName(node, source) {
  const owner = declaration(node)
  const name = node.id?.name ?? owner.id?.name ?? owner.key?.name ?? owner.key?.value
  if (name) return String(name)
  const call = node.parent?.type === 'CallExpression' ? source.getText(node.parent.callee) : 'anonymous'
  return `${call}@${node.loc.start.line}:${node.loc.start.column + 1}`
}

export function analyzeText(file, text) {
  const functions = []
  const suppressions = new Set()
  let codeLines = 0
  // 固定版 SonarJS 4.2.2 S3776 は :function:exit 内で同期的に当該関数を報告する。
  // 診断位置や英語メッセージを解析せず、元 visitor 実行中の関数へ数値を直接結び付ける。
  const base = sonar.rules['cognitive-complexity']
  const rule = {
    meta: base.meta,
    create(context) {
      const stack = []
      const source = context.sourceCode
      const wrapped = Object.create(context, {
        report: { value(descriptor) {
          const current = stack.at(-1)
          const value = descriptor.data?.complexityAmount
          if (!current || descriptor.messageId !== 'refactorFunction' || !Number.isInteger(value) || value < 0 || current.reported) {
            throw new Error('SonarJS の関数別複雑度を対応付けられません')
          }
          current.result.complexity = value
          current.reported = true
        } },
      })
      const visitors = base.create(wrapped)
      return {
        ...visitors,
        Program(node) {
          visitors.Program?.(node)
          codeLines = tokenLines(source.getTokens(node), text).size
          for (const comment of source.getAllComments()) {
            comment.value.split(/\r\n|\r|\n/).forEach((line, i) => {
              if (/^\s*\*?\s*(?:eslint-disable(?:-next-line|-line)?\b|eslint\s+[^\n]*:\s*(?:['"]off['"]|off\b|0\b)|@ts-(?:ignore|nocheck|expect-error)\b|stylelint-disable(?:-next-line|-line)?\b|(?:istanbul|v8|c8)\s+ignore\b|design-ok\s*:|jscpd:ignore-(?:start|end)\b|NOSONAR\b)/i.test(line)) {
                suppressions.add(comment.loc.start.line + i)
              }
            })
          }
        },
        ':function'(node) {
          const owner = declaration(node)
          const tokens = source.getTokens(owner)
          // const と名前を別の行に置いた宣言でも、宣言の開始を含める。
          if (owner.type === 'VariableDeclarator' && owner.parent.declarations[0] === owner) {
            tokens.unshift(source.getFirstToken(owner.parent))
          }
          const result = {
            name: functionName(node, source), line: tokens[0].loc.start.line,
            lines: tokenLines(tokens, text).size, complexity: 0,
          }
          functions.push(result)
          stack.push({ node, result, reported: false })
          visitors[':function'](node)
        },
        ':function:exit'(node) {
          if (stack.at(-1)?.node !== node) throw new Error('関数の構文情報が一致しません')
          visitors[':function:exit'](node)
          stack.pop()
        },
      }
    },
  }
  const messages = new Linter().verify(text, [{
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { health: { rules: { complexity: rule } } },
    rules: { 'health/complexity': ['error', 0] },
  }], { filename: file, allowInlineConfig: false })
  if (messages.length) throw new Error(`${file}: ${messages.map((m) => m.message).join('; ')}`)
  const totalLines = text ? text.split(/\r\n|\r|\n/).length - (/[\r\n]$/.test(text) ? 1 : 0) : 0
  return { path: file, codeLines, totalLines, functions, duplicates: [], suppressions: [...suppressions].sort((a, b) => a - b) }
}

export async function addDuplicates(files, cwd = root) {
  await temporary(async (dir) => {
    const config = path.join(dir, 'jscpd.json')
    fs.writeFileSync(config, '{}')
    execFileSync(process.execPath, [path.join(root, 'node_modules/jscpd/run-jscpd.js'),
      ...files.map((file) => file.path), '--config', config, '--min-lines', '10', '--min-tokens', '1',
      '--mode', 'weak', '--threshold', '100', '--reporters', 'json', '--output', dir,
      '--no-gitignore', '--silent', '--no-colors', '--no-tips',
    ], { cwd, stdio: 'inherit' })
    const report = JSON.parse(fs.readFileSync(path.join(dir, 'jscpd-report.json'), 'utf8'))
    const byPath = new Map(files.map((file) => [path.resolve(cwd, file.path), file]))
    for (const duplicate of report.duplicates) {
      for (const side of [duplicate.firstFile, duplicate.secondFile]) {
        const file = byPath.get(path.resolve(cwd, side.name))
        if (!file) throw new Error(`対象外のコピー: ${side.name}`)
        const line = side.startLoc.line
        const lines = side.endLoc.line - line + 1
        if (lines >= 10 && !file.duplicates.some((d) => d.line === line && d.lines === lines)) {
          file.duplicates.push({ line, lines })
        }
      }
    }
    for (const file of files) file.duplicates.sort((a, b) => a.line - b.line || a.lines - b.lines)
  })
}

async function main() {
  const output = outputPath()
  const files = sourceFiles().map((file) => analyzeText(file, fs.readFileSync(path.join(root, file), 'utf8')))
  await addDuplicates(files)
  writeOutput(output, { language: 'TypeScript', files })
  console.log(`${files.length} ファイルを解析しました`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
