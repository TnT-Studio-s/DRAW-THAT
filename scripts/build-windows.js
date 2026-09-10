import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npm', ['run', 'build:web'])
run('npm', ['run', 'make', '--', '--platform', 'win32'], path.resolve(process.cwd(), 'apps/desktop'))
