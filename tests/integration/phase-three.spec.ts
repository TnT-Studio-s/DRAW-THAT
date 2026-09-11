import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startLocalServer, stopLocalServer, waitForPort } from '../helpers/server'

describe('integration: Phase 3 account, progression, and safety API', () => {
  const port = 2680
  let procState: ReturnType<typeof startLocalServer> | null = null

  beforeAll(async () => {
    procState = startLocalServer(port, { testMode: true })
    await waitForPort(port)
  })

  afterAll(() => {
    if (procState) stopLocalServer(procState.process)
  })

  async function request(path: string, userId: string, init: RequestInit = {}) {
    return fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-draw-duo-user': userId, ...init.headers },
    })
  }

  it('keeps account state server-owned and supports terms, catalog, safety, and deletion flows', async () => {
    const accountA = await request('/api/account/me', 'phase3-a').then((response) => response.json())
    const accountB = await request('/api/account/me', 'phase3-b').then((response) => response.json())
    expect(accountA.playerId).not.toBe(accountB.playerId)
    expect(accountA.wallet).toBe(0)

    const terms = await request('/api/account/terms', 'phase3-a', { method: 'POST', body: JSON.stringify({ termsVersion: 'alpha-2026-09' }) })
    expect(terms.status).toBe(200)
    expect((await terms.json()).termsVersion).toBe('alpha-2026-09')

    const profile = await request('/api/account/profile', 'phase3-a', { method: 'PATCH', body: JSON.stringify({ displayName: 'Careful Sketcher' }) })
    expect(profile.status).toBe(200)
    expect((await profile.json()).displayName).toBe('Careful Sketcher')

    const catalog = await request('/api/progression/catalog', 'phase3-a')
    expect(catalog.status).toBe(200)
    expect((await catalog.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ itemId: 'color-red', price: 0 }), expect.objectContaining({ itemId: 'brush-medium', price: 0 }), expect.objectContaining({ itemId: 'font-bubble', price: 24 })]))

    const purchase = await request('/api/progression/purchase', 'phase3-a', { method: 'POST', body: JSON.stringify({ itemId: 'frame-sunrise', requestId: 'phase3-purchase-1' }) })
    expect(purchase.status).toBe(409)
    expect((await purchase.json()).error).toBe('insufficient_balance')

    const recovery = await request('/api/account/recover', 'phase3-a', { method: 'POST' })
    expect(recovery.status).toBe(200)
    expect((await recovery.json()).recovered).toBe(true)

    const report = await request('/api/safety/report', 'phase3-a', { method: 'POST', body: JSON.stringify({ subjectPlayerId: accountB.playerId, category: 'harassment', sessionId: 'session-test', turnId: 'turn-test' }) })
    expect(report.status).toBe(201)
    expect((await report.json()).reportId).toBeTruthy()

    const ordinaryPlayerReports = await request('/api/safety/admin/reports', 'phase3-a')
    expect(ordinaryPlayerReports.status).toBe(403)

    const block = await request('/api/safety/block', 'phase3-a', { method: 'POST', body: JSON.stringify({ blockedPlayerId: accountB.playerId }) })
    expect(block.status).toBe(204)
    const quickA = await request('/api/match/quick', 'phase3-a', { method: 'POST', body: JSON.stringify({ userId: 'phase3-a', buildId: 'draw-duo-phase-2', protocolMajor: 1, language: 'en', platformId: 'web-dev', capabilities: [] }) })
    expect(quickA.status).toBe(200)
    const quickB = await request('/api/match/quick', 'phase3-b', { method: 'POST', body: JSON.stringify({ userId: 'phase3-b', buildId: 'draw-duo-phase-2', protocolMajor: 1, language: 'en', platformId: 'android', capabilities: [] }) })
    expect(quickB.status).toBe(403)
    const invite = await request('/api/lobby/private/create', 'phase3-a', { method: 'POST', body: '{}' }).then((response) => response.json())
    const blockedInviteJoin = await request('/api/lobby/private/join', 'phase3-b', { method: 'POST', body: JSON.stringify({ code: invite.roomCode }) })
    expect(blockedInviteJoin.status).toBe(403)
    const unblock = await request(`/api/safety/block/${accountB.playerId}`, 'phase3-a', { method: 'DELETE' })
    expect(unblock.status).toBe(204)

    const deletion = await request('/api/account', 'phase3-a', { method: 'DELETE' })
    expect(deletion.status).toBe(202)
    const deletedAccount = await request('/api/account/me', 'phase3-a')
    expect(deletedAccount.status).toBe(403)
  })
})
