import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const packageId = 'com.drawduo.playtest'
const apk = path.join(root, 'apps', 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const adb = process.env.ADB_PATH || path.join(process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'), 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')

function run(args, capture = false) {
  const result = spawnSync(adb, args, { cwd: root, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
  if (result.status !== 0) {
    console.error(`[android] adb ${args.join(' ')} failed with ${result.status}`)
    if (capture && result.stderr) console.error(result.stderr.trim())
    process.exit(2)
  }
  return capture ? result.stdout : ''
}

if (!existsSync(adb)) {
  console.error(`[android] ADB not found at ${adb}. Set ANDROID_HOME or ADB_PATH.`)
  process.exit(2)
}
if (!existsSync(apk)) {
  console.error(`[android] APK not found at ${apk}. Run npm run build:android:debug first.`)
  process.exit(2)
}

const devices = run(['devices'], true)
if (!/^\S+\s+device\s*$/m.test(devices)) {
  console.error('[android] No authorized device or emulator is available.')
  process.exit(2)
}

run(['reverse', 'tcp:2567', 'tcp:2567'])
run(['install', '-r', apk])
run(['shell', 'am', 'force-stop', packageId])
run(['shell', 'monkey', '-p', packageId, '1'])
const activities = run(['shell', 'dumpsys', 'activity', 'activities'], true)
if (!activities.includes(packageId)) {
  console.error('[android] APK installed but the application was not found in the active Android activities.')
  process.exit(2)
}

console.log(`[android] PASS: installed and launched ${packageId} on an authorized device.`)
