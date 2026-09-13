import { Client } from 'pg'
import type { IRoomListingData, MatchMakerDriver, Presence, QueryHelpers, RoomListingData, SortOptions } from '@colyseus/core'
import { getDatabasePool } from './Database.js'

type Listing = IRoomListingData & { createdAt: Date | string }
type Callback = (...args: any[]) => any

const MESSAGE_CHANNEL = 'drawduo_presence'

class PostgresRoomData implements RoomListingData {
  clients = 0
  locked = false
  private = false
  maxClients = Infinity
  metadata: any
  name = ''
  publicAddress?: string
  processId = ''
  roomId = ''
  createdAt: Date | string = new Date()
  unlisted = false

  private removed = false

  constructor(private readonly pool: ReturnType<typeof getDatabasePool>, initialValues: Partial<Listing> = {}) {
    Object.assign(this, initialValues)
  }

  toJSON(): Listing {
    return {
      clients: this.clients,
      locked: this.locked,
      private: this.private,
      maxClients: this.maxClients,
      metadata: this.metadata,
      name: this.name,
      publicAddress: this.publicAddress,
      processId: this.processId,
      roomId: this.roomId,
      createdAt: this.createdAt,
      unlisted: this.unlisted,
    }
  }

  async save() {
    if (this.removed || !this.roomId) return
    await this.pool.query(`INSERT INTO drawduo_room_listings (room_id, listing) VALUES ($1, $2::jsonb) ON CONFLICT (room_id) DO UPDATE SET listing = EXCLUDED.listing`, [this.roomId, JSON.stringify(this.toJSON())])
  }

  async updateOne(operations: { $set?: Record<string, unknown>; $inc?: Record<string, number> }) {
    if (this.removed || !this.roomId) return
    const set = operations.$set ?? {}
    const clientsDelta = operations.$inc?.clients ?? 0
    Object.assign(this, set)
    for (const [field, delta] of Object.entries(operations.$inc ?? {})) {
      if (field !== 'clients' && typeof this[field as keyof PostgresRoomData] === 'number') {
        ;(this[field as keyof PostgresRoomData] as number) += delta
      }
    }
    if (clientsDelta) {
      await this.pool.query(`UPDATE drawduo_room_listings SET listing = jsonb_set(listing || $2::jsonb, '{clients}', to_jsonb(COALESCE((listing->>'clients')::integer, 0) + $3::integer), true) WHERE room_id = $1`, [this.roomId, JSON.stringify(set), clientsDelta])
      return
    }
    await this.save()
  }

  async remove() {
    if (this.removed || !this.roomId) return
    this.removed = true
    await this.pool.query('DELETE FROM drawduo_room_listings WHERE room_id = $1', [this.roomId])
  }
}

function matches(listing: Listing, conditions: Partial<IRoomListingData>) {
  return Object.entries(conditions).every(([key, value]) => listing[key] === value)
}

class PostgresRoomQuery implements QueryHelpers<RoomListingData> {
  private sortOptions: SortOptions | undefined

  constructor(private readonly driver: PostgresDriver, private readonly conditions: Partial<IRoomListingData>) {}

  sort(options: SortOptions) {
    this.sortOptions = options
    return this
  }

  then(resolve: (value: RoomListingData | undefined) => any, reject?: (reason: unknown) => any) {
    return this.driver.find(this.conditions, this.sortOptions).then((rooms) => resolve(rooms[0])).catch(reject)
  }
}

export class PostgresDriver implements MatchMakerDriver {
  private readonly pool = getDatabasePool()

  createInstance(initialValues: Partial<IRoomListingData>) {
    return new PostgresRoomData(this.pool, initialValues)
  }

  async has(roomId: string) {
    const result = await this.pool.query('SELECT 1 FROM drawduo_room_listings WHERE room_id = $1', [roomId])
    return Boolean(result.rowCount)
  }

  async find(conditions: Partial<IRoomListingData>, sortOptions?: SortOptions) {
    const result = await this.pool.query<{ listing: Listing }>('SELECT listing FROM drawduo_room_listings')
    const rooms = result.rows.map(({ listing }) => new PostgresRoomData(this.pool, listing)).filter((listing) => matches(listing.toJSON(), conditions))
    if (sortOptions) {
      rooms.sort((first, second) => {
        for (const [field, direction] of Object.entries(sortOptions)) {
          const multiplier = direction === 1 || direction === 'asc' || direction === 'ascending' ? 1 : -1
          if (first[field as keyof PostgresRoomData] === second[field as keyof PostgresRoomData]) continue
          return (first[field as keyof PostgresRoomData] > second[field as keyof PostgresRoomData] ? 1 : -1) * multiplier
        }
        return 0
      })
    }
    return rooms
  }

