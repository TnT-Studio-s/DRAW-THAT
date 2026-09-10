import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Difficulty } from '@drawduo/protocol'
import type { PromptEntry } from '../rooms/types.js'
import { normalizeAnswerText } from '@drawduo/rules'
import { randomUUID } from 'node:crypto'

interface PromptFile {
  prompts: PromptEntry[]
}

export class PromptProvider {
  private readonly promptsByDifficulty: Record<Difficulty, PromptEntry[]>
  private readonly rngState: { value: number }
  private readonly forcedSequence: string[]

  constructor() {
    const promptFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../docs/reference/seed-prompts.json')
    const raw = fs.readFileSync(promptFile, 'utf-8')
    const parsed = JSON.parse(raw) as PromptFile
    const normalized = parsed.prompts.map((entry) => ({
      ...entry,
      canonicalAnswer: normalizeAnswerText(entry.canonicalAnswer),
    }))
    this.promptsByDifficulty = {
      1: normalized.filter((entry) => entry.difficulty === 1),
      2: normalized.filter((entry) => entry.difficulty === 2),
      3: normalized.filter((entry) => entry.difficulty === 3),
    }
    this.rngState = { value: Number(process.env.DRAW_DUO_TEST_SEED || 1234567) }
    this.forcedSequence = process.env.DRAW_DUO_TEST_SEQUENCE ? process.env.DRAW_DUO_TEST_SEQUENCE.split(',') : []
  }

  private random(): number {
    this.rngState.value = (this.rngState.value * 1664525 + 1013904223) % 4294967296
    return this.rngState.value / 4294967296
  }

  nextChoice(difficulty: Difficulty): PromptEntry {
    const forced = this.forcedSequence.shift()
    if (forced) {
      const found = this.promptsByDifficulty[difficulty].find((entry) => entry.id === forced)
      if (found) return found
    }
    const pool = this.promptsByDifficulty[difficulty]
    const idx = Math.floor(this.random() * pool.length)
    return pool[Math.max(0, Math.min(pool.length - 1, idx))]
  }

  makeChoices(): PromptEntry[] {
    return [
      this.nextChoice(1),
      this.nextChoice(2),
      this.nextChoice(3),
    ]
  }

  makeChoiceToken(prompt: PromptEntry): string {
    return randomUUID()
  }
}
