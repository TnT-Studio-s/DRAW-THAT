import { Pool, type PoolClient } from 'pg'

export type AccountProfile = {
  playerId: string
  displayName: string
  status: 'active' | 'deleted' | 'suspended'
  termsVersion: string | null
  wallet: number
  lifetimeCoins: number
  duoStreakCurrent: number
  duoStreakBest: number
}

export type CatalogItem = { itemId: string; type: 'avatar_frame' | 'ui_theme' | 'profile_title' | 'celebration'; name: string; price: number; enabled: boolean }
export type PurchaseResult = { itemId: string; requestId: string; wallet: number; owned: boolean }
export type SessionStart = { sessionId: string; playerA: string; playerB: string; entryContext: string; protocolMajor: number; rulesVersion: string; contentVersion: string }
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
  report(reporterId: string, subjectId: string, category: string, sessionId?: string, turnId?: string): Promise<string>
  block(blockerId: string, blockedId: string): Promise<void>
  unblock(blockerId: string, blockedId: string): Promise<void>
  areBlocked(firstId: string, secondId: string): Promise<boolean>
  requestDeletion(playerId: string): Promise<void>
  startSession(input: SessionStart): Promise<void>
  finishSession(sessionId: string, finalTeamScore: number): Promise<void>
  commitTurn(input: TurnCommit): Promise<TurnCommitResult>
}

const catalog: CatalogItem[] = [
  { itemId: 'frame-sunrise', type: 'avatar_frame', name: 'Sunrise Frame', price: 20, enabled: true },
  { itemId: 'theme-paper', type: 'ui_theme', name: 'Paper Theme', price: 40, enabled: true },
  { itemId: 'title-sketcher', type: 'profile_title', name: 'Sketcher', price: 80, enabled: true },
]

type MemoryAccount = AccountProfile & { subject: string; owned: Set<string> }

export class MemoryAccountStore implements AccountStore {
  private readonly accounts = new Map<string, MemoryAccount>()
  private readonly subjects = new Map<string, string>()
  private readonly purchases = new Map<string, PurchaseResult>()
  private readonly resolutions = new Map<string, TurnCommitResult>()
  private readonly blocks = new Set<string>()
  private readonly reports = new Map<string, { reporterId: string; subjectId: string; category: string }>()
  private readonly sessions = new Map<string, SessionStart>()

  async ensurePlayer(subject: string, displayName?: string) {
    const existingId = this.subjects.get(subject)
    if (existingId) return this.accounts.get(existingId) as MemoryAccount
    const player: MemoryAccount = { playerId: `player_${subject}`, subject, displayName: displayName || `Player ${subject.slice(0, 6)}`, status: 'active', termsVersion: null, wallet: 0, lifetimeCoins: 0, duoStreakCurrent: 0, duoStreakBest: 0, owned: new Set() }
    this.subjects.set(subject, player.playerId)
    this.accounts.set(player.playerId, player)
    return player
  }

