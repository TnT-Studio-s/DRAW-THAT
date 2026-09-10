export interface DrawPoint {
  x: number
  y: number
  pressure?: number
}

export type DrawTool = 'draw' | 'erase'

export interface StrokeEvent {
  id: string
  generation: number
  actorSessionId: string
  tool: DrawTool
  color: string
  width: number
  points: DrawPoint[]
  timestamp: number
}

export interface CanvasLimits {
  batchPointsLimit: number
  maxPointsPerTurn: number
  maxStrokesPerTurn: number
  maxPayloadBytes: number
}

export const defaultLimits: CanvasLimits = {
  batchPointsLimit: 64,
  maxPointsPerTurn: 12000,
  maxStrokesPerTurn: 512,
  maxPayloadBytes: 16384,
}

const allowedBrushWidths = new Set([4, 8, 12])

export function clampCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(65535, Math.round(value)))
}

export function validateStrokeEvent(event: {
  id: string
  generation: number
  actorSessionId: string
  tool: DrawTool
  color: string
  width: number
  points: Array<{ x: number; y: number; pressure?: number }>
  timestamp: number
}): string | null {
  if (!event.id || typeof event.id !== 'string') return 'invalid stroke id'
  if (!Number.isInteger(event.generation) || event.generation < 0) return 'invalid generation'
  if (typeof event.actorSessionId !== 'string' || !event.actorSessionId) return 'invalid actor'
  if (!['draw', 'erase'].includes(event.tool)) return 'invalid tool'
  if (!allowedBrushWidths.has(event.width)) return 'invalid width'
  if (!Array.isArray(event.points) || event.points.length === 0) return 'no points'
  if (event.points.length > defaultLimits.batchPointsLimit) return 'too many points'
  if (!event.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return 'non-finite coordinates'
  if (event.color.length > 7) return 'invalid color'
  if (!Number.isFinite(event.timestamp) || event.timestamp < 0) return 'invalid timestamp'
  return null
}
