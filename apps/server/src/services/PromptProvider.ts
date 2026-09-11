import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Difficulty } from '@drawduo/protocol'
import type { PromptEntry } from '../rooms/types.js'
import { normalizeAnswerText } from '@drawduo/rules'
import { randomInt, randomUUID } from 'node:crypto'
import { findProjectRoot } from './ProjectPaths.js'

interface PromptFile {
  prompts: PromptEntry[]
}

export class PromptProvider {
  private readonly promptsByDifficulty: Record<Difficulty, PromptEntry[]>
  private readonly rngState: { value: number } | null
  private readonly forcedSequence: string[]
  private readonly usedPromptIds = new Set<string>()

  constructor() {
    const sourceRoot = findProjectRoot(path.dirname(fileURLToPath(import.meta.url)))
    const seedFile = path.join(sourceRoot, 'docs/reference/seed-prompts.json')
    const publishedFile = process.env.DRAW_DUO_CONTENT_BUNDLE ? path.resolve(process.env.DRAW_DUO_CONTENT_BUNDLE) : path.join(sourceRoot, 'content/published/prompts.json')
    const developmentMode = process.env.NODE_ENV === 'development' || process.env.DRAW_DUO_TEST_MODE === '1'
    const promptFile = developmentMode && !process.env.DRAW_DUO_CONTENT_BUNDLE ? seedFile : publishedFile
    const raw = fs.readFileSync(promptFile, 'utf-8')
    const parsed = JSON.parse(raw) as PromptFile
    const normalized = parsed.prompts.map((entry) => ({
      ...entry,
      canonicalAnswer: normalizeAnswerText(entry.canonicalAnswer),
    })).filter((entry) => developmentMode || (entry.reviewStatus === 'approved' && entry.enabled))
    if (!normalized.length) throw new Error('published_content_empty')
    this.promptsByDifficulty = {
      1: normalized.filter((entry) => entry.difficulty === 1),
      2: normalized.filter((entry) => entry.difficulty === 2),
      3: normalized.filter((entry) => entry.difficulty === 3),
    }
    if (Object.values(this.promptsByDifficulty).some((pool) => pool.length === 0)) throw new Error('published_content_missing_difficulty')
    this.rngState = process.env.DRAW_DUO_TEST_MODE === '1' ? { value: Number(process.env.DRAW_DUO_TEST_SEED || 1234567) } : null
    this.forcedSequence = process.env.DRAW_DUO_TEST_SEQUENCE ? process.env.DRAW_DUO_TEST_SEQUENCE.split(',') : []
  }

  private random(): number {
    if (!this.rngState) return randomInt(0, 0x100000000) / 0x100000000
    this.rngState.value = (this.rngState.value * 1664525 + 1013904223) % 4294967296
    return this.rngState.value / 4294967296
  }

  nextChoice(difficulty: Difficulty): PromptEntry {
    const forced = this.forcedSequence.shift()
    if (forced) {
      const found = this.promptsByDifficulty[difficulty].find((entry) => entry.id === forced)
      if (found) return found
    }
    const eligible = this.promptsByDifficulty[difficulty].filter((entry) => !this.usedPromptIds.has(entry.id))
    const pool = eligible.length ? eligible : this.promptsByDifficulty[difficulty]
    const idx = Math.floor(this.random() * pool.length)
    const selected = pool[Math.max(0, Math.min(pool.length - 1, idx))]
    this.usedPromptIds.add(selected.id)
    return selected
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

  resetSession() {
    this.usedPromptIds.clear()
  }
}