  async cleanup(processId: string) {
    await this.pool.query(`DELETE FROM drawduo_room_listings WHERE listing->>'processId' = $1`, [processId])
  }

  findOne(conditions: Partial<IRoomListingData>) {
    return new PostgresRoomQuery(this, conditions)
  }

  clear() {
    void this.pool.query('DELETE FROM drawduo_room_listings')
  }

  shutdown() {}
}

export class PostgresPresence implements Presence {
  private readonly pool = getDatabasePool()
  private readonly subscriptions = new Map<string, Set<Callback>>()
  private cursor = '0'
  private draining: Promise<void> | undefined
  private readonly pollTimer: ReturnType<typeof setInterval>
  private listener: Client | undefined
  private listenerStarting: Promise<void> | undefined
  private lastCleanup = 0

  constructor() {
    this.pollTimer = setInterval(() => { void this.drainMessages() }, 250)
    this.pollTimer.unref?.()
    void this.startListener()
  }

  subscribe(topic: string, callback: Callback) {
    const callbacks = this.subscriptions.get(topic) ?? new Set<Callback>()
    callbacks.add(callback)
    this.subscriptions.set(topic, callbacks)
    void this.startListener()
    void this.drainMessages()
    return this
  }

  unsubscribe(topic: string, callback?: Callback) {
    const callbacks = this.subscriptions.get(topic)
    if (!callbacks) return this
    if (callback) callbacks.delete(callback)
    else callbacks.clear()
    if (!callbacks.size) this.subscriptions.delete(topic)
    return this
  }

  async publish(topic: string, data: any = false) {
    const result = await this.pool.query<{ id: string }>('INSERT INTO drawduo_presence_messages (topic, payload) VALUES ($1, $2::jsonb) RETURNING id', [topic, JSON.stringify(data)])
    await this.pool.query('SELECT pg_notify($1, $2)', [MESSAGE_CHANNEL, result.rows[0].id])
  }

  async exists(key: string) {
    return this.subscriptions.has(key)
  }

  async set(key: string, value: string) {
    await this.pool.query(`INSERT INTO drawduo_presence_kv (key, value, expires_at) VALUES ($1, $2, NULL) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL`, [key, value])
  }

  async setex(key: string, value: string, seconds: number) {
    await this.pool.query(`INSERT INTO drawduo_presence_kv (key, value, expires_at) VALUES ($1, $2, now() + ($3::integer * interval '1 second')) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`, [key, value, seconds])
  }

  async get(key: string) {
    const result = await this.pool.query<{ value: string }>('SELECT value FROM drawduo_presence_kv WHERE key = $1 AND (expires_at IS NULL OR expires_at > now())', [key])
    return result.rows[0]?.value ?? null
  }

  async del(key: string) {
    await Promise.all([
      this.pool.query('DELETE FROM drawduo_presence_kv WHERE key = $1', [key]),
      this.pool.query('DELETE FROM drawduo_presence_sets WHERE key = $1', [key]),
      this.pool.query('DELETE FROM drawduo_presence_hashes WHERE key = $1', [key]),
    ])
  }

  async sadd(key: string, value: any) {
    await this.pool.query('INSERT INTO drawduo_presence_sets (key, member) VALUES ($1, $2) ON CONFLICT DO NOTHING', [key, String(value)])
  }

  async smembers(key: string) {
    const result = await this.pool.query<{ member: string }>('SELECT member FROM drawduo_presence_sets WHERE key = $1', [key])
    return result.rows.map((row) => row.member)
  }

  async sismember(key: string, field: string) {
    const result = await this.pool.query('SELECT 1 FROM drawduo_presence_sets WHERE key = $1 AND member = $2', [key, field])
    return result.rowCount ? 1 : 0
  }

  async srem(key: string, value: any) {
    await this.pool.query('DELETE FROM drawduo_presence_sets WHERE key = $1 AND member = $2', [key, String(value)])
  }

  async scard(key: string) {
    const result = await this.pool.query<{ count: string }>('SELECT count(*)::text AS count FROM drawduo_presence_sets WHERE key = $1', [key])
    return Number(result.rows[0]?.count ?? 0)
  }