  async findPlayerIdBySubject(subject: string) { return this.subjects.get(subject) ?? null }
  async getProfile(playerId: string) { return this.accounts.get(playerId) ?? null }
  async updateProfile(playerId: string, displayName: string) { const account = this.required(playerId); account.displayName = displayName; return account }
  async acceptTerms(playerId: string, termsVersion: string) { const account = this.required(playerId); account.termsVersion = termsVersion; return account }
  async getCatalog() { return catalog }
  async purchase(playerId: string, itemId: string, requestId: string) {
    const previous = this.purchases.get(requestId)
    if (previous) return previous
    const account = this.required(playerId)
    const item = catalog.find((entry) => entry.itemId === itemId && entry.enabled)
    if (!item) throw new Error('catalog_item_not_found')
    if (account.owned.has(itemId)) return { itemId, requestId, wallet: account.wallet, owned: true }
    if (account.wallet < item.price) throw new Error('insufficient_balance')
    account.wallet -= item.price
    account.owned.add(itemId)
    const result = { itemId, requestId, wallet: account.wallet, owned: true }
    this.purchases.set(requestId, result)
    return result
  }
  async report(reporterId: string, subjectId: string, category: string) { const id = `report_${this.reports.size + 1}`; this.reports.set(id, { reporterId, subjectId, category }); return id }
  async block(blockerId: string, blockedId: string) { if (blockerId === blockedId) throw new Error('invalid_block'); this.blocks.add(`${blockerId}:${blockedId}`) }
  async unblock(blockerId: string, blockedId: string) { this.blocks.delete(`${blockerId}:${blockedId}`) }
  async areBlocked(firstId: string, secondId: string) { return this.blocks.has(`${firstId}:${secondId}`) || this.blocks.has(`${secondId}:${firstId}`) }
  async requestDeletion(playerId: string) { const account = this.required(playerId); account.status = 'deleted'; account.displayName = 'Deleted player' }
  async startSession(input: SessionStart) { this.sessions.set(input.sessionId, input) }
  async finishSession(_sessionId: string, _finalTeamScore: number) {}
  async commitTurn(input: TurnCommit) {
    const previous = this.resolutions.get(input.resolutionId)
    if (previous) return { ...previous, duplicate: true }
    const a = this.required(input.playerA)
    const b = this.required(input.playerB)
    const duo = [a.playerId, b.playerId].sort().join(':')
    const current = a.duoStreakCurrent
    const next = input.outcome === 'solved' ? current + 1 : input.outcome === 'annulled' ? current : 0
    const best = Math.max(a.duoStreakBest, next)
    if (input.outcome === 'solved') { a.wallet += input.difficulty; b.wallet += input.difficulty; a.lifetimeCoins += input.difficulty; b.lifetimeCoins += input.difficulty }
    a.duoStreakCurrent = next; b.duoStreakCurrent = next; a.duoStreakBest = best; b.duoStreakBest = best
    const result = { duplicate: false, walletA: a.wallet, walletB: b.wallet, currentStreak: next, bestStreak: best }
    this.resolutions.set(input.resolutionId, result)
    void duo
    return result
  }
  private required(playerId: string) { const account = this.accounts.get(playerId); if (!account) throw new Error('account_not_found'); return account }
}

class PostgresAccountStore implements AccountStore {
  constructor(private readonly pool: Pool) {}

