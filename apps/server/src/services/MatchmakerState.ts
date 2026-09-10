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

export function registerPrivateRoom(roomId: string, ownerPlayerId?: string): { roomCode: string } {
  const roomCode = makeCode()
  const entry: PrivateInvite = {
    roomId,
    roomCode,
    ownerPlayerId,
    expiresAt: Date.now() + INVITE_LIFETIME_MS,
  }
  registryCode.set(roomCode, entry)
  registryRoom.set(roomId, roomCode)
  return { roomCode }
}

export function getInviteOwner(code: string): string | null {
  const invite = registryCode.get(code.trim().toUpperCase())
  return invite?.ownerPlayerId ?? null
}

export function resolveCode(code: string): string | null {
  const cleaned = code.trim().toUpperCase()
  const invite = registryCode.get(cleaned)
  if (!invite) return null
  if (Date.now() > invite.expiresAt) {
    registryCode.delete(cleaned)
    registryRoom.delete(invite.roomId)
    return null
  }
  return invite.roomId
}

export function getCodeByRoom(roomId: string): string | null {
  return registryRoom.get(roomId) ?? null
}

export function releaseCode(roomCode: string) {
  const invite = registryCode.get(roomCode)
  registryCode.delete(roomCode)
  if (invite) {
    registryRoom.delete(invite.roomId)
  }
}
