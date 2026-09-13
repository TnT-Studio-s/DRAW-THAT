import { type Pool, type PoolClient } from 'pg'
import { COSMETIC_CATALOG, STARTER_COSMETIC_IDS, cosmeticSupportsSlot, defaultCosmeticSlot, type CosmeticCatalogItem, type CosmeticEquipSlot } from '@drawduo/protocol'
import { getDatabasePool } from './Database.js'

export type AccountProfile = {
  playerId: string
  displayName: string
  status: 'active' | 'deleted' | 'suspended'
  termsVersion: string | null
  wallet: number
  lifetimeCoins: number
  duoStreakCurrent: number
  duoStreakBest: number
  ownedCosmetics: string[]
  equippedCosmetics: Record<string, string>
}

export type CatalogItem = CosmeticCatalogItem
export type PurchaseResult = { itemId: string; requestId: string; wallet: number; owned: boolean }
export type ReportRecord = {
  reportId: string
  reporterId: string
  subjectId: string
  category: string
  sessionId: string | null
  turnId: string | null
  status: 'open' | 'reviewed'
  reviewedAt: string | null
}
export type SessionStart = { sessionId: string; playerA: string; playerB: string; entryContext: string; protocolMajor: number; rulesVersion: string; contentVersion: string }
export type SessionStatus = 'completed' | 'abandoned' | 'server_error'
export type DuoProgress = { currentStreak: number; bestStreak: number }
export type TurnCommit = { resolutionId: string; turnId: string; sessionId?: string; turnIndex?: number; drawer?: string; promptKey?: string; outcome: 'solved' | 'timeout' | 'passed' | 'abandoned' | 'annulled'; difficulty: 0 | 1 | 2 | 3; playerA: string; playerB: string; rulesVersion: string }
export type TurnCommitResult = { duplicate: boolean; walletA: number; walletB: number; currentStreak: number; bestStreak: number }

export interface AccountStore {
  ensurePlayer(subject: string, displayName?: string): Promise<AccountProfile>
  findPlayerIdBySubject(subject: string): Promise<string | null>
  getProfile(playerId: string): Promise<AccountProfile | null>
  updateProfile(playerId: string, displayName: string): Promise<AccountProfile>
  acceptTerms(playerId: string, termsVersion: string): Promise<AccountProfile>
  getCatalog(): Promise<CatalogItem[]>
  purchase(playerId: string, itemId: string, requestId: string): Promise<PurchaseResult>
  equipCosmetic(playerId: string, itemId: string, slot?: CosmeticEquipSlot): Promise<AccountProfile>
  report(reporterId: string, subjectId: string, category: string, sessionId?: string, turnId?: string): Promise<string>
  findReport(reportId: string): Promise<ReportRecord | null>
  listReports(status?: 'open' | 'reviewed'): Promise<ReportRecord[]>
  reviewReport(reportId: string, staffSubject: string, action: string, reason: string): Promise<void>
  block(blockerId: string, blockedId: string): Promise<void>
  unblock(blockerId: string, blockedId: string): Promise<void>
  areBlocked(firstId: string, secondId: string): Promise<boolean>
  requestDeletion(playerId: string): Promise<void>
  startSession(input: SessionStart): Promise<void>
  finishSession(sessionId: string, finalTeamScore: number, status: SessionStatus): Promise<void>
  getDuoProgress(playerA: string, playerB: string, rulesVersion: string): Promise<DuoProgress>
  commitTurn(input: TurnCommit): Promise<TurnCommitResult>
}

const catalog: CatalogItem[] = COSMETIC_CATALOG.map((item) => ({ ...item }))
const starterLoadout: Record<string, string> = {
  draw_color: 'color-blue',
  brush_size: 'brush-medium',
  name_font: 'font-plain',
  nameplate_border: 'border-plain',
}

type MemoryAccount = AccountProfile & { subject: string; owned: Set<string> }

