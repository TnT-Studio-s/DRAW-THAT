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

    const first = await store.purchase(playerA.playerId, 'frame-sunrise', 'purchase-1')
    const retry = await store.purchase(playerA.playerId, 'frame-sunrise', 'purchase-1')
    expect(first).toEqual({ itemId: 'frame-sunrise', requestId: 'purchase-1', wallet: 4, owned: true })
    expect(retry).toEqual(first)
    expect((await store.getProfile(playerA.playerId))?.wallet).toBe(4)
  })
})
