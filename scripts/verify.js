import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const phaseArg = args.find((entry) => entry === '--phase')
const inlinePhaseArg = args.find((entry) => entry.startsWith('--phase='))
const phase = inlinePhaseArg ? inlinePhaseArg.replace('--phase=', '') : phaseArg ? args[args.indexOf(phaseArg) + 1] || '1' : args[0] || '1'

const required = [
  { phase: 1, commands: ['lint', 'typecheck', 'test:unit', 'test:integration', 'test:e2e', 'test:security', 'build:web', 'build:server'] },
  { phase: 2, commands: ['lint', 'typecheck', 'test:unit', 'test:integration', 'test:e2e', 'test:security', 'build:web', 'build:server', 'build:windows', 'android:sync', 'build:android:debug'] },
  { phase: 3, commands: ['test:headless'] },
  { phase: 4, commands: ['test:headless'] },
  { phase: 5, commands: ['test:headless'] },
  { phase: 6, commands: ['test:headless', 'release:check'] },
]

const requiredCommands = required.find((entry) => entry.phase === Number(phase))?.commands ?? []
let status = 'ok'
const blockers = []

console.log(`[verify] phase=${phase}`)

for (const cmd of requiredCommands) {
  const result = spawnSync('npm', ['run', cmd], { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    if (Number(phase) === 2 && cmd === 'build:android:debug') {
      status = 'blocked'
      blockers.push('Android debug build requires an installed/configured Android SDK.')
      console.error(`[verify] ${cmd} blocked by the local Android toolchain (${result.status})`)
      continue
    }
    status = 'failed'
    console.error(`[verify] ${cmd} failed with ${result.status}`)
    break
  }
  console.log(`[verify] ${cmd} passed`)
}

if (Number(phase) >= 3 && !process.env.DATABASE_URL) blockers.push('DATABASE_URL is required for PostgreSQL migration and persistence evidence.')
if (Number(phase) >= 3 && (!process.env.NEON_AUTH_JWKS_URL || !(process.env.NEON_AUTH_BASE_URL || process.env.NEON_AUTH_URL))) blockers.push('Neon Auth JWKS and base URL configuration is required for live authentication evidence.')
if (Number(phase) >= 4) blockers.push('Owner-approved production content and staging/beta evidence require external review and execution.')
if (Number(phase) >= 5) blockers.push('Native mixed-platform gameplay, database failure/restore, and measured load gates require external environments.')
if (Number(phase) >= 6) blockers.push('Final app IDs, signing material, production endpoint, publisher access, store forms, and explicit upload approval require owner action.')
if (status === 'ok' && blockers.length > 0) status = 'blocked'

const code = status === 'failed' || (Number(phase) >= 5 && status === 'blocked') ? 1 : 0
console.log(JSON.stringify({ phase, status, blockers, code }, null, 2))
process.exit(code)
