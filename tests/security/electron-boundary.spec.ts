import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const mainSource = readFileSync(path.resolve(process.cwd(), 'apps/desktop/src/main.mjs'), 'utf8')
const preloadSource = readFileSync(path.resolve(process.cwd(), 'apps/desktop/src/preload.mjs'), 'utf8')

describe('security: Electron boundary', () => {
  it('keeps the renderer isolated and the external navigation bridge restricted', () => {
    expect(mainSource).toContain('nodeIntegration: false')
    expect(mainSource).toContain('contextIsolation: true')
    expect(mainSource).toContain('sandbox: true')
    expect(mainSource).toContain("url.startsWith('https://')")
    expect(preloadSource).toContain('contextBridge.exposeInMainWorld')
    expect(preloadSource).not.toContain('require(')
  })

  it('derives the CSP connection allowlist from configured backend origins', () => {
    expect(mainSource).toContain('DRAW_DUO_BACKEND_HTTP_URL')
    expect(mainSource).toContain('DRAW_DUO_BACKEND_WS_URL')
    expect(mainSource).toContain('backendConnectSources()')
    expect(mainSource).not.toContain('connect-src \'self\' http://127.0.0.1:2567 ws://127.0.0.1:2567')
  })
})
