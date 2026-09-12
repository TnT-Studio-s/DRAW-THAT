import { getDatabasePool } from './Database.js'

interface PrivateInvite {
  roomId: string
  roomCode: string
  ownerPlayerId?: string
  expiresAt: number
}

const INVITE_LIFETIME_MS = 10 * 60 * 1000
const registryCode = new Map<string, PrivateInvite>()
const registryRoom = new Map<string, string>()

export function makeCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(Math.random() * chars.length)
    out += chars[idx]
  }
  return out
}

export async function registerPrivateRoom(roomId: string, ownerPlayerId?: string): Promise<{ roomCode: string }> {
  const roomCode = makeCode()
  const entry: PrivateInvite = {
    roomId,
    roomCode,
    ownerPlayerId,
    expiresAt: Date.now() + INVITE_LIFETIME_MS,
  }
  if (process.env.DATABASE_URL) {
    await getDatabasePool().query('INSERT INTO drawduo_room_invites (room_id, room_code, owner_player_id, expires_at) VALUES ($1, $2, $3, $4)', [roomId, roomCode, ownerPlayerId ?? null, new Date(entry.expiresAt)])
  }
  registryCode.set(roomCode, entry)
  registryRoom.set(roomId, roomCode)
  return { roomCode }
}

export async function getInviteOwner(code: string): Promise<string | null> {
  const cleaned = code.trim().toUpperCase()
  if (process.env.DATABASE_URL) {
    const result = await getDatabasePool().query<{ owner_player_id: string | null }>('SELECT owner_player_id FROM drawduo_room_invites WHERE room_code = $1 AND consumed_at IS NULL AND expires_at > now()', [cleaned])
    return result.rows[0]?.owner_player_id ?? null
  }
  return registryCode.get(cleaned)?.ownerPlayerId ?? null
}

export async function resolveCode(code: string): Promise<string | null> {
  const cleaned = code.trim().toUpperCase()
  if (process.env.DATABASE_URL) {
    const result = await getDatabasePool().query<{ room_id: string }>('SELECT room_id FROM drawduo_room_invites WHERE room_code = $1 AND consumed_at IS NULL AND expires_at > now()', [cleaned])
    return result.rows[0]?.room_id ?? null
  }
  const invite = registryCode.get(cleaned)
  if (!invite) return null
  if (Date.now() > invite.expiresAt) {
    registryCode.delete(cleaned)
    registryRoom.delete(invite.roomId)
    return null
  }
  return invite.roomId
}

export async function getCodeByRoom(roomId: string): Promise<string | null> {
  if (process.env.DATABASE_URL) {
    const result = await getDatabasePool().query<{ room_code: string }>('SELECT room_code FROM drawduo_room_invites WHERE room_id = $1 AND consumed_at IS NULL AND expires_at > now()', [roomId])
    return result.rows[0]?.room_code ?? null
  }
  return registryRoom.get(roomId) ?? null
}

export async function validateCodeForRoom(roomId: string, roomCode: string | undefined): Promise<boolean> {
  const cleaned = roomCode?.trim().toUpperCase()
  if (!cleaned) return false
  if (process.env.DATABASE_URL) {
    const result = await getDatabasePool().query('SELECT 1 FROM drawduo_room_invites WHERE room_id = $1 AND room_code = $2 AND consumed_at IS NULL AND expires_at > now()', [roomId, cleaned])
    return Boolean(result.rowCount)
  }
  return (await getCodeByRoom(roomId)) === cleaned
}

export async function releaseCode(roomCode: string) {
  const cleaned = roomCode.trim().toUpperCase()
  if (process.env.DATABASE_URL) {
    await getDatabasePool().query('UPDATE drawduo_room_invites SET consumed_at = now() WHERE room_code = $1', [cleaned])
  }
  const invite = registryCode.get(cleaned)
  registryCode.delete(cleaned)
  if (invite) registryRoom.delete(invite.roomId)
}
