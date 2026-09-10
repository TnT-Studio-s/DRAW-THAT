import { z } from 'zod'

export type Difficulty = 1 | 2 | 3
export type Role = 'drawer' | 'guesser'
export type TurnPhase = 'WAITING' | 'READY_CHECK' | 'SELECTING' | 'COUNTDOWN' | 'DRAWING' | 'RESOLVING' | 'REVEAL' | 'RESULTS' | 'ABORTED' | 'CLOSED'
export type TurnOutcome = 'solved' | 'timeout' | 'passed' | 'abandoned' | 'annulled'
export type PlatformId = 'web-dev' | 'windows' | 'android' | 'ios'
export type DrawTool = 'draw' | 'erase'

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
  wallet: number
  connected: boolean
  ready: boolean
  rematch: boolean
}

export interface SessionPublicState {
  roomCode: string | null
  phase: TurnPhase
  sessionId: string
  turnsPerSession: number
  turnIndex: number
  teamScore: number
  solvedTurns: number
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
  | ServerMessageDrawBank
  | ServerMessageDrawEvent
  | ServerMessageDrawSnapshot
  | ServerMessageGuess
  | ServerMessageTurnResolved
  | ServerMessageState
  | ServerMessageError

export const zDifficulty = z.union([z.literal(1), z.literal(2), z.literal(3)])

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
  sessionId: z.string(),
  turnId: z.string(),
  actionId: z.string(),
  connectionEpoch: z.number().int().nonnegative(),
})

export const zWordChoice = z.object({
  id: z.string(),
  difficulty: zDifficulty,
})

export const zReadyMessage = z.object({ type: z.literal('ready') })
export const zSelectChoiceMessage = z.object({
  type: z.literal('selectChoice'),
  turnId: z.string(),
  choiceId: z.string(),
  actionId: z.string(),
})
export const zStrokeMessage = z.object({
  type: z.literal('stroke'),
  turnId: z.string(),
  actionId: z.string(),
  connectionEpoch: z.number(),
  generation: z.number(),
  tool: z.enum(['draw', 'erase']),
  width: z.number(),
  color: z.string(),
  points: z
    .array(z.object({ x: z.number(), y: z.number(), pressure: z.number().optional() }))
    .min(1)
    .max(64),
  timestamp: z.number(),
})
export const zUndoMessage = z.object({
  type: z.literal('undo'),
  turnId: z.string(),
  actionId: z.string(),
  connectionEpoch: z.number(),
  generation: z.number(),
})
export const zClearMessage = z.object({
  type: z.literal('clearCanvas'),
  turnId: z.string(),
  actionId: z.string(),
  connectionEpoch: z.number(),
  generation: z.number(),
})
export const zGuessMessage = z.object({
  type: z.literal('guess'),
  turnId: z.string(),
  actionId: z.string(),
  connectionEpoch: z.number(),
  selectedTileIds: z.array(z.string()).min(1),
  timestamp: z.number(),
})
export const zPassMessage = z.object({
  type: z.literal('pass'),
  turnId: z.string(),
  actionId: z.string(),
  connectionEpoch: z.number(),
  timestamp: z.number(),
})
export const zRematchMessage = z.object({
  type: z.literal('rematch'),
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
])
