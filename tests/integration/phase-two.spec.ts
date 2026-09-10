import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, Room } from 'colyseus.js'
import { startLocalServer, stopLocalServer, waitForPort } from '../helpers/server'

async function waitForMessage<T>(room: Room, type: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeoutMs)
    room.onMessage(type, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

const hello = (userId: string) => ({
  userId,
  buildId: 'draw-duo-phase-2',
  protocolMajor: 1,
  language: 'en',
  platformId: 'web-dev',
  capabilities: ['canvas-strokes', 'reconnect-snapshot'],
})

describe('integration: Phase 2 compatibility, queue, and canvas recovery contracts', () => {
  const port = 2679
  let procState: ReturnType<typeof startLocalServer> | null = null

  beforeAll(async () => {
    procState = startLocalServer(port, { testMode: true })
    await waitForPort(port)
  })

  afterAll(() => {
    if (procState) stopLocalServer(procState.process)
  })

  it('rejects incompatible queue clients, pairs cross-platform users, and emits canonical canvas snapshots', async () => {
    const baseUrl = `http://127.0.0.1:${port}`
    const version = await fetch(`${baseUrl}/api/version`).then((response) => response.json())
    expect(version.protocolMajor).toBe(1)
    expect(version.minimumBuildId).toBe('draw-duo-phase-2')

    const incompatible = await fetch(`${baseUrl}/api/match/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...hello('old-client'), protocolMajor: 99 }),
    })
    expect(incompatible.status).toBe(426)

    const searching = await fetch(`${baseUrl}/api/match/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hello('phase2-a')),
    }).then((response) => response.json())
    const matched = await fetch(`${baseUrl}/api/match/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hello('phase2-b')),
    }).then((response) => response.json())
    expect(searching.status).toBe('searching')
    expect(matched.status).toBe('matched')
    expect(matched.roomId).toBe(searching.roomId)

    const clientA = new Client(`ws://127.0.0.1:${port}`)
    const clientB = new Client(`ws://127.0.0.1:${port}`)
    const roomA = await clientA.joinById(searching.roomId, hello('phase2-a'))
    const roomB = await clientB.joinById(searching.roomId, hello('phase2-b'))
    await Promise.all([waitForMessage(roomA, 'sessionState'), waitForMessage(roomB, 'sessionState')])

    const readyA = waitForMessage(roomA, 'sessionState')
    const readyB = waitForMessage(roomB, 'sessionState')
    roomA.send('input', { type: 'ready' })
    roomB.send('input', { type: 'ready' })
    await Promise.all([readyA, readyB])

    const choiceResult = await Promise.race([
      waitForMessage<{ turnId: string; choices: Array<{ id: string }> }>(roomA, 'privateChoices').then((message) => ({ room: roomA, message })),
      waitForMessage<{ turnId: string; choices: Array<{ id: string }> }>(roomB, 'privateChoices').then((message) => ({ room: roomB, message })),
    ])
    choiceResult.room.send('input', { type: 'selectChoice', turnId: choiceResult.message.turnId, choiceId: choiceResult.message.choices[0].id, actionId: 'phase2-choice' })

    const bankResult = await Promise.race([
      waitForMessage<{ turnId: string }>(roomA, 'drawBank').then((message) => ({ room: roomA, message })),
      waitForMessage<{ turnId: string }>(roomB, 'drawBank').then((message) => ({ room: roomB, message })),
    ])
    const drawer = choiceResult.room
    const strokeEvent = waitForMessage<{ sequence: number; turnId: string }>(drawer, 'drawEvent')
    drawer.send('input', {
      type: 'stroke',
      turnId: bankResult.message.turnId,
      actionId: 'phase2-stroke',
      connectionEpoch: 1,
      generation: 0,
      tool: 'draw',
      color: '#111111',
      width: 4,
      points: [{ x: 12, y: 14 }, { x: 30, y: 32 }],
      timestamp: Date.now(),
    })
    const event = await strokeEvent
    expect(event.sequence).toBeGreaterThan(0)
    expect(event.turnId).toBe(bankResult.message.turnId)

    const snapshot = waitForMessage<{ generation: number; sequence: number; strokes: unknown[] }>(drawer, 'drawSnapshot')
    drawer.send('input', { type: 'clearCanvas', turnId: bankResult.message.turnId, actionId: 'phase2-clear', connectionEpoch: 1, generation: 0 })
    const recovered = await snapshot
    expect(recovered.generation).toBeGreaterThan(0)
    expect(recovered.sequence).toBeGreaterThan(event.sequence)
    expect(recovered.strokes).toHaveLength(0)

    await roomA.leave()
    await roomB.leave()
  })
})
