import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const includeNativeBuilds = process.argv.includes('--native-builds')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const commands = [
  'lint',
  'typecheck',
  'test:unit',
  'test:integration',
  'test:security',
  'test:packaging',
  'build:server',
  'build:web',
  'test:e2e',
]

if (includeNativeBuilds) {
  commands.push('build:windows', 'android:sync', 'build:android:debug')
}

const startedAt = new Date()
const results = []

for (const command of commands) {
  const commandStartedAt = Date.now()
  console.log(`\n[headless] npm run ${command}`)
  const result = spawnSync(npm, ['run', command], {
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' },
    shell: process.platform === 'win32',
    stdio: 'inherit',
    windowsHide: true,
  })
  const exitCode = result.status ?? 1
  results.push({
    command: `npm run ${command}`,
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs: Date.now() - commandStartedAt,
  })
}

const report = {
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  platform: process.platform,
  nativeBuildsIncluded: includeNativeBuilds,
  result: results.every((entry) => entry.status === 'passed') ? 'passed' : 'failed',
  results,
  boundaries: {
    androidDevice: 'not_run',
    electronRuntime: 'not_run',
    packagedWindowsToAndroidSession: 'not_run',
    visualAcceptance: 'not_run',
  },
}

const reportDirectory = path.join(process.cwd(), 'test-results')
const reportPath = path.join(reportDirectory, 'headless-summary.json')
mkdirSync(reportDirectory, { recursive: true })
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`\n[headless] ${report.result.toUpperCase()}`)
console.log(`[headless] report: ${reportPath}`)
console.log('[headless] device, Electron runtime, mixed-platform, and visual gates were not run.')
process.exit(report.result === 'passed' ? 0 : 1)
