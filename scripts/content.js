import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CONTENT_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const ANSWER_PATTERN = /^[a-z]+(?: [a-z]+){0,3}$/

export function normalizePromptAnswer(answer) {
  return String(answer ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function validatePromptBundle(bundle, options = {}) {
  const errors = []
  const prompts = Array.isArray(bundle?.prompts) ? bundle.prompts : []
  const ids = new Set()
  const answers = new Set()
  const difficulties = new Set()
  const publication = options.publication === true

  if (!prompts.length) errors.push('prompts must contain at least one entry')

  for (const [index, prompt] of prompts.entries()) {
    const label = `prompts[${index}]`
    if (!prompt || typeof prompt !== 'object') {
      errors.push(`${label} must be an object`)
      continue
    }
    const id = String(prompt.id ?? '').trim()
    const answer = normalizePromptAnswer(prompt.canonicalAnswer)
    const version = String(prompt.contentVersion ?? '').trim()
    const difficulty = Number(prompt.difficulty)
    const status = prompt.reviewStatus

    if (!id || ids.has(id)) errors.push(`${label}.id must be unique and non-empty`)
    ids.add(id)
    if (prompt.language !== 'en') errors.push(`${label}.language must be en`)
    if (!ANSWER_PATTERN.test(answer) || answer.replaceAll(' ', '').length < 3 || answer.replaceAll(' ', '').length > 16) {
      errors.push(`${label}.canonicalAnswer must be 3-16 ASCII letters across at most four words`)
    }
    if (answers.has(answer)) errors.push(`${label}.canonicalAnswer duplicates a normalized answer`)
    answers.add(answer)
    if (![1, 2, 3].includes(difficulty)) errors.push(`${label}.difficulty must be 1, 2, or 3`)
    difficulties.add(difficulty)
    if (!['candidate', 'approved'].includes(status)) errors.push(`${label}.reviewStatus must be candidate or approved`)
    if (typeof prompt.enabled !== 'boolean') errors.push(`${label}.enabled must be boolean`)
    if (prompt.enabled && status !== 'approved') errors.push(`${label} cannot be enabled before approval`)
    if (!CONTENT_VERSION_PATTERN.test(version)) errors.push(`${label}.contentVersion is invalid`)
    if (publication && (status !== 'approved' || prompt.enabled !== true)) errors.push(`${label} is not publishable`)
    if (publication && (!String(prompt.reviewedBy ?? '').trim() || !String(prompt.reviewedAt ?? '').trim())) errors.push(`${label} requires reviewedBy and reviewedAt for publication`)
    if (prompt.category !== undefined && (!String(prompt.category).trim() || String(prompt.category).length > 64)) errors.push(`${label}.category is invalid`)
  }

  for (const difficulty of [1, 2, 3]) {
    if (!difficulties.has(difficulty)) errors.push(`missing difficulty tier ${difficulty}`)
  }

  return { valid: errors.length === 0, errors, count: prompts.length }
}

export function readPromptBundle(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function publishPromptBundle(inputPath, outputPath) {
  const bundle = readPromptBundle(inputPath)
  const result = validatePromptBundle(bundle, { publication: true })
  if (!result.valid) throw new Error(result.errors.join('; '))
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify({ ...bundle, usage: 'Server-only published content. Human-reviewed and enabled.', publishedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
  return result
}

export function updatePromptBundle(bundle, promptId, changes) {
  const prompts = Array.isArray(bundle?.prompts) ? bundle.prompts : []
  const prompt = prompts.find((entry) => entry?.id === promptId)
  if (!prompt) throw new Error(`prompt_not_found:${promptId}`)
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) prompt[key] = value
  }
  const result = validatePromptBundle(bundle)
  if (!result.valid) throw new Error(result.errors.join('; '))
  return bundle
}

function parseChanges(args) {
  const changes = {}
  for (const argument of args) {
    const [key, ...parts] = argument.replace(/^--/, '').split('=')
    const value = parts.join('=')
    if (key === 'review-status') changes.reviewStatus = value
    else if (key === 'enabled') changes.enabled = value === 'true'
    else if (key === 'difficulty') changes.difficulty = Number(value)
    else if (key === 'category') changes.category = value
    else if (key === 'reviewed-by') changes.reviewedBy = value
    else if (key === 'reviewed-at') changes.reviewedAt = value
    else throw new Error(`unknown_edit_option:${key}`)
  }
  return changes
}

function usage() {
  console.error('Usage: node scripts/content.js validate <input.json> | publish <input.json> <output.json> | edit <input.json> <output.json> <prompt-id> [--review-status=...] [--enabled=true|false] [--difficulty=1|2|3] [--category=...] [--reviewed-by=...] [--reviewed-at=...]')
  process.exitCode = 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2]
  const inputPath = process.argv[3]
  if (!command || !inputPath || !['validate', 'publish', 'edit'].includes(command) || (command === 'publish' && !process.argv[4]) || (command === 'edit' && (!process.argv[4] || !process.argv[5]))) {
    usage()
  } else {
    try {
      const result = command === 'validate'
        ? (() => { const bundle = readPromptBundle(inputPath); return validatePromptBundle(bundle) })()
        : command === 'publish'
          ? publishPromptBundle(inputPath, process.argv[4])
          : (() => {
            const bundle = readPromptBundle(inputPath)
            updatePromptBundle(bundle, process.argv[5], parseChanges(process.argv.slice(6)))
            fs.writeFileSync(process.argv[4], `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
            return validatePromptBundle(bundle)
          })()
      if (!result.valid) {
        console.error(`[content] invalid: ${result.errors.join('; ')}`)
        process.exitCode = 1
      } else {
        console.log(`[content] PASS: ${result.count} prompts validated${command === 'publish' ? ' and published' : command === 'edit' ? ' and updated' : ''}`)
      }
    } catch (error) {
      console.error(`[content] failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    }
  }
}
