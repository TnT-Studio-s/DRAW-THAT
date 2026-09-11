import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startLocalServer, stopLocalServer, waitForPort } from '../helpers/server'

describe('integration: Phase 4 service readiness', () => {
  const port = 2682
  let procState: ReturnType<typeof startLocalServer> | null = null

  beforeAll(async () => {
    procState = startLocalServer(port, { testMode: true, adminKey: 'phase-four-admin' })
    await waitForPort(port)
  })

  afterAll(() => {
    if (procState) stopLocalServer(procState.process)
  })

  it('reports the memory adapter as ready in test mode', async () => {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`)
    expect(health.status).toBe(200)
    await expect(health.json()).resolves.toMatchObject({ ok: true, acceptingAdmissions: true })
    const response = await fetch(`http://127.0.0.1:${port}/api/ready`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, persistence: 'memory' })
  })

  it('serves the restricted moderation dashboard without embedding a key', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/admin/moderation`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Draw Duo moderation queue')
    expect(html).not.toContain('DRAW_DUO_MODERATION_KEY')
  })

  it('denies an unauthenticated admission drain request', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/admission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepting: false }),
    })
    expect(response.status).toBe(403)
  })

  it('allows the configured test moderator to read the queue', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/safety/admin/reports`, {
      headers: { 'x-moderation-key': 'phase-four-admin' },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ reports: [] })
  })
})
