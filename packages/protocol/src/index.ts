import { z } from 'zod'

export type Difficulty = 1 | 2 | 3
export type Role = 'drawer' | 'guesser'
export type TurnPhase = 'WAITING' | 'READY_CHECK' | 'SELECTING' | 'COUNTDOWN' | 'DRAWING' | 'RESOLVING' | 'REVEAL' | 'RESULTS' | 'ABORTED' | 'CLOSED'
export type TurnOutcome = 'solved' | 'timeout' | 'passed' | 'abandoned' | 'annulled'
export type PlatformId = 'web-dev' | 'windows' | 'android' | 'ios'
export type DrawTool = 'draw' | 'erase'
export type CosmeticType = 'draw_color' | 'brush_size' | 'name_font' | 'nameplate_border'
export type CosmeticEquipSlot = CosmeticType | 'name_color'

export interface CosmeticCatalogItem {
  itemId: string
  type: CosmeticType
  name: string
  price: number
  value: string
  enabled: boolean
}

export const COSMETIC_CATALOG: readonly CosmeticCatalogItem[] = [
  { itemId: 'color-red', type: 'draw_color', name: 'Rocket Red', price: 0, value: '#c62828', enabled: true },
  { itemId: 'color-green', type: 'draw_color', name: 'Go Green', price: 0, value: '#2e7d32', enabled: true },
  { itemId: 'color-blue', type: 'draw_color', name: 'Doodle Blue', price: 0, value: '#1a73ff', enabled: true },
  { itemId: 'color-orange', type: 'draw_color', name: 'Juicy Orange', price: 12, value: '#f57c00', enabled: true },
  { itemId: 'color-brown', type: 'draw_color', name: 'Cocoa Brown', price: 14, value: '#795548', enabled: true },
  { itemId: 'color-purple', type: 'draw_color', name: 'Pop Purple', price: 16, value: '#6a1b9a', enabled: true },
  { itemId: 'color-teal', type: 'draw_color', name: 'Splash Teal', price: 18, value: '#00838f', enabled: true },
  { itemId: 'color-pink', type: 'draw_color', name: 'Bubblegum Pink', price: 20, value: '#ec407a', enabled: true },
  { itemId: 'color-yellow', type: 'draw_color', name: 'Sunny Yellow', price: 20, value: '#fbc02d', enabled: true },
  { itemId: 'color-black', type: 'draw_color', name: 'Ink Black', price: 22, value: '#111111', enabled: true },
  { itemId: 'brush-medium', type: 'brush_size', name: 'Medium Brush', price: 0, value: '12', enabled: true },
  { itemId: 'brush-very-small', type: 'brush_size', name: 'Very Small Brush', price: 10, value: '3', enabled: true },
  { itemId: 'brush-small', type: 'brush_size', name: 'Small Brush', price: 12, value: '6', enabled: true },
  { itemId: 'brush-large', type: 'brush_size', name: 'Large Brush', price: 18, value: '20', enabled: true },
  { itemId: 'brush-extra-large', type: 'brush_size', name: 'Extra Large Brush', price: 24, value: '32', enabled: true },
  { itemId: 'font-plain', type: 'name_font', name: 'Classic Name', price: 0, value: 'plain', enabled: true },
  { itemId: 'font-bubble', type: 'name_font', name: 'Bubble Pop', price: 24, value: 'bubble', enabled: true },
  { itemId: 'font-comic', type: 'name_font', name: 'Comic Bounce', price: 30, value: 'comic', enabled: true },
  { itemId: 'font-marker', type: 'name_font', name: 'Sketch Marker', price: 36, value: 'marker', enabled: true },
  { itemId: 'border-plain', type: 'nameplate_border', name: 'Plain Nameplate', price: 0, value: 'plain', enabled: true },
  { itemId: 'border-sunshine', type: 'nameplate_border', name: 'Sunshine Frame', price: 20, value: 'sunshine', enabled: true },
  { itemId: 'border-candy', type: 'nameplate_border', name: 'Candy Stripe', price: 28, value: 'candy', enabled: true },
  { itemId: 'border-neon', type: 'nameplate_border', name: 'Electric Glow', price: 38, value: 'neon', enabled: true },
]

