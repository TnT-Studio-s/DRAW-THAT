import { randomUUID } from 'node:crypto'
import type { Difficulty } from '@drawduo/protocol'

export interface RuleConfig {
  playersPerRoom: number
  turnsPerSession: number
  selectionSeconds: number
  readySeconds: number
  countdownSeconds: number
  drawingSeconds: number
  revealSeconds: number
  rematchSeconds: number
  reconnectSeconds: number
  acceptedGuessIntervalMs: number
}

export interface ResolvedTurn {
  resolutionId: string
  teamPointsAwarded: 0 | Difficulty
  coinsAwardedPerPlayer: 0 | Difficulty
  currentDuoStreak: number
  bestDuoStreak: number
}

export interface TurnOutcomeInput {
  action: 'solved' | 'timeout' | 'passed' | 'abandoned' | 'annulled'
}

export const DEFAULT_RULES: RuleConfig = {
  playersPerRoom: 2,
  turnsPerSession: 8,
  selectionSeconds: 10,
  readySeconds: 20,
  countdownSeconds: 3,
  drawingSeconds: 60,
  revealSeconds: 5,
  rematchSeconds: 30,
  reconnectSeconds: 30,
  acceptedGuessIntervalMs: 1000,
}

export const TEST_RULES: RuleConfig = {
  ...DEFAULT_RULES,
  drawingSeconds: 2,
  selectionSeconds: 2,
  readySeconds: 2,
  countdownSeconds: 1,
  revealSeconds: 1,
  rematchSeconds: 2,
}

export type RuleSetName = 'default' | 'test'

export function resolveRulesFromEnv(): RuleConfig {
  if (process.env.DRAW_DUO_TEST_MODE === '1') {
    return TEST_RULES
  }
  return DEFAULT_RULES
}

export function normalizeAnswerText(value: string): string {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) {
    return normalized
  }
  return normalized
}

export function createWordSignature(value: string): string {
  const normalized = normalizeAnswerText(value)
  return normalized
}

export function slotPatternFromAnswer(answer: string): number[] {
  if (!answer.length) {
    return []
  }
  const groups = answer.split(' ')
  return groups.map((group) => group.length)
}

export function slotCountFromAnswer(answer: string): number {
  return normalizeAnswerText(answer).replace(/ /g, '').length
}

export function rewardForDifficulty(difficulty: Difficulty): 0 | Difficulty {
  return difficulty as Difficulty
}

export function applyTurnOutcome(
  outcome: TurnOutcomeInput['action'],
  difficulty: Difficulty,
  state: {
    duoStreakCurrent: number
    duoStreakBest: number
    solvedTurns: number
    playerWallets: Record<string, number>
  },
): ResolvedTurn {
  if (outcome !== 'solved') {
    return {
      resolutionId: randomUUID(),
      teamPointsAwarded: 0,
      coinsAwardedPerPlayer: 0,
      currentDuoStreak: 0,
      bestDuoStreak: Math.max(state.duoStreakCurrent, state.duoStreakBest),
    }
  }
  const points = rewardForDifficulty(difficulty)
  const nextCurrent = state.duoStreakCurrent + 1
  return {
    resolutionId: randomUUID(),
    teamPointsAwarded: points,
    coinsAwardedPerPlayer: points,
    currentDuoStreak: nextCurrent,
    bestDuoStreak: Math.max(state.duoStreakBest, nextCurrent),
  }
}
