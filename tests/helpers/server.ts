import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'

const TSX_CLI = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs')

export async function waitForPort(port: number, timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health' }, (res) => {
        res.resume()
        res.on('end', () => resolve())
      })
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timeout waiting for test server on ${port}`))
          return
        }
        setTimeout(tick, 150)
      })
      req.on('close', () => {
        // intentional noop
      })
    }
    tick()
  })
}

export function startLocalServer(port: number, options: { testMode?: boolean; adminKey?: string } = {}): {
  process: ChildProcessWithoutNullStreams
  port: number
  url: string
} {
  const proc = spawn(process.execPath, [TSX_CLI, 'src/index.ts'], {
    cwd: `${process.cwd()}/apps/server`,
    env: {
      ...process.env,
      PORT: String(port),
      DRAW_DUO_TEST_MODE: options.testMode ? '1' : process.env.DRAW_DUO_TEST_MODE,
      DRAW_DUO_TEST_ADMIN_KEY: options.adminKey ?? process.env.DRAW_DUO_TEST_ADMIN_KEY,
    },
    shell: false,
    stdio: 'pipe',
  })

  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')

  return { process: proc as ChildProcessWithoutNullStreams, port, url: `http://127.0.0.1:${port}` }
}

export function stopLocalServer(proc: ChildProcessWithoutNullStreams) {
  proc.removeAllListeners()
  proc.kill('SIGINT')
}