export const STARTER_COSMETIC_IDS = ['color-red', 'color-green', 'color-blue', 'brush-medium', 'font-plain', 'border-plain'] as const

export function cosmeticById(itemId: string | null | undefined) {
  return COSMETIC_CATALOG.find((item) => item.itemId === itemId)
}

export function defaultCosmeticSlot(item: CosmeticCatalogItem): CosmeticEquipSlot {
  return item.type
}

export function cosmeticSupportsSlot(item: CosmeticCatalogItem, slot: CosmeticEquipSlot) {
  return item.type === slot || item.type === 'draw_color' && slot === 'name_color'
}

export const PROTOCOL_MAJOR = 1
export const CLIENT_BUILD_ID = 'draw-duo-phase-2'
export const RULES_VERSION = 'casual-en-v1'
export const MIN_SUPPORTED_BUILD_ID = 'draw-duo-phase-2'

export interface ClientHello {
  userId: string
  roomCode?: string
  buildId: string
  protocolMajor: number
  language: 'en'
  platformId: PlatformId
  capabilities: string[]
}

export interface ConnectionScope {
  sessionId: string
  turnId: string
  actionId: string
  connectionEpoch: number
}

export interface WordChoice {
  id: string
  difficulty: Difficulty
}

export interface TileSchema {
  id: string
  letter: string
  used: boolean
}

export interface TurnPublicState {
  turnId: string
  turnIndex: number
  phase: TurnPhase
  drawerSessionId: string
  selectedDifficulty: Difficulty | null
  selectedPromptLength: number
  slotPattern: number[]
  slotCount: number
  remainingMs: number
  revealedAnswer: string | null
  outcome: TurnOutcome | null
  resolutionId: string | null
  boardGeneration: number
  board: TileSchema[]
}

export interface PlayerPublicState {
  sessionId: string
  userId: string
  role: Role
  wallet: number | null
  connected: boolean
  ready: boolean
  rematch: boolean
  displayName?: string
  appearance?: Partial<Record<CosmeticEquipSlot, string>>
}

export interface SessionPublicState {
  roomCode: string | null
  phase: TurnPhase
  sessionId: string
  turnsPerSession: number
  turnIndex: number
  teamScore: number
  solvedTurns: number
  sessionCoinsPerPlayer: number
  duoStreakCurrent: number
  duoStreakBest: number
  playerStates: PlayerPublicState[]
  activeTurn: TurnPublicState | null
  rematchDeadline: number | null
  startedAt: number
  version: string
}

export interface ServerMessagePrivateChoices {
  type: 'privateChoices'
  turnId: string
  choices: Array<{
    id: string
    difficulty: Difficulty
    promptHint: string
  }>
}

export interface ServerMessagePrivatePrompt {
  type: 'privatePrompt'
  turnId: string
  answer: string
}

export interface ServerMessageDrawBank {
  type: 'drawBank'
  turnId: string
  board: TileSchema[]
  slotPattern: number[]
  slotCount: number
}

export interface ServerMessageDrawEvent {
  type: 'drawEvent'
  turnId: string
  generation: number
  actorSessionId: string
  actionId?: string
  kind: 'stroke' | 'undo' | 'clear'
  tool?: DrawTool
  color?: string
  width?: number
  points?: Array<{ x: number; y: number; pressure?: number }>
  sequence?: number
}

export interface CanvasStrokeSnapshot {
  actionId: string
  generation: number
  tool: DrawTool
  color: string
  width: number
  points: Array<{ x: number; y: number; pressure?: number }>
}

export interface ServerMessageDrawSnapshot {
  type: 'drawSnapshot'
  turnId: string
  generation: number
  sequence: number
  strokes: CanvasStrokeSnapshot[]
}

export interface ServerMessageGuess {
  type: 'guess'
  turnId: string
  correct: boolean
}

