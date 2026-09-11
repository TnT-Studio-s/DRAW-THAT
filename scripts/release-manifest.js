import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const outputDirectory = path.join(root, 'release-artifacts')
const artifactRoots = [
  path.join(root, 'apps/desktop/out'),
  path.join(root, 'apps/mobile/android/app/build/outputs'),
]

function collectFiles(directory) {
  if (!existsSync(directory)) return []
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...collectFiles(fullPath))
    else if (/\.(exe|nupkg)$/i.test(entry.name) || /^app-release\.(aab|apk)$/i.test(entry.name)) result.push(fullPath)
  }
  return result
}

const artifacts = artifactRoots.flatMap(collectFiles)
if (artifacts.length === 0) {
  console.error('[release] no Windows or Android release artifacts were found.')
  process.exit(2)
}

const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const entries = artifacts.map((file) => {
  const contents = readFileSync(file)
  const digest = createHash('sha256').update(contents).digest('hex')
  return { path: path.relative(root, file), sha256: digest, bytes: contents.byteLength }
})

mkdirSync(outputDirectory, { recursive: true })
writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify({ packageVersion, generatedAt: new Date().toISOString(), artifacts: entries }, null, 2)}\n`, 'utf8')
writeFileSync(path.join(outputDirectory, 'checksums.sha256'), `${entries.map((entry) => `${entry.sha256}  ${entry.path}`).join('\n')}\n`, 'utf8')
console.log(`[release] wrote ${entries.length} artifact checksums to ${path.relative(root, outputDirectory)}`)