export class MemoryAccountStore implements AccountStore {
  private readonly accounts = new Map<string, MemoryAccount>()
  private readonly subjects = new Map<string, string>()
  private readonly purchases = new Map<string, PurchaseResult>()
  private readonly resolutions = new Map<string, TurnCommitResult>()
  private readonly duoProgress = new Map<string, DuoProgress>()
  private readonly blocks = new Set<string>()
  private readonly reports = new Map<string, ReportRecord>()
  private readonly sessions = new Map<string, SessionStart>()

  async ensurePlayer(subject: string, displayName?: string) {
    const existingId = this.subjects.get(subject)
    if (existingId) return this.profile(this.accounts.get(existingId) as MemoryAccount)
    const player: MemoryAccount = { playerId: `player_${subject}`, subject, displayName: displayName || `Player ${subject.slice(0, 6)}`, status: 'active', termsVersion: null, wallet: 0, lifetimeCoins: 0, duoStreakCurrent: 0, duoStreakBest: 0, ownedCosmetics: [...STARTER_COSMETIC_IDS], equippedCosmetics: { ...starterLoadout }, owned: new Set(STARTER_COSMETIC_IDS) }
    this.subjects.set(subject, player.playerId)
    this.accounts.set(player.playerId, player)
    return this.profile(player)
  }

  async findPlayerIdBySubject(subject: string) { return this.subjects.get(subject) ?? null }
  async getProfile(playerId: string) { const account = this.accounts.get(playerId); return account ? this.profile(account) : null }
  async updateProfile(playerId: string, displayName: string) { const account = this.required(playerId); account.displayName = displayName; return this.profile(account) }
  async acceptTerms(playerId: string, termsVersion: string) { const account = this.required(playerId); account.termsVersion = termsVersion; return this.profile(account) }
  async getCatalog() { return catalog }
  async purchase(playerId: string, itemId: string, requestId: string) {
    const purchaseKey = `${playerId}:${requestId}`
    const previous = this.purchases.get(purchaseKey)
    if (previous) {
      if (previous.itemId !== itemId) throw new Error('idempotency_conflict')
      return previous
    }
    const account = this.required(playerId)
    const item = catalog.find((entry) => entry.itemId === itemId && entry.enabled)
    if (!item) throw new Error('catalog_item_not_found')
    if (account.owned.has(itemId)) return { itemId, requestId, wallet: account.wallet, owned: true }
    if (account.wallet < item.price) throw new Error('insufficient_balance')
    account.wallet -= item.price
    account.owned.add(itemId)
    const result = { itemId, requestId, wallet: account.wallet, owned: true }
    this.purchases.set(purchaseKey, result)
    return result
  }
  async equipCosmetic(playerId: string, itemId: string, requestedSlot?: CosmeticEquipSlot) {
    const account = this.required(playerId)
    const item = catalog.find((entry) => entry.itemId === itemId && entry.enabled)
    if (!item) throw new Error('catalog_item_not_found')
    if (!account.owned.has(itemId)) throw new Error('cosmetic_not_owned')
    const slot = requestedSlot ?? defaultCosmeticSlot(item)
    if (!cosmeticSupportsSlot(item, slot)) throw new Error('invalid_cosmetic_slot')
    account.equippedCosmetics[slot] = itemId
    return this.profile(account)
  }
  async report(reporterId: string, subjectId: string, category: string, sessionId?: string, turnId?: string) {
    const id = `report_${this.reports.size + 1}`
    this.reports.set(id, {
      reportId: id,
      reporterId,
      subjectId,
      category,
      sessionId: sessionId ?? null,
      turnId: turnId ?? null,
      status: 'open',
      reviewedAt: null,
    })
    return id
  }

  async listReports(status: 'open' | 'reviewed' = 'open') {
    return [...this.reports.values()].filter((entry) => entry.status === status)
  }

  async findReport(reportId: string) { return this.reports.get(reportId) ?? null }

