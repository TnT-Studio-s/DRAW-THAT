import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const commands = [
  ['node', '--version'],
  ['npm', '--version'],
  ['npx', 'colyseus --version'],
  ['npx', 'vite --version'],
  ['npx', 'playwright --version'],
]

console.log('[doctor] checked toolchain')
const manifest = JSON.parse(readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'package.json'), 'utf-8'))

for (const [cmd, arg] of commands) {
  try {
    const output = execSync(`${cmd} ${arg}`.trim(), { stdio: 'pipe' }).toString().trim()
    console.log(`${cmd} ${arg}: ${output}`)
  } catch (error) {
    console.warn(`[doctor] ${cmd} ${arg}: unavailable in PATH or not installed`)
  }
}

console.log('[doctor] workspaces:')
console.log(manifest.workspaces || [])
