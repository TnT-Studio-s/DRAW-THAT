import { describe, expect, it } from 'vitest'
import { updatePromptBundle, validatePromptBundle } from '../../scripts/content.js'

const prompt = (overrides: Record<string, unknown> = {}) => ({
  id: 'prompt-1',
  language: 'en',
  canonicalAnswer: 'blue house',
  difficulty: 1,
  reviewStatus: 'candidate',
  enabled: false,
  contentVersion: 'beta-v1',
  ...overrides,
})

const completeBundle = (entries = [prompt({ difficulty: 1 }), prompt({ id: 'prompt-2', canonicalAnswer: 'red car', difficulty: 2 }), prompt({ id: 'prompt-3', canonicalAnswer: 'green tree', difficulty: 3 })]) => ({ prompts: entries })

describe('Phase 4 content tool', () => {
  it('accepts development candidates while enforcing schema and difficulty coverage', () => {
    expect(validatePromptBundle(completeBundle()).valid).toBe(true)
  })

  it('rejects normalized duplicates and enabled unreviewed prompts', () => {
    const result = validatePromptBundle(completeBundle([
      prompt({ canonicalAnswer: 'Blue   House', enabled: true }),
      prompt({ id: 'prompt-2', canonicalAnswer: 'blue house', difficulty: 2 }),
      prompt({ id: 'prompt-3', canonicalAnswer: 'green tree', difficulty: 3 }),
    ]))
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('duplicates'))).toBe(true)
    expect(result.errors.some((error) => error.includes('enabled before approval'))).toBe(true)
  })

  it('requires reviewer metadata for publication', () => {
    const result = validatePromptBundle(completeBundle([
      prompt({ reviewStatus: 'approved', enabled: true }),
      prompt({ id: 'prompt-2', canonicalAnswer: 'red car', difficulty: 2, reviewStatus: 'approved', enabled: true, reviewedBy: 'reviewer', reviewedAt: '2026-09-10T00:00:00Z' }),
      prompt({ id: 'prompt-3', canonicalAnswer: 'green tree', difficulty: 3, reviewStatus: 'approved', enabled: true, reviewedBy: 'reviewer', reviewedAt: '2026-09-10T00:00:00Z' }),
    ]), { publication: true })
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('requires reviewedBy'))).toBe(true)
  })

  it('supports bounded review edits without auto-approving content', () => {
    const bundle = completeBundle([
      prompt({ difficulty: 1 }),
      prompt({ id: 'prompt-2', canonicalAnswer: 'red car', difficulty: 1 }),
      prompt({ id: 'prompt-3', canonicalAnswer: 'green tree', difficulty: 3 }),
    ])
    updatePromptBundle(bundle, 'prompt-1', { difficulty: 2, category: 'objects' })
    expect(bundle.prompts[0]).toMatchObject({ difficulty: 2, category: 'objects', reviewStatus: 'candidate', enabled: false })
  })
})
