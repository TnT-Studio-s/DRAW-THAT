import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const phaseArg = args.find((entry) => entry === '--phase')
const inlinePhaseArg = args.find((entry) => entry.startsWith('--phase='))
const phase = inlinePhaseArg ? inlinePhaseArg.replace('--phase=', '') : phaseArg ? args[args.indexOf(phaseArg) + 1] || '1' : args[0] || '1'

const required = [
  { phase: 1, commands: ['lint', 'typecheck', 'test:unit', 'test:integration', 'test:e2e', 'test:security', 'build:web', 'build:server'] },
  { phase: 2, commands: ['lint', 'typecheck', 'test:unit', 'test:integration', 'test:e2e', 'test:security', 'build:web', 'build:server', 'build:windows', 'android:sync', 'build:android:debug'] },
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

console.log(JSON.stringify({ phase, status, blockers, code: status === 'failed' ? 1 : 0 }, null, 2))
process.exit(status === 'failed' ? 1 : 0)
