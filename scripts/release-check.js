import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const blockers = []

function requireFile(file) {
  const absolute = path.join(root, file)
  if (!existsSync(absolute)) blockers.push(`missing_artifact:${file}`)
}

function filesUnder(directory) {
  const absolute = path.join(root, directory)
  if (!existsSync(absolute)) return []
  const files = []
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const entryPath = path.join(absolute, entry.name)
    if (entry.isDirectory()) files.push(...filesUnder(path.relative(root, entryPath)))
    else files.push(entryPath)
  }
  return files
}

function requireTls(name) {
  const value = process.env[name]
  if (!value) {
    blockers.push(`missing_config:${name}`)
    return
  }
  try {
    const parsed = new URL(value)
    const expected = name.endsWith('_WS_URL') ? 'wss:' : 'https:'
    if (parsed.protocol !== expected || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) blockers.push(`non_production_endpoint:${name}`)
  } catch {
    blockers.push(`invalid_config:${name}`)
  }
}

requireFile('apps/web/dist/index.html')
requireTls('DRAW_DUO_BACKEND_HTTP_URL')
requireTls('DRAW_DUO_BACKEND_WS_URL')

const desktopArtifacts = filesUnder('apps/desktop/out').filter((file) => /\.exe$|DrawDuo-win32-x64/i.test(file))
if (desktopArtifacts.length === 0) blockers.push('missing_artifact:apps/desktop/out Steam-ready Windows package')

const androidBundle = path.join(root, 'apps/mobile/android/app/build/outputs/bundle/release/app-release.aab')
if (!existsSync(androidBundle)) blockers.push('missing_artifact:apps/mobile/android/app/build/outputs/bundle/release/app-release.aab')

const appId = readFileSync(path.join(root, 'apps/mobile/capacitor.config.ts'), 'utf8').match(/appId:\s*['"]([^'"]+)/)?.[1]
if (!appId || appId.endsWith('.playtest')) blockers.push('owner_input_required:final Android application ID')

const inspectedFiles = [
  ...filesUnder('apps/web/dist').filter((file) => /\.(js|css|html)$/.test(file)),
  path.join(root, 'apps/mobile/package.json'),
  path.join(root, 'apps/mobile/android/app/build.gradle'),
]
const forbiddenMonetization = /admob|google-mobile-ads|billingclient|rewarded.?ad|watch.?an.?ad/i
for (const file of inspectedFiles) {
  const content = readFileSync(file, 'utf8')
  if (forbiddenMonetization.test(content)) blockers.push(`monetization_path_present:${path.relative(root, file)}`)
  if (/x-draw-duo-user|DRAW_DUO_TEST_MODE|SUPABASE_ACCESS_TOKEN/.test(content)) blockers.push(`test_identity_or_secret_present:${path.relative(root, file)}`)
}

const result = blockers.length === 0 ? 'ready_for_owner_review' : 'blocked'
console.log(JSON.stringify({ result, blockers }, null, 2))
process.exit(blockers.length === 0 ? 0 : 2)
