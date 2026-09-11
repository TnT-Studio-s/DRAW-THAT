import fs from 'node:fs'
import path from 'node:path'

export function findProjectRoot(startPath: string) {
  let current = path.resolve(startPath)
  while (true) {
    if (fs.existsSync(path.join(current, 'docs', 'reference', 'seed-prompts.json'))) return current
    const parent = path.dirname(current)
    if (parent === current) throw new Error('project_root_not_found')
    current = parent
  }
}
