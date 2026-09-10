import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Client, Room } from 'colyseus.js'
import { startLocalServer, waitForPort, stopLocalServer } from '../helpers/server'

type ServerStateMessage = {
  type: 'sessionState'
  state: {
    phase: string
    turnIndex: number
    turnsPerSession: number
    playerStates: Array<{ sessionId: string }>
    activeTurn: {
      turnId: string
      turnIndex: number
      phase: string
      selectedDifficulty?: number
      slotCount?: number
    } | null
  }
}

type PrivateChoiceMessage = {
  type: 'privateChoices'
  turnId: string
  choices: Array<{ id: string; difficulty: 1 | 2 | 3; promptHint: string }>
}

type DrawBankMessage = {
  type: 'drawBank'
  turnId: string
  board: Array<{ id: string; letter: string }>
  slotPattern: number[]
  slotCount: number
}

type TurnResolvedMessage = {
  type: 'turnResolved'
  turnId: string
  outcome: 'solved' | 'timeout' | 'passed' | 'abandoned' | 'annulled'
}

async function waitForMessage<T>(room: Room, type: string, timeoutMs = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${type}`))
    }, timeoutMs)
    const cb = (data: T) => {
      clearTimeout(timer)
      resolve(data)
    }
    room.onMessage(type, cb)
  })
}

type GameRoom = {
  room: Room
  sessionState: ServerStateMessage['state']
}

async function joinByIdOrThrow(client: Client, roomId: string, userId: string): Promise<Room> {
  return client.joinById(roomId, {
    userId,
    roomCode: 'NOCODE',
  })
}

describe('integration: two-client room and protocol checks', () => {
  const port = 2678
  let procState: ReturnType<typeof startLocalServer> | null = null
  let clientA: Client
  let clientB: Client

  beforeAll(async () => {
    procState = startLocalServer(port, { testMode: true })
    await waitForPort(port)
  })

  afterAll(() => {
    if (procState) {
      stopLocalServer(procState.process)
    }
  })

  it('runs a full selection and pass turn cycle between two players', async () => {
    clientA = new Client(`ws://127.0.0.1:${port}`)
    clientB = new Client(`ws://127.0.0.1:${port}`)

    const response = await fetch(`http://127.0.0.1:${port}/api/lobby/private/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const { roomId } = await response.json()

    const roomA = await joinByIdOrThrow(clientA, roomId, 'user-a')
    const roomB = await joinByIdOrThrow(clientB, roomId, 'user-b')

    const startA = await waitForMessage<ServerStateMessage>(roomA, 'sessionState')
    const startB = await waitForMessage<ServerStateMessage>(roomB, 'sessionState')

    const readyA = waitForMessage<ServerStateMessage>(roomA, 'sessionState')
    const readyB = waitForMessage<ServerStateMessage>(roomB, 'sessionState')
    roomA.send('input', { type: 'ready' })
    roomB.send('input', { type: 'ready' })
    const readyStates = await Promise.all([readyA, readyB])
    expect(readyStates[0].state.phase).toBe('READY_CHECK')

    const roomAState = roomA
    const roomBState = roomB

    const turnState = await Promise.race([
      waitForMessage<ServerStateMessage>(roomAState, 'sessionState'),
      waitForMessage<ServerStateMessage>(roomBState, 'sessionState'),
    ])

    let drawerRoom = roomAState
    let guesserRoom = roomBState

    // whichever room gets private choices is drawer
    const firstChoiceResult = await Promise.race([
      waitForMessage<PrivateChoiceMessage>(roomAState, 'privateChoices').then((message) => ({ room: roomAState, message })),
      waitForMessage<PrivateChoiceMessage>(roomBState, 'privateChoices').then((message) => ({ room: roomBState, message })),
    ])
    drawerRoom = firstChoiceResult.room
    guesserRoom = drawerRoom === roomAState ? roomBState : roomAState
    const firstChoice = firstChoiceResult.message

    if (firstChoice) {
      const easy = firstChoice.choices.find((entry) => entry.difficulty === 1) ?? firstChoice.choices[0]
      drawerRoom.send('input', {
        type: 'selectChoice',
        turnId: firstChoice.turnId,
        choiceId: easy.id,
        actionId: 'choice-action',
      })
    }

    const bank = await Promise.race([
      waitForMessage<DrawBankMessage>(drawerRoom, 'drawBank'),
      waitForMessage<DrawBankMessage>(guesserRoom, 'drawBank'),
    ])
    expect(bank.board.length).toBeGreaterThan(0)

    guesserRoom.send('input', {
      type: 'pass',
      turnId: bank.turnId,
      actionId: 'pass-action',
      timestamp: Date.now(),
      connectionEpoch: 1,
    })

    const resolved = await Promise.race([
      waitForMessage<TurnResolvedMessage>(drawerRoom, 'turnResolved'),
      waitForMessage<TurnResolvedMessage>(guesserRoom, 'turnResolved'),
    ])
    expect(resolved.outcome).toBe('passed')

    await roomA.leave()
    await roomB.leave()
  })
})
