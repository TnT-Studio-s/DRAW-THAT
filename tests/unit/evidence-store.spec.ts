import { describe, expect, it } from 'vitest'
import { MemoryEvidenceStore } from '../../apps/server/src/services/EvidenceStore'

describe('Phase 4 evidence retention', () => {
  it('keeps bounded events, extends reported evidence, and purges expiry', async () => {
    const store = new MemoryEvidenceStore()
    await store.append('session-1', 'turn-1', { sequence: 1, kind: 'stroke', data: { points: [] } })
    await store.retain('session-1', 'turn-1', 30 * 24 * 60 * 60 * 1000)

    const retained = await store.get('session-1', 'turn-1')
    expect(retained?.events).toHaveLength(1)
    expect(Date.parse(retained?.expiresAt ?? '')).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)

    await store.append('session-1', 'turn-to-remove', { sequence: 2, kind: 'stroke', data: { points: [] } })
    await store.remove('session-1', 'turn-to-remove')
    expect(await store.get('session-1', 'turn-to-remove')).toBeNull()

    expect(await store.purgeExpired(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))).toBe(0)
    expect(await store.purgeExpired(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))).toBe(1)
    expect(await store.get('session-1', 'turn-1')).toBeNull()
  })
})
