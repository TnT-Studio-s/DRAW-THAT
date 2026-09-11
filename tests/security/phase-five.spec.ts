import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, Room } from 'colyseus.js'
import { startLocalServer, stopLocalServer, waitForPort } from '../helpers/server'

type PrivateChoices = { turnId: string; choices: Array<{ id: string }> }
type DrawBank = { turnId: string; board: Array<{ id: string; letter: string }>; slotCount: number }
type PrivatePrompt = { turnId: string; answer: string }
type ErrorMessage = { type: 'error'; code: string }
type Resolved = { type: 'turnResolved'; outcome: string }

function waitForMessage<T>(room: Room, type: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs)
    room.onMessage(type, (message: T) => {
      clearTimeout(timer)
      resolve(message)
    })
  })
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('security: Phase 5 adversarial room boundaries', () => {
  const port = 2682
  let procState: ReturnType<typeof startLocalServer> | null = null

  beforeAll(async () => {
    procState = startLocalServer(port, { testMode: true })
    await waitForPort(port)
  })

  afterAll(() => {
    if (procState) stopLocalServer(procState.process)
  })

  it('rejects malformed and unsafe strokes, and deduplicates accepted actions', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/lobby/private/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const { roomId, roomCode } = await response.json() as { roomId: string; roomCode: string }
    const clientA = new Client(`ws://127.0.0.1:${port}`)
    const clientB = new Client(`ws://127.0.0.1:${port}`)
    const roomA = await clientA.joinById(roomId, { userId: 'phase5-a', roomCode })
    const roomB = await clientB.joinById(roomId, { userId: 'phase5-b', roomCode })

    try {
      roomA.send('input', { type: 'ready' })
      roomB.send('input', { type: 'ready' })
      const privateA = waitForMessage<PrivateChoices>(roomA, 'privateChoices')
      const privateB = waitForMessage<PrivateChoices>(roomB, 'privateChoices')
      const first = await Promise.race([
        privateA.then((message) => ({ drawer: roomA, guesser: roomB, message })),
        privateB.then((message) => ({ drawer: roomB, guesser: roomA, message })),
      ])

      const invalidMessage = waitForMessage<ErrorMessage>(first.drawer, 'error')
      first.drawer.send('input', {
        type: 'stroke',
        turnId: first.message.turnId,
        actionId: 'oversized-points',
        connectionEpoch: 1,
        generation: 0,
        tool: 'draw',
        width: 4,
        color: '#111111',
        points: Array.from({ length: 65 }, (_, index) => ({ x: index, y: index })),
        timestamp: Date.now(),
      })
      expect((await invalidMessage).code).toBe('invalid_message')

      const promptPromise = waitForMessage<PrivatePrompt>(first.drawer, 'privatePrompt')
      first.drawer.send('input', { type: 'selectChoice', turnId: first.message.turnId, choiceId: first.message.choices[0].id, actionId: 'phase5-choice' })
      const prompt = await promptPromise
      const bank = await Promise.race([
        waitForMessage<DrawBank>(roomA, 'drawBank'),
        waitForMessage<DrawBank>(roomB, 'drawBank'),
      ])

      const staleEpoch = waitForMessage<ErrorMessage>(first.guesser, 'error')
      first.guesser.send('input', { type: 'pass', turnId: bank.turnId, actionId: 'stale-epoch', connectionEpoch: 99, timestamp: Date.now() })
      expect((await staleEpoch).code).toBe('stale_action')

      const invalidStroke = waitForMessage<ErrorMessage>(first.drawer, 'error')
      first.drawer.send('input', {
        type: 'stroke',
        turnId: bank.turnId,
        actionId: 'invalid-style',
        connectionEpoch: 1,
        generation: 0,
        tool: 'draw',
        width: 2,
        color: '#111111',
        points: [{ x: 10, y: 10 }],
        timestamp: Date.now(),
      })
      expect((await invalidStroke).code).toBe('invalid_stroke')

      const accepted = waitForMessage<{ sequence: number }>(first.drawer, 'drawEvent')
      const stroke = { type: 'stroke', turnId: bank.turnId, actionId: 'duplicate-stroke', connectionEpoch: 1, generation: 0, tool: 'draw', width: 4, color: '#111111', points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], timestamp: Date.now() }
      first.drawer.send('input', stroke)
      expect((await accepted).sequence).toBeGreaterThan(0)

      let duplicateReceived = false
      const duplicateCheck = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 300)
        first.drawer.onMessage('drawEvent', () => {
          duplicateReceived = true
          clearTimeout(timer)
          resolve()
        })
      })
      first.drawer.send('input', stroke)
      await duplicateCheck
      expect(duplicateReceived).toBe(false)

      const snapshot = waitForMessage<{ generation: number }>(first.drawer, 'drawSnapshot')
      first.drawer.send('input', { type: 'clearCanvas', turnId: bank.turnId, actionId: 'phase5-clear', connectionEpoch: 1, generation: 0 })
      expect((await snapshot).generation).toBe(1)

      const staleGeneration = waitForMessage<ErrorMessage>(first.drawer, 'error')
      first.drawer.send('input', { ...stroke, actionId: 'stale-generation', generation: 0 })
      expect((await staleGeneration).code).toBe('stale_action')

      const availableTiles = [...bank.board]
      const selectedTileIds = [...prompt.answer.toUpperCase()].map((letter) => {
        const index = availableTiles.findIndex((tile) => tile.letter === letter)
        expect(index).toBeGreaterThanOrEqual(0)
        return availableTiles.splice(index, 1)[0].id
      })
      const solved = waitForMessage<Resolved>(first.guesser, 'turnResolved')
      first.guesser.send('input', { type: 'guess', turnId: bank.turnId, actionId: 'ordered-guess', connectionEpoch: 1, selectedTileIds, timestamp: Date.now() })
      expect((await solved).outcome).toBe('solved')
    } finally {
      await Promise.all([roomA.leave(), roomB.leave()])
    }
  })

  it('resolves an elapsed drawing turn as timeout instead of accepting a late pass', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/lobby/private/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const { roomId, roomCode } = await response.json() as { roomId: string; roomCode: string }
    const clientA = new Client(`ws://127.0.0.1:${port}`)
    const clientB = new Client(`ws://127.0.0.1:${port}`)
    const roomA = await clientA.joinById(roomId, { userId: 'phase5-timeout-a', roomCode })
    const roomB = await clientB.joinById(roomId, { userId: 'phase5-timeout-b', roomCode })

    try {
      roomA.send('input', { type: 'ready' })
      roomB.send('input', { type: 'ready' })
      const privateA = waitForMessage<PrivateChoices>(roomA, 'privateChoices')
      const privateB = waitForMessage<PrivateChoices>(roomB, 'privateChoices')
      const first = await Promise.race([
        privateA.then((message) => ({ drawer: roomA, guesser: roomB, message })),
        privateB.then((message) => ({ drawer: roomB, guesser: roomA, message })),
      ])
      first.drawer.send('input', { type: 'selectChoice', turnId: first.message.turnId, choiceId: first.message.choices[0].id, actionId: 'phase5-timeout-choice' })
      const bank = await Promise.race([
        waitForMessage<DrawBank>(roomA, 'drawBank'),
        waitForMessage<DrawBank>(roomB, 'drawBank'),
      ])
      const resolved = waitForMessage<Resolved>(first.guesser, 'turnResolved')
      await delay(2100)
      first.guesser.send('input', { type: 'pass', turnId: bank.turnId, actionId: 'late-pass', connectionEpoch: 1, timestamp: Date.now() })
      expect((await resolved).outcome).toBe('timeout')
    } finally {
      await Promise.all([roomA.leave(), roomB.leave()])
    }
  })
})
