import { describe, expect, it } from 'vitest'
import { MemoryAccountStore } from '../../apps/server/src/services/AccountStore'

describe('Phase 3 account store invariants', () => {
  it('credits both players once and returns the committed result on retry', async () => {
    const store = new MemoryAccountStore()
    const playerA = await store.ensurePlayer('store-a')
    const playerB = await store.ensurePlayer('store-b')
    const input = { resolutionId: 'resolution-1', turnId: 'turn-1', outcome: 'solved' as const, difficulty: 3 as const, playerA: playerA.playerId, playerB: playerB.playerId, rulesVersion: 'casual-en-v1' }

    const first = await store.commitTurn(input)
    const retry = await store.commitTurn(input)
    expect(first).toEqual({ duplicate: false, walletA: 3, walletB: 3, currentStreak: 1, bestStreak: 1 })
    expect(retry).toEqual({ ...first, duplicate: true })
    expect((await store.getProfile(playerA.playerId))?.wallet).toBe(3)
    expect((await store.getProfile(playerB.playerId))?.wallet).toBe(3)
  })

  it('supports an earned cosmetic purchase without allowing a duplicate charge', async () => {
    const store = new MemoryAccountStore()
    const playerA = await store.ensurePlayer('purchase-a')
    const playerB = await store.ensurePlayer('purchase-b')
    for (let index = 0; index < 8; index += 1) {
      await store.commitTurn({ resolutionId: `resolution-${index}`, turnId: `turn-${index}`, outcome: 'solved', difficulty: 3, playerA: playerA.playerId, playerB: playerB.playerId, rulesVersion: 'casual-en-v1' })
    }

    const first = await store.purchase(playerA.playerId, 'color-orange', 'purchase-1')
    const retry = await store.purchase(playerA.playerId, 'color-orange', 'purchase-1')
    const alreadyOwned = await store.purchase(playerA.playerId, 'color-orange', 'purchase-2')
    const otherPlayer = await store.purchase(playerB.playerId, 'color-orange', 'purchase-1')
    expect(first).toEqual({ itemId: 'color-orange', requestId: 'purchase-1', wallet: 12, owned: true })
    expect(retry).toEqual(first)
    expect(alreadyOwned).toEqual({ itemId: 'color-orange', requestId: 'purchase-2', wallet: 12, owned: true })
    expect(otherPlayer).toEqual({ itemId: 'color-orange', requestId: 'purchase-1', wallet: 12, owned: true })
    expect((await store.getProfile(playerA.playerId))?.wallet).toBe(12)
    expect((await store.getProfile(playerB.playerId))?.wallet).toBe(12)
    expect((await store.getDuoProgress(playerA.playerId, playerB.playerId, 'casual-en-v1')).currentStreak).toBe(8)
  })

  it('only equips owned cosmetics and returns sanitized profile state', async () => {
    const store = new MemoryAccountStore()
    const playerA = await store.ensurePlayer('equip-a')
    const playerB = await store.ensurePlayer('equip-b')
    for (let index = 0; index < 8; index += 1) {
      await store.commitTurn({ resolutionId: `equip-resolution-${index}`, turnId: `equip-turn-${index}`, outcome: 'solved', difficulty: 3, playerA: playerA.playerId, playerB: playerB.playerId, rulesVersion: 'casual-en-v1' })
    }
    await store.purchase(playerA.playerId, 'color-orange', 'equip-purchase-1')
    const equipped = await store.equipCosmetic(playerA.playerId, 'color-orange')
    expect(equipped.ownedCosmetics).toContain('color-orange')
    expect(equipped.equippedCosmetics.draw_color).toBe('color-orange')
    expect(equipped).not.toHaveProperty('subject')
    await expect(store.equipCosmetic(playerB.playerId, 'color-orange')).rejects.toThrow('cosmetic_not_owned')
  })

  it('supports staff review of reports without exposing moderation state to players', async () => {
    const store = new MemoryAccountStore()
    const reporter = await store.ensurePlayer('reporter')
    const subject = await store.ensurePlayer('subject')
    const reportId = await store.report(reporter.playerId, subject.playerId, 'abuse', 'session-1', 'turn-1')

    expect((await store.listReports('open')).map((report) => report.reportId)).toEqual([reportId])
    await store.reviewReport(reportId, 'staff', 'no_action', 'reviewed by staff')
    expect(await store.listReports('open')).toEqual([])
    expect((await store.listReports('reviewed')).map((report) => report.reportId)).toEqual([reportId])
  })

  it('applies an audited account suspension from a report review', async () => {
    const store = new MemoryAccountStore()
    const reporter = await store.ensurePlayer('moderator-reporter')
    const subject = await store.ensurePlayer('moderator-subject')
    const reportId = await store.report(reporter.playerId, subject.playerId, 'harassment')

    await store.reviewReport(reportId, 'staff', 'suspend_account', 'repeated abuse')

    expect((await store.getProfile(subject.playerId))?.status).toBe('suspended')
    expect((await store.listReports('reviewed')).find((report) => report.reportId === reportId)?.status).toBe('reviewed')
  })
})
