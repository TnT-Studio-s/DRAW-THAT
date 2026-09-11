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
const release = action === 'release'

function requireReleaseValue(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`[android] ${name} is required for a signed release bundle.`)
    process.exit(2)
  }
  return value
}

if (release) {
  const httpUrl = requireReleaseValue('DRAW_DUO_BACKEND_HTTP_URL')
  const wsUrl = requireReleaseValue('DRAW_DUO_BACKEND_WS_URL')
  const keystore = requireReleaseValue('DRAW_DUO_ANDROID_KEYSTORE_PATH')
  requireReleaseValue('DRAW_DUO_ANDROID_KEYSTORE_PASSWORD')
  requireReleaseValue('DRAW_DUO_ANDROID_KEY_ALIAS')
  requireReleaseValue('DRAW_DUO_ANDROID_KEY_PASSWORD')
  if (!existsSync(keystore)) {
    console.error(`[android] Android keystore was not found at ${keystore}.`)
    process.exit(2)
  }
  try {
    const http = new URL(httpUrl)
    const ws = new URL(wsUrl)
    if (http.protocol !== 'https:' || ws.protocol !== 'wss:' || ['localhost', '127.0.0.1', '::1'].includes(http.hostname)) throw new Error('production_endpoint_required')
  } catch {
    console.error('[android] Release backend URLs must use HTTPS/WSS and a non-local host.')
    process.exit(2)
  }
  process.env.VITE_DRAW_DUO_BACKEND_HTTP_URL = httpUrl
  process.env.VITE_DRAW_DUO_BACKEND_WS_URL = wsUrl
  process.env.VITE_DRAW_DUO_RELEASE_BUILD = '1'
}

run('npm', ['run', 'build:web'])
if (!existsSync(path.join(mobile, 'android'))) run('npm', ['run', '-w', '@drawduo/mobile', 'cap:add'])
run('npm', ['run', '-w', '@drawduo/mobile', 'cap:sync'])
if (action === 'sync') process.exit(0)
if (!existsSync(gradleWrapper)) {
  console.error('[android] Gradle wrapper is missing; Android project sync completed but no APK can be built.')
  process.exit(2)
}
const task = release ? 'bundleRelease' : 'assembleDebug'
if (process.platform === 'win32') {
  run(`"${gradleWrapper}"`, [task], path.join(mobile, 'android'))
} else {
  run(gradleWrapper, [task], path.join(mobile, 'android'))
}

const artifact = release
  ? path.join(mobile, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
  : path.join(mobile, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
if (!existsSync(artifact)) {
  console.error(`[android] Expected artifact was not produced at ${artifact}.`)
  process.exit(2)
}
console.log(`[android] artifact=${artifact}`)