  async reviewReport(reportId: string, _staffSubject: string, action: string, reason: string) {
    const report = this.reports.get(reportId)
    if (!report) {
      throw new Error('report_not_found')
    }
    if (!['no_action', 'warn', 'suspend_account', 'remove_content'].includes(action) || action.length > 128) {
      throw new Error('invalid_review_action')
    }
    if (!reason || reason.length > 1024) {
      throw new Error('invalid_review_reason')
    }
    if (action === 'suspend_account') {
      const subject = this.required(report.subjectId)
      subject.status = 'suspended'
    }
    report.status = 'reviewed'
    report.reviewedAt = new Date().toISOString()
  }
  async block(blockerId: string, blockedId: string) { if (blockerId === blockedId) throw new Error('invalid_block'); this.blocks.add(`${blockerId}:${blockedId}`) }
  async unblock(blockerId: string, blockedId: string) { this.blocks.delete(`${blockerId}:${blockedId}`) }
  async areBlocked(firstId: string, secondId: string) { return this.blocks.has(`${firstId}:${secondId}`) || this.blocks.has(`${secondId}:${firstId}`) }
  async requestDeletion(playerId: string) { const account = this.required(playerId); account.status = 'deleted'; account.displayName = 'Deleted player' }
  async startSession(input: SessionStart) { this.sessions.set(input.sessionId, input) }
  async finishSession(_sessionId: string, _finalTeamScore: number, _status: SessionStatus) {}
  async getDuoProgress(playerA: string, playerB: string, rulesVersion: string) { return this.duoProgress.get(this.duoKey(playerA, playerB, rulesVersion)) ?? { currentStreak: 0, bestStreak: 0 } }
  async commitTurn(input: TurnCommit) {
    const previous = this.resolutions.get(input.resolutionId)
    if (previous) return { ...previous, duplicate: true }
    const a = this.required(input.playerA)
    const b = this.required(input.playerB)
    const duo = this.duoKey(a.playerId, b.playerId, input.rulesVersion)
    const progress = this.duoProgress.get(duo) ?? { currentStreak: 0, bestStreak: 0 }
    const current = progress.currentStreak
    const next = input.outcome === 'solved' ? current + 1 : input.outcome === 'annulled' ? current : 0
    const best = Math.max(progress.bestStreak, next)
    if (input.outcome === 'solved') { a.wallet += input.difficulty; b.wallet += input.difficulty; a.lifetimeCoins += input.difficulty; b.lifetimeCoins += input.difficulty }
    a.duoStreakCurrent = next; b.duoStreakCurrent = next; a.duoStreakBest = best; b.duoStreakBest = best
    this.duoProgress.set(duo, { currentStreak: next, bestStreak: best })
    const result = { duplicate: false, walletA: a.wallet, walletB: b.wallet, currentStreak: next, bestStreak: best }
    this.resolutions.set(input.resolutionId, result)
    return result
  }
  private duoKey(playerA: string, playerB: string, rulesVersion: string) { return `${[playerA, playerB].sort().join(':')}:${rulesVersion}` }
  private required(playerId: string) { const account = this.accounts.get(playerId); if (!account) throw new Error('account_not_found'); return account }
  private profile(account: MemoryAccount): AccountProfile { return { playerId: account.playerId, displayName: account.displayName, status: account.status, termsVersion: account.termsVersion, wallet: account.wallet, lifetimeCoins: account.lifetimeCoins, duoStreakCurrent: account.duoStreakCurrent, duoStreakBest: account.duoStreakBest, ownedCosmetics: [...account.owned], equippedCosmetics: { ...account.equippedCosmetics } } }
}

class PostgresAccountStore implements AccountStore {
  constructor(private readonly pool: Pool) {}

