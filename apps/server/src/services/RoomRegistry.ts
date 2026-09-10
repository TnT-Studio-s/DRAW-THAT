import type { DrawDuoRoom } from '../rooms/DrawDuoRoom.js'

const rooms = new Map<string, DrawDuoRoom>()

export function registerRoom(roomId: string, room: DrawDuoRoom) {
  rooms.set(roomId, room)
}

export function unregisterRoom(roomId: string) {
  rooms.delete(roomId)
}

export function getRoom(roomId: string): DrawDuoRoom | undefined {
  return rooms.get(roomId)
}