  async ensurePlayer(subject: string, displayName?: string) {
    const result = await this.pool.query<AccountProfile & { auth_subject: string }>(`INSERT INTO players (auth_subject, display_name) VALUES ($1, $2) ON CONFLICT (auth_subject) DO UPDATE SET last_seen_at = now() RETURNING player_id AS "playerId", display_name AS "displayName", status, terms_version AS "termsVersion", 0 AS wallet, 0 AS "lifetimeCoins", 0 AS "duoStreakCurrent", 0 AS "duoStreakBest", auth_subject`, [subject, displayName || `Player ${subject.slice(0, 6)}`])
    await this.pool.query(`INSERT INTO wallets (player_id) VALUES ($1) ON CONFLICT DO NOTHING`, [result.rows[0].playerId])
    const profile = await this.getProfile(result.rows[0].playerId)
    if (!profile) throw new Error('account_not_found')
    return profile
  }
  async findPlayerIdBySubject(subject: string) {
    const result = await this.pool.query<{ player_id: string }>('SELECT player_id FROM players WHERE auth_subject = $1', [subject])
    return result.rows[0]?.player_id ?? null
  }
  async getProfile(playerId: string) {
    const result = await this.pool.query<AccountProfile>(`SELECT p.player_id AS "playerId", p.display_name AS "displayName", p.status, p.terms_version AS "termsVersion", w.balance AS wallet, w.lifetime_gameplay_coins AS "lifetimeCoins", COALESCE(d.current_streak, 0) AS "duoStreakCurrent", COALESCE(d.best_streak, 0) AS "duoStreakBest" FROM players p JOIN wallets w ON w.player_id = p.player_id LEFT JOIN LATERAL (SELECT current_streak, best_streak FROM duos WHERE player_a = p.player_id OR player_b = p.player_id ORDER BY updated_at DESC LIMIT 1) d ON true WHERE p.player_id = $1`, [playerId])
    return result.rows[0] ?? null
  }
  async updateProfile(playerId: string, displayName: string) { const result = await this.pool.query(`UPDATE players SET display_name = $2 WHERE player_id = $1 AND status = 'active' RETURNING player_id`, [playerId, displayName]); if (!result.rowCount) throw new Error('account_not_found'); return this.requiredProfile(playerId) }
  async acceptTerms(playerId: string, termsVersion: string) { const result = await this.pool.query(`UPDATE players SET terms_version = $2 WHERE player_id = $1 RETURNING player_id`, [playerId, termsVersion]); if (!result.rowCount) throw new Error('account_not_found'); return this.requiredProfile(playerId) }
  async getCatalog() { const result = await this.pool.query<CatalogItem>(`SELECT item_id AS "itemId", type, name, price, enabled FROM cosmetic_catalog WHERE enabled = true ORDER BY price, item_id`); return result.rows }
  async purchase(playerId: string, itemId: string, requestId: string) {
    return this.inTransaction(async (client) => {
      const previous = await client.query<PurchaseResult>(`SELECT item_id AS "itemId", idempotency_key AS "requestId", balance_after AS wallet, true AS owned FROM wallet_ledger WHERE idempotency_key = $1`, [requestId])
      if (previous.rows[0]) return previous.rows[0]
      const item = await client.query<CatalogItem>(`SELECT item_id AS "itemId", type, name, price, enabled FROM cosmetic_catalog WHERE item_id = $1 AND enabled = true`, [itemId])
      if (!item.rows[0]) throw new Error('catalog_item_not_found')
      const wallet = await client.query<{ balance: number }>(`SELECT balance FROM wallets WHERE player_id = $1 FOR UPDATE`, [playerId])
      if (!wallet.rows[0]) throw new Error('account_not_found')
      if (wallet.rows[0].balance < item.rows[0].price) throw new Error('insufficient_balance')
      const balance = wallet.rows[0].balance - item.rows[0].price
      await client.query(`UPDATE wallets SET balance = $2, revision = revision + 1 WHERE player_id = $1`, [playerId, balance])
      await client.query(`INSERT INTO wallet_ledger (player_id, delta, reason, item_id, idempotency_key, balance_after) VALUES ($1, $2, 'cosmetic_purchase', $3, $4, $5)`, [playerId, -item.rows[0].price, itemId, requestId, balance])
      await client.query(`INSERT INTO player_cosmetics (player_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [playerId, itemId])
      return { itemId, requestId, wallet: balance, owned: true }
    })
  }
  async report(reporterId: string, subjectId: string, category: string, sessionId?: string, turnId?: string) { const result = await this.pool.query<{ report_id: string }>(`INSERT INTO reports (reporter_id, subject_id, category, session_id, turn_id) VALUES ($1, $2, $3, $4, $5) RETURNING report_id`, [reporterId, subjectId, category, sessionId ?? null, turnId ?? null]); return result.rows[0].report_id }
  async block(blockerId: string, blockedId: string) { if (blockerId === blockedId) throw new Error('invalid_block'); await this.pool.query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [blockerId, blockedId]) }
  async unblock(blockerId: string, blockedId: string) { await this.pool.query(`DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]) }
  async areBlocked(firstId: string, secondId: string) { const result = await this.pool.query(`SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`, [firstId, secondId]); return (result.rowCount ?? 0) > 0 }
  async requestDeletion(playerId: string) { await this.pool.query(`UPDATE players SET status = 'deleted', display_name = 'Deleted player', deletion_requested_at = now() WHERE player_id = $1`, [playerId]) }
  async startSession(input: SessionStart) {
    await this.pool.query(`INSERT INTO sessions (session_id, player_a, player_b, entry_context, protocol_major, rules_version, content_version, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') ON CONFLICT (session_id) DO NOTHING`, [input.sessionId, input.playerA, input.playerB, input.entryContext, input.protocolMajor, input.rulesVersion, input.contentVersion])
  }
  async finishSession(sessionId: string, finalTeamScore: number) {
    await this.pool.query(`UPDATE sessions SET status = 'completed', final_team_score = $2, ended_at = COALESCE(ended_at, now()) WHERE session_id = $1`, [sessionId, finalTeamScore])
  }
  async commitTurn(input: TurnCommit) {
    return this.inTransaction(async (client) => {
      const existing = await client.query<TurnCommitResult>(`SELECT false AS duplicate, wallet_a AS "walletA", wallet_b AS "walletB", current_streak AS "currentStreak", best_streak AS "bestStreak" FROM turn_resolutions WHERE resolution_id = $1`, [input.resolutionId])
      if (existing.rows[0]) return { ...existing.rows[0], duplicate: true }
      if (input.sessionId && input.turnIndex !== undefined && input.drawer) {
        await client.query(`INSERT INTO turns (session_id, turn_index, drawer, prompt_key, outcome, points, resolution_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (session_id, turn_index) DO UPDATE SET outcome = EXCLUDED.outcome, points = EXCLUDED.points, resolution_id = EXCLUDED.resolution_id`, [input.sessionId, input.turnIndex, input.drawer, input.promptKey ?? null, input.outcome, input.outcome === 'solved' ? input.difficulty : 0, input.resolutionId])
      }
      const ids = [input.playerA, input.playerB].sort()
      await client.query(`SELECT player_id FROM wallets WHERE player_id = ANY($1::uuid[]) ORDER BY player_id FOR UPDATE`, [ids])
      const amount = input.outcome === 'solved' ? input.difficulty : 0
      if (amount) await client.query(`UPDATE wallets SET balance = balance + $2, lifetime_gameplay_coins = lifetime_gameplay_coins + $2, revision = revision + 1 WHERE player_id = $1 OR player_id = $3`, [input.playerA, amount, input.playerB])
      const duo = await client.query<{ current_streak: number; best_streak: number }>(`INSERT INTO duos (player_a, player_b, rules_version, current_streak, best_streak) VALUES ($1, $2, $3, $4, $4) ON CONFLICT (player_a, player_b, rules_version) DO UPDATE SET current_streak = CASE WHEN $5 = 'solved' THEN duos.current_streak + 1 WHEN $5 = 'annulled' THEN duos.current_streak ELSE 0 END, best_streak = GREATEST(duos.best_streak, CASE WHEN $5 = 'solved' THEN duos.current_streak + 1 ELSE duos.best_streak END), successful_turns = duos.successful_turns + CASE WHEN $5 = 'solved' THEN 1 ELSE 0 END, updated_at = now() RETURNING current_streak, best_streak`, [ids[0], ids[1], input.rulesVersion, input.outcome === 'solved' ? 1 : 0, input.outcome])
      const wallets = await client.query<{ player_id: string; balance: number }>(`SELECT player_id, balance FROM wallets WHERE player_id = ANY($1::uuid[])`, [ids])
      if (amount) {
        for (const wallet of wallets.rows) {
          await client.query(`INSERT INTO wallet_ledger (player_id, delta, reason, turn_id, idempotency_key, balance_after) VALUES ($1, $2, 'turn_reward', $3, $4, $5) ON CONFLICT (idempotency_key) DO NOTHING`, [wallet.player_id, amount, input.turnId, `${input.resolutionId}:${wallet.player_id}`, wallet.balance])
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
  if (process.env.DATABASE_URL) store = new PostgresAccountStore(new Pool({ connectionString: process.env.DATABASE_URL }))
  else if (process.env.DRAW_DUO_TEST_MODE === '1' || process.env.NODE_ENV === 'development') store = new MemoryAccountStore()
  else throw new Error('database_required_outside_development')
  return store
}
