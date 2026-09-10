interface QuickReservation {
  roomId: string
  userId: string
  expiresAt: number
}

const RESERVATION_MS = 30_000
let openReservation: QuickReservation | null = null

export function setQuickRoom(roomId: string, userId: string) {
  openReservation = { roomId, userId, expiresAt: Date.now() + RESERVATION_MS }
}

export type QuickClaim = { roomId: string; userId: string; sameUser: boolean }

export function claimQuickRoom(userId: string): QuickClaim | null {
  if (!openReservation || openReservation.expiresAt <= Date.now()) {
    openReservation = null
    return null
  }
  const claim = { roomId: openReservation.roomId, userId: openReservation.userId, sameUser: openReservation.userId === userId }
  if (claim.sameUser) return claim
  const roomId = claim.roomId
  openReservation = null
  return claim
}

export function releaseQuickRoom(roomId: string) {
  if (openReservation?.roomId === roomId) openReservation = null
}
