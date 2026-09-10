import { describe, expect, it } from 'vitest'
import { applyTurnOutcome, normalizeAnswerText, slotCountFromAnswer, slotPatternFromAnswer, resolveRulesFromEnv } from '@drawduo/rules'

describe('rules and answer shaping', () => {
  it('normalizes canonical answers consistently', () => {
    expect(normalizeAnswerText('  tRAffic   JAM\n')).toBe('TRAFFIC JAM')
  })

  it('derives slots for spaced answers', () => {
    expect(slotPatternFromAnswer('TRAFFIC JAM')).toEqual([7, 3])
    expect(slotCountFromAnswer('TR AF FIC JAM')).toBe(10)
  })

  it('rewards solved outcomes with equal-per-player coins', () => {
    const solved = applyTurnOutcome('solved', 2, {
      duoStreakCurrent: 1,
      duoStreakBest: 1,
      solvedTurns: 0,
      playerWallets: { a: 0, b: 0 },
    })

    expect(solved.teamPointsAwarded).toBe(2)
    expect(solved.coinsAwardedPerPlayer).toBe(2)
    expect(solved.currentDuoStreak).toBe(2)
    expect(solved.bestDuoStreak).toBe(2)
  })

  it('keeps zero reward when unanswered', () => {
    const timeout = applyTurnOutcome('timeout', 3, {
      duoStreakCurrent: 1,
      duoStreakBest: 5,
      solvedTurns: 1,
      playerWallets: { a: 12, b: 12 },
    })

    expect(timeout.teamPointsAwarded).toBe(0)
    expect(timeout.coinsAwardedPerPlayer).toBe(0)
    expect(timeout.currentDuoStreak).toBe(0)
    expect(timeout.bestDuoStreak).toBe(5)
  })

  it('selects test rules when requested', () => {
    const previous = process.env.DRAW_DUO_TEST_MODE
    process.env.DRAW_DUO_TEST_MODE = '1'
    const rules = resolveRulesFromEnv()
    expect(rules.drawingSeconds).toBe(2)
    process.env.DRAW_DUO_TEST_MODE = previous
  })
})
