import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const mobile = path.join(root, 'apps', 'mobile')
const gradleWrapper = path.join(mobile, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const action = process.argv[2] || 'sync'
run('npm', ['run', 'build:web'])
if (!existsSync(path.join(mobile, 'android'))) run('npm', ['run', '-w', '@drawduo/mobile', 'cap:add'])
run('npm', ['run', '-w', '@drawduo/mobile', 'cap:sync'])
if (action === 'sync') process.exit(0)
if (!existsSync(gradleWrapper)) {
  console.error('[android] Gradle wrapper is missing; Android project sync completed but no APK can be built.')
  process.exit(2)
}
const task = action === 'release' ? 'assembleRelease' : 'assembleDebug'
if (process.platform === 'win32') {
  run(`"${gradleWrapper}"`, [task], path.join(mobile, 'android'))
} else {
  run(gradleWrapper, [task], path.join(mobile, 'android'))
}