export interface ServerMessageTurnResolved {
  type: 'turnResolved'
  turnId: string
  outcome: TurnOutcome
  selectedDifficulty: Difficulty
  revealedAnswer: string
  teamPointsAwarded: 0 | Difficulty
  coinsAwardedPerPlayer: 0 | Difficulty
  currentDuoStreak: number
  bestDuoStreak: number
}

export interface ServerMessageState {
  type: 'sessionState'
  state: SessionPublicState
}

export interface ServerMessageError {
  type: 'error'
  code: string
  message: string
}

export type ServerMessage =
  | ServerMessagePrivateChoices
  | ServerMessagePrivatePrompt
  | ServerMessageDrawBank
  | ServerMessageDrawEvent
  | ServerMessageDrawSnapshot
  | ServerMessageGuess
  | ServerMessageTurnResolved
  | ServerMessageState
  | ServerMessageError

export const zDifficulty = z.union([z.literal(1), z.literal(2), z.literal(3)])

const zActionId = z.string().min(1).max(128)
const zTurnId = z.string().min(1).max(128)
const zChoiceId = z.string().min(1).max(128)
const zConnectionEpoch = z.number().int().nonnegative()
const zGeneration = z.number().int().nonnegative()
const zFiniteNumber = z.number().finite()

export const zClientHello = z.object({
  userId: z.string().min(1).max(128),
  roomCode: z.string().max(16).optional(),
  buildId: z.string().min(1).max(64),
  protocolMajor: z.number().int().positive(),
  language: z.literal('en'),
  platformId: z.union([z.literal('web-dev'), z.literal('windows'), z.literal('android'), z.literal('ios')]),
  capabilities: z.array(z.string().max(64)).max(32),
})

export const zConnectionScope = z.object({
  sessionId: z.string().min(1).max(128),
  turnId: zTurnId,
  actionId: zActionId,
  connectionEpoch: zConnectionEpoch,
})

export const zWordChoice = z.object({
  id: z.string(),
  difficulty: zDifficulty,
})

export const zReadyMessage = z.object({ type: z.literal('ready') })
export const zSelectChoiceMessage = z.object({
  type: z.literal('selectChoice'),
  turnId: zTurnId,
  choiceId: zChoiceId,
  actionId: zActionId,
})
export const zStrokeMessage = z.object({
  type: z.literal('stroke'),
  turnId: zTurnId,
  actionId: zActionId,
  connectionEpoch: zConnectionEpoch,
  generation: zGeneration,
  tool: z.enum(['draw', 'erase']),
  width: zFiniteNumber,
  color: z.string().min(1).max(7),
  points: z
    .array(z.object({ x: zFiniteNumber, y: zFiniteNumber, pressure: zFiniteNumber.optional() }))
    .min(1)
    .max(64),
  timestamp: zFiniteNumber,
})
export const zUndoMessage = z.object({
  type: z.literal('undo'),
  turnId: zTurnId,
  actionId: zActionId,
  connectionEpoch: zConnectionEpoch,
  generation: zGeneration,
})
export const zClearMessage = z.object({
  type: z.literal('clearCanvas'),
  turnId: zTurnId,
  actionId: zActionId,
  connectionEpoch: zConnectionEpoch,
  generation: zGeneration,
})
export const zGuessMessage = z.object({
  type: z.literal('guess'),
  turnId: zTurnId,
  actionId: zActionId,
  connectionEpoch: zConnectionEpoch,
  selectedTileIds: z.array(z.string().min(1).max(64)).min(1).max(32),
  timestamp: zFiniteNumber,
})
export const zPassMessage = z.object({
  type: z.literal('pass'),
  turnId: zTurnId,
  actionId: zActionId,
  connectionEpoch: zConnectionEpoch,
  timestamp: zFiniteNumber,
})
export const zRematchMessage = z.object({
  type: z.literal('rematch'),
})
export const zRefreshProfileMessage = z.object({
  type: z.literal('refreshProfile'),
})

export const zClientMessage = z.discriminatedUnion('type', [
  zReadyMessage,
  zSelectChoiceMessage,
  zStrokeMessage,
  zUndoMessage,
  zClearMessage,
  zGuessMessage,
  zPassMessage,
  zRematchMessage,
  zRefreshProfileMessage,
])
