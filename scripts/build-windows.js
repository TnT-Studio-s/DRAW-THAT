import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status ?? 1}`)
}

const release = process.argv.includes('--release')
const steam = process.argv.includes('--steam')
const localHttpUrl = 'http://127.0.0.1:2567'
const configuredHttpUrl = process.env.DRAW_DUO_BACKEND_HTTP_URL || localHttpUrl
const configuredWsUrl = process.env.DRAW_DUO_BACKEND_WS_URL || configuredHttpUrl.replace(/^http/, 'ws')

function assertReleaseEndpoint(name, value, protocols) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name}_invalid`)
  }
  if (!protocols.includes(parsed.protocol) || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) throw new Error(`${name}_must_use_production_tls`)
}

if (release) {
  try {
    assertReleaseEndpoint('DRAW_DUO_BACKEND_HTTP_URL', configuredHttpUrl, ['https:'])
    assertReleaseEndpoint('DRAW_DUO_BACKEND_WS_URL', configuredWsUrl, ['wss:'])
  } catch (error) {
    console.error(`[windows] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }
}

const root = process.cwd()
const runtimeConfigPath = path.resolve(root, 'apps/desktop/draw-duo-runtime.json')
writeFileSync(runtimeConfigPath, `${JSON.stringify({ backendHttpUrl: configuredHttpUrl, backendWsUrl: configuredWsUrl, release }, null, 2)}\n`, 'utf8')
process.env.VITE_DRAW_DUO_BACKEND_HTTP_URL = configuredHttpUrl
process.env.VITE_DRAW_DUO_BACKEND_WS_URL = configuredWsUrl
process.env.VITE_DRAW_DUO_RELEASE_BUILD = release ? '1' : '0'

try {
  run('npm', ['run', 'build:web'])
  const forgeCommand = steam ? 'package' : 'make'
  run('npm', ['run', forgeCommand, '--', '--platform', 'win32', '--arch', 'x64'], path.resolve(root, 'apps/desktop'))
} catch (error) {
  console.error(`[windows] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
} finally {
  if (existsSync(runtimeConfigPath)) unlinkSync(runtimeConfigPath)
}