  async sinter(...keys: string[]) {
    if (!keys.length) return []
    const result = await this.pool.query<{ member: string }>('SELECT member FROM drawduo_presence_sets WHERE key = ANY($1::text[]) GROUP BY member HAVING count(DISTINCT key) = $2', [keys, keys.length])
    return result.rows.map((row) => row.member)
  }

  async hset(key: string, field: string, value: string) {
    await this.pool.query(`INSERT INTO drawduo_presence_hashes (key, field, value) VALUES ($1, $2, $3) ON CONFLICT (key, field) DO UPDATE SET value = EXCLUDED.value`, [key, field, value])
  }

  async hincrby(key: string, field: string, value: number) {
    const result = await this.pool.query<{ value: string }>(`INSERT INTO drawduo_presence_hashes (key, field, value) VALUES ($1, $2, $3::bigint) ON CONFLICT (key, field) DO UPDATE SET value = (drawduo_presence_hashes.value::bigint + $3::bigint)::text RETURNING value`, [key, field, value])
    return Number(result.rows[0].value)
  }

  async hget(key: string, field: string) {
    const result = await this.pool.query<{ value: string }>('SELECT value FROM drawduo_presence_hashes WHERE key = $1 AND field = $2', [key, field])
    return result.rows[0]?.value ?? null
  }

  async hgetall(key: string) {
    const result = await this.pool.query<{ field: string; value: string }>('SELECT field, value FROM drawduo_presence_hashes WHERE key = $1', [key])
    return Object.fromEntries(result.rows.map((row) => [row.field, row.value]))
  }

  async hdel(key: string, field: string) {
    const result = await this.pool.query('DELETE FROM drawduo_presence_hashes WHERE key = $1 AND field = $2', [key, field])
    return Boolean(result.rowCount)
  }

  async hlen(key: string) {
    const result = await this.pool.query<{ count: string }>('SELECT count(*)::text AS count FROM drawduo_presence_hashes WHERE key = $1', [key])
    return Number(result.rows[0]?.count ?? 0)
  }

  async incr(key: string) {
    return this.changeCounter(key, 1)
  }

  async decr(key: string) {
    return this.changeCounter(key, -1)
  }

  shutdown() {
    clearInterval(this.pollTimer)
    void this.listener?.end()
  }

  private async changeCounter(key: string, delta: number) {
    const result = await this.pool.query<{ value: string }>(`INSERT INTO drawduo_presence_kv (key, value, expires_at) VALUES ($1, $2::text, NULL) ON CONFLICT (key) DO UPDATE SET value = (drawduo_presence_kv.value::bigint + $2::bigint)::text RETURNING value`, [key, delta])
    return Number(result.rows[0].value)
  }

  private async startListener() {
    if (this.listener || this.listenerStarting || !process.env.DATABASE_URL_UNPOOLED) return
    this.listenerStarting = (async () => {
      const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED })
      client.on('notification', () => { void this.drainMessages() })
      client.on('error', () => { if (this.listener === client) this.listener = undefined })
      try {
        await client.connect()
        await client.query(`LISTEN ${MESSAGE_CHANNEL}`)
        this.listener = client
      } catch {
        await client.end().catch(() => undefined)
      }
    })().finally(() => { this.listenerStarting = undefined })
    await this.listenerStarting
  }

  private drainMessages() {
    if (this.draining) return this.draining
    this.draining = this.readMessages().finally(() => { this.draining = undefined })
    return this.draining
  }

  private async readMessages() {
    while (true) {
      const result = await this.pool.query<{ id: string; topic: string; payload: unknown }>('SELECT id::text AS id, topic, payload FROM drawduo_presence_messages WHERE id > $1::bigint ORDER BY id LIMIT 500', [this.cursor])
      if (!result.rows.length) break
      for (const row of result.rows) {
        this.cursor = row.id
        const callbacks = [...(this.subscriptions.get(row.topic) ?? [])]
        for (const callback of callbacks) {
          try { await callback(row.payload) } catch { /* one subscriber must not stop IPC */ }
        }
      }
      if (result.rows.length < 500) break
    }
    if (Date.now() - this.lastCleanup > 60_000) {
      this.lastCleanup = Date.now()
      await this.pool.query(`DELETE FROM drawduo_presence_messages WHERE created_at < now() - interval '10 minutes'`)
    }
  }
}