  async ensurePlayer(subject: string, displayName?: string) {
    const result = await this.pool.query<AccountProfile & { auth_subject: string }>(`INSERT INTO players (auth_subject, display_name) VALUES ($1, $2) ON CONFLICT (auth_subject) DO UPDATE SET last_seen_at = now() RETURNING player_id AS "playerId", display_name AS "displayName", status, terms_version AS "termsVersion", 0 AS wallet, 0 AS "lifetimeCoins", 0 AS "duoStreakCurrent", 0 AS "duoStreakBest", auth_subject`, [subject, displayName || `Player ${subject.slice(0, 6)}`])
    await this.pool.query(`INSERT INTO wallets (player_id) VALUES ($1) ON CONFLICT DO NOTHING`, [result.rows[0].playerId])
    await this.pool.query(`INSERT INTO player_cosmetics (player_id, item_id) SELECT $1, starter.item_id FROM unnest($2::text[]) starter(item_id) ON CONFLICT DO NOTHING`, [result.rows[0].playerId, [...STARTER_COSMETIC_IDS]])
    await this.pool.query(`INSERT INTO player_cosmetic_loadout (player_id, slot, item_id) VALUES ($1, 'draw_color', 'color-blue'), ($1, 'brush_size', 'brush-medium'), ($1, 'name_font', 'font-plain'), ($1, 'nameplate_border', 'border-plain') ON CONFLICT (player_id, slot) DO NOTHING`, [result.rows[0].playerId])
    const profile = await this.getProfile(result.rows[0].playerId)
    if (!profile) throw new Error('account_not_found')
    return profile
  }
  async findPlayerIdBySubject(subject: string) {
    const result = await this.pool.query<{ player_id: string }>('SELECT player_id FROM players WHERE auth_subject = $1', [subject])
    return result.rows[0]?.player_id ?? null
  }
  async getProfile(playerId: string) {
    const result = await this.pool.query<AccountProfile>(`SELECT p.player_id AS "playerId", p.display_name AS "displayName", p.status, p.terms_version AS "termsVersion", w.balance AS wallet, w.lifetime_gameplay_coins AS "lifetimeCoins", COALESCE(d.current_streak, 0) AS "duoStreakCurrent", COALESCE(d.best_streak, 0) AS "duoStreakBest", COALESCE((SELECT array_agg(pc.item_id ORDER BY pc.item_id) FROM player_cosmetics pc WHERE pc.player_id = p.player_id), ARRAY[]::text[]) AS "ownedCosmetics", COALESCE((SELECT jsonb_object_agg(loadout.slot, loadout.item_id) FROM player_cosmetic_loadout loadout WHERE loadout.player_id = p.player_id), '{}'::jsonb) AS "equippedCosmetics" FROM players p JOIN wallets w ON w.player_id = p.player_id LEFT JOIN LATERAL (SELECT current_streak, best_streak FROM duos WHERE player_a = p.player_id OR player_b = p.player_id ORDER BY updated_at DESC LIMIT 1) d ON true WHERE p.player_id = $1`, [playerId])
    return result.rows[0] ?? null
  }
  async updateProfile(playerId: string, displayName: string) { const result = await this.pool.query(`UPDATE players SET display_name = $2 WHERE player_id = $1 AND status = 'active' RETURNING player_id`, [playerId, displayName]); if (!result.rowCount) throw new Error('account_not_found'); return this.requiredProfile(playerId) }
  async acceptTerms(playerId: string, termsVersion: string) { const result = await this.pool.query(`UPDATE players SET terms_version = $2 WHERE player_id = $1 RETURNING player_id`, [playerId, termsVersion]); if (!result.rowCount) throw new Error('account_not_found'); return this.requiredProfile(playerId) }
  async getCatalog() { const result = await this.pool.query<CatalogItem>(`SELECT item_id AS "itemId", type, name, price, value, enabled FROM cosmetic_catalog WHERE enabled = true ORDER BY price, item_id`); return result.rows }
  async purchase(playerId: string, itemId: string, requestId: string) {
    return this.inTransaction(async (client) => {
      const previous = await client.query<PurchaseResult>(`SELECT item_id AS "itemId", idempotency_key AS "requestId", balance_after AS wallet, true AS owned FROM wallet_ledger WHERE player_id = $1 AND idempotency_key = $2`, [playerId, requestId])
      if (previous.rows[0]) {
        if (previous.rows[0].itemId !== itemId) throw new Error('idempotency_conflict')
        return previous.rows[0]
      }
      const item = await client.query<CatalogItem>(`SELECT item_id AS "itemId", type, name, price, value, enabled FROM cosmetic_catalog WHERE item_id = $1 AND enabled = true`, [itemId])
      if (!item.rows[0]) throw new Error('catalog_item_not_found')
      const wallet = await client.query<{ balance: number }>(`SELECT balance FROM wallets WHERE player_id = $1 FOR UPDATE`, [playerId])
      if (!wallet.rows[0]) throw new Error('account_not_found')
      const owned = await client.query(`SELECT 1 FROM player_cosmetics WHERE player_id = $1 AND item_id = $2`, [playerId, itemId])
      if (owned.rowCount) return { itemId, requestId, wallet: wallet.rows[0].balance, owned: true }
      if (wallet.rows[0].balance < item.rows[0].price) throw new Error('insufficient_balance')
      const balance = wallet.rows[0].balance - item.rows[0].price
      await client.query(`UPDATE wallets SET balance = $2, revision = revision + 1 WHERE player_id = $1`, [playerId, balance])
      await client.query(`INSERT INTO wallet_ledger (player_id, delta, reason, item_id, idempotency_key, balance_after) VALUES ($1, $2, 'cosmetic_purchase', $3, $4, $5)`, [playerId, -item.rows[0].price, itemId, requestId, balance])
      await client.query(`INSERT INTO player_cosmetics (player_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [playerId, itemId])
      return { itemId, requestId, wallet: balance, owned: true }
    })
  }
  async equipCosmetic(playerId: string, itemId: string, requestedSlot?: CosmeticEquipSlot) {
    await this.inTransaction(async (client) => {
      const item = await client.query<CatalogItem>(`SELECT item_id AS "itemId", type, name, price, value, enabled FROM cosmetic_catalog WHERE item_id = $1 AND enabled = true`, [itemId])
      if (!item.rows[0]) throw new Error('catalog_item_not_found')
      const owned = await client.query(`SELECT 1 FROM player_cosmetics WHERE player_id = $1 AND item_id = $2`, [playerId, itemId])
      if (!owned.rowCount) throw new Error('cosmetic_not_owned')
      const slot = requestedSlot ?? defaultCosmeticSlot(item.rows[0])
      if (!cosmeticSupportsSlot(item.rows[0], slot)) throw new Error('invalid_cosmetic_slot')
      await client.query(`INSERT INTO player_cosmetic_loadout (player_id, slot, item_id) VALUES ($1, $2, $3) ON CONFLICT (player_id, slot) DO UPDATE SET item_id = EXCLUDED.item_id, equipped_at = now()`, [playerId, slot, itemId])
    })
    return this.requiredProfile(playerId)
  }
  async report(reporterId: string, subjectId: string, category: string, sessionId?: string, turnId?: string) {
    const result = await this.pool.query<{ report_id: string }>(`INSERT INTO reports (reporter_id, subject_id, category, session_id, turn_id) VALUES ($1, $2, $3, $4, $5) RETURNING report_id`, [reporterId, subjectId, category, sessionId ?? null, turnId ?? null])
    return result.rows[0].report_id
  }

  async listReports(status: 'open' | 'reviewed' = 'open') {
    const result = await this.pool.query<{
      reportId: string
      reporterId: string
      subjectId: string
      category: string
      sessionId: string | null
      turnId: string | null
      status: 'open' | 'reviewed'
      reviewedAt: string | null
    }>(`SELECT report_id AS "reportId", reporter_id AS "reporterId", subject_id AS "subjectId", category, session_id AS "sessionId", turn_id AS "turnId", status, reviewed_at AS "reviewedAt" FROM reports WHERE status = $1 ORDER BY created_at DESC`, [status])
    return result.rows
  }

  async findReport(reportId: string) {
    const result = await this.pool.query<ReportRecord>(`SELECT report_id AS "reportId", reporter_id AS "reporterId", subject_id AS "subjectId", category, session_id AS "sessionId", turn_id AS "turnId", status, reviewed_at AS "reviewedAt" FROM reports WHERE report_id = $1`, [reportId])
    return result.rows[0] ?? null
  }

  async reviewReport(reportId: string, staffSubject: string, action: string, reason: string) {
    await this.inTransaction(async (client) => {
      const report = await client.query<{ subject_id: string }>('SELECT subject_id FROM reports WHERE report_id = $1 FOR UPDATE', [reportId])
      if (!report.rowCount) {
        throw new Error('report_not_found')
      }
    if (!['no_action', 'suspend_account', 'remove_content'].includes(action) || action.length > 128) {
        throw new Error('invalid_review_action')
      }
      if (!reason || reason.length > 1024) {
        throw new Error('invalid_review_reason')
      }
      await client.query(`INSERT INTO moderation_actions (report_id, staff_subject, action, reason) VALUES ($1, $2, $3, $4)`, [reportId, staffSubject, action, reason])
      if (action === 'suspend_account') await client.query(`UPDATE players SET status = 'suspended' WHERE player_id = $1`, [report.rows[0].subject_id])
      await client.query(`UPDATE reports SET status = 'reviewed', reviewed_at = now() WHERE report_id = $1`, [reportId])
    })
  }
  async block(blockerId: string, blockedId: string) { if (blockerId === blockedId) throw new Error('invalid_block'); await this.pool.query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [blockerId, blockedId]) }
  async unblock(blockerId: string, blockedId: string) { await this.pool.query(`DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]) }
  async areBlocked(firstId: string, secondId: string) { const result = await this.pool.query(`SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`, [firstId, secondId]); return (result.rowCount ?? 0) > 0 }
  async requestDeletion(playerId: string) { await this.pool.query(`UPDATE players SET status = 'deleted', display_name = 'Deleted player', deletion_requested_at = now() WHERE player_id = $1`, [playerId]) }
  async startSession(input: SessionStart) {
    await this.pool.query(`INSERT INTO sessions (session_id, player_a, player_b, entry_context, protocol_major, rules_version, content_version, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') ON CONFLICT (session_id) DO NOTHING`, [input.sessionId, input.playerA, input.playerB, input.entryContext, input.protocolMajor, input.rulesVersion, input.contentVersion])
  }
  async finishSession(sessionId: string, finalTeamScore: number, status: SessionStatus) {
    await this.inTransaction(async (client) => {
      const session = await client.query<{ player_a: string; player_b: string; rules_version: string }>(`UPDATE sessions SET status = $3, final_team_score = $2, ended_at = now() WHERE session_id = $1 AND ended_at IS NULL RETURNING player_a, player_b, rules_version`, [sessionId, finalTeamScore, status])
      if (status === 'completed' && session.rows[0]) {
        const ids = [session.rows[0].player_a, session.rows[0].player_b].sort()
        await client.query(`UPDATE duos SET completed_sessions = completed_sessions + 1, revision = revision + 1, updated_at = now() WHERE player_a = $1 AND player_b = $2 AND rules_version = $3`, [ids[0], ids[1], session.rows[0].rules_version])
      }
    })
  }
  async getDuoProgress(playerA: string, playerB: string, rulesVersion: string) { const ids = [playerA, playerB].sort(); const result = await this.pool.query<{ current_streak: number; best_streak: number }>(`SELECT current_streak, best_streak FROM duos WHERE player_a = $1 AND player_b = $2 AND rules_version = $3`, [ids[0], ids[1], rulesVersion]); return result.rows[0] ? { currentStreak: result.rows[0].current_streak, bestStreak: result.rows[0].best_streak } : { currentStreak: 0, bestStreak: 0 } }
  async commitTurn(input: TurnCommit) {
    return this.inTransaction(async (client) => {
      const existing = await client.query<TurnCommitResult>(`SELECT false AS duplicate, wallet_a AS "walletA", wallet_b AS "walletB", current_streak AS "currentStreak", best_streak AS "bestStreak" FROM turn_resolutions WHERE resolution_id = $1 OR turn_id = $2`, [input.resolutionId, input.turnId])
      if (existing.rows[0]) return { ...existing.rows[0], duplicate: true }
      if (input.sessionId && input.turnIndex !== undefined && input.drawer) {
        const inserted = await client.query(`INSERT INTO turns (session_id, turn_index, drawer, prompt_key, outcome, points, resolution_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (session_id, turn_index) DO NOTHING RETURNING turn_index`, [input.sessionId, input.turnIndex, input.drawer, input.promptKey ?? null, input.outcome, input.outcome === 'solved' ? input.difficulty : 0, input.resolutionId])
        if (!inserted.rowCount) throw new Error('turn_already_resolved')
      }
      const ids = [input.playerA, input.playerB].sort()
      await client.query(`SELECT player_id FROM wallets WHERE player_id = ANY($1::uuid[]) ORDER BY player_id FOR UPDATE`, [ids])
      const amount = input.outcome === 'solved' ? input.difficulty : 0
      if (amount) await client.query(`UPDATE wallets SET balance = balance + $2, lifetime_gameplay_coins = lifetime_gameplay_coins + $2, revision = revision + 1 WHERE player_id = $1 OR player_id = $3`, [input.playerA, amount, input.playerB])
      const duo = await client.query<{ current_streak: number; best_streak: number }>(`INSERT INTO duos (player_a, player_b, rules_version, current_streak, best_streak) VALUES ($1, $2, $3, $4, $4) ON CONFLICT (player_a, player_b, rules_version) DO UPDATE SET current_streak = CASE WHEN $5 = 'solved' THEN duos.current_streak + 1 WHEN $5 = 'annulled' THEN duos.current_streak ELSE 0 END, best_streak = GREATEST(duos.best_streak, CASE WHEN $5 = 'solved' THEN duos.current_streak + 1 ELSE duos.best_streak END), successful_turns = duos.successful_turns + CASE WHEN $5 = 'solved' THEN 1 ELSE 0 END, revision = duos.revision + 1, updated_at = now() RETURNING current_streak, best_streak`, [ids[0], ids[1], input.rulesVersion, input.outcome === 'solved' ? 1 : 0, input.outcome])
      const wallets = await client.query<{ player_id: string; balance: number }>(`SELECT player_id, balance FROM wallets WHERE player_id = ANY($1::uuid[])`, [ids])
      if (amount) {
        for (const wallet of wallets.rows) {
          await client.query(`INSERT INTO wallet_ledger (player_id, delta, reason, turn_id, idempotency_key, balance_after) VALUES ($1, $2, 'turn_reward', $3, $4, $5) ON CONFLICT (player_id, idempotency_key) DO NOTHING`, [wallet.player_id, amount, input.turnId, `${input.resolutionId}:${wallet.player_id}`, wallet.balance])
        }
      }
      const walletA = wallets.rows.find((row) => row.player_id === input.playerA)?.balance ?? 0
      const walletB = wallets.rows.find((row) => row.player_id === input.playerB)?.balance ?? 0
      const result = { duplicate: false, walletA, walletB, currentStreak: duo.rows[0].current_streak, bestStreak: duo.rows[0].best_streak }
      await client.query(`INSERT INTO turn_resolutions (resolution_id, turn_id, player_a, player_b, outcome, wallet_a, wallet_b, current_streak, best_streak) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [input.resolutionId, input.turnId, input.playerA, input.playerB, input.outcome, walletA, walletB, result.currentStreak, result.bestStreak])
      return result
    })
  }
  private async requiredProfile(playerId: string) { const profile = await this.getProfile(playerId); if (!profile) throw new Error('account_not_found'); return profile }
  private async inTransaction<T>(work: (client: PoolClient) => Promise<T>) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() } }
}

let store: AccountStore | undefined
export function getAccountStore(): AccountStore {
  if (store) return store
  if (process.env.DATABASE_URL) {
    store = new PostgresAccountStore(getDatabasePool())
  }
  else if (process.env.DRAW_DUO_TEST_MODE === '1' || process.env.NODE_ENV === 'development') store = new MemoryAccountStore()
  else throw new Error('database_required_outside_development')
  return store
}
