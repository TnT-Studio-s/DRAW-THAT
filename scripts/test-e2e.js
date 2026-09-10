import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs')
const viteCli = path.resolve(process.cwd(), 'node_modules/vite/bin/vite.js')

function stopProcessTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    return
  }
  child.kill()
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.resume()
        res.on('end', () => resolve(true))
      })
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`port ${port} never opened`))
        } else {
          setTimeout(check, 250)
        }
      })
      req.end()
    }
    setTimeout(() => check(), 100)
  })
}

async function run() {
  const serverProc = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: `${process.cwd()}/apps/server`,
    env: { ...process.env, DRAW_DUO_TEST_MODE: '1' },
    stdio: 'inherit',
  })

  const webProc = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', '5173'], {
    cwd: `${process.cwd()}/apps/web`,
    stdio: 'inherit',
  })

  try {
    await waitForPort(2567, 30000)
    await waitForPort(5173, 30000)
    const result = spawn(
      process.execPath,
      [path.resolve(process.cwd(), 'node_modules/@playwright/test/cli.js'), 'test'],
      { stdio: 'inherit' },
    )
    await new Promise((resolve, reject) => {
      result.on('exit', (code) => {
        if (code === 0) resolve(code)
        else reject(new Error(`playwright test exited ${code}`))
      })
      result.on('error', reject)
    })
  } finally {
    stopProcessTree(serverProc)
    stopProcessTree(webProc)
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
