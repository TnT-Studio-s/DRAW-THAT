import type { CosmeticEquipSlot, Difficulty, TurnOutcome } from '@drawduo/protocol'

export interface PromptEntry {
  id: string
  language: 'en'
  canonicalAnswer: string
  difficulty: Difficulty
  reviewStatus: 'candidate' | 'approved'
  enabled: boolean
  contentVersion: string
}

export interface LetterTile {
  id: string
  letter: string
  used: boolean
}

export interface TurnChoice {
  id: string
  promptId: string
  difficulty: Difficulty
  answer: string
  hint: string
}

export interface TurnState {
  id: string
  index: number
  drawerSessionId: string
  choices: TurnChoice[]
  selectedChoice?: TurnChoice
  phase: 'SELECTING' | 'COUNTDOWN' | 'DRAWING' | 'RESOLVING' | 'REVEAL'
  selectionDeadline: number
  countdownDeadline: number
  drawingDeadline: number
  revealDeadline: number
  board: LetterTile[]
  slotPattern: number[]
  slotCount: number
  outcome: TurnOutcome | null
  resolutionId: string | null
  boardGeneration: number
  lastGuessAt: number
  selectedLength: number
}

export interface PlayerState {
  sessionId: string
  userId: string
  playerId: string
  role: 'drawer' | 'guesser'
  wallet: number
  displayName: string
  ownedCosmetics: string[]
  equippedCosmetics: Partial<Record<CosmeticEquipSlot, string>>
  connected: boolean
  ready: boolean
  rematchVoted: boolean
  connectionEpoch: number
}
