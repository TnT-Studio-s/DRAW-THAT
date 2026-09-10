import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Client } from 'colyseus.js'
import { startLocalServer, waitForPort, stopLocalServer } from '../helpers/server'

type ServerMessage = { code: string; message: string; type: 'error' }

type PrivateChoiceMessage = {
  type: 'privateChoices'
  turnId: string
  choices: Array<{ id: string; difficulty: 1 | 2 | 3; promptHint: string }>
}

type ServerStateMessage = {
  type: 'sessionState'
  state: {
    phase: string
    playerStates: Array<{ sessionId: string; role: 'drawer' | 'guesser' }>
    activeTurn: { turnId: string; turnIndex: number; phase: string; slotCount: number } | null
  }
}

type ErrorMessage = { type: 'error'; code: string; message: string }

type DrawBankMessage = { type: 'drawBank'; turnId: string; board: Array<{ id: string; letter: string }>; slotPattern: number[]; slotCount: number }

function waitForMessage<T>(room: any, type: string, timeoutMs = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timeout ${type}`)), timeoutMs)
    room.onMessage(type, (payload: T) => {
      clearTimeout(timeout)
      resolve(payload)
    })
  })
}

describe('security: role and message-boundary checks', () => {
  const port = 2679
  let procState: ReturnType<typeof startLocalServer> | null = null
  let clientA: Client
  let clientB: Client

  beforeAll(async () => {
    procState = startLocalServer(port, { testMode: true })
    await waitForPort(port)
  })

  afterAll(() => {
    if (procState) stopLocalServer(procState.process)
  })

  it('rejects wrong-role actions and hides private choice payloads', async () => {
    clientA = new Client(`ws://127.0.0.1:${port}`)
    clientB = new Client(`ws://127.0.0.1:${port}`)

    const create = await fetch(`http://127.0.0.1:${port}/api/lobby/private/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const { roomId } = await create.json()

    const roomA = await clientA.joinById(roomId, { userId: 'u1' })
    const roomB = await clientB.joinById(roomId, { userId: 'u2' })

    roomA.send('input', { type: 'ready' })
    roomB.send('input', { type: 'ready' })

    const turnState = await waitForMessage<ServerStateMessage>(roomA, 'sessionState')
    const guesserOrDrawer = turnState.state.phase
    expect(guesserOrDrawer).toBeTruthy()

    const privateChoicePromiseA = waitForMessage<PrivateChoiceMessage>(roomA, 'privateChoices')
    const privateChoicePromiseB = waitForMessage<PrivateChoiceMessage>(roomB, 'privateChoices')

    const firstPrivateResult = await Promise.race([
      privateChoicePromiseA.then((message) => ({ room: roomA, message })),
      privateChoicePromiseB.then((message) => ({ room: roomB, message })),
    ])
    const firstPrivate: PrivateChoiceMessage = firstPrivateResult.message
    const drawerRoom = firstPrivateResult.room
    const guesserRoom = drawerRoom === roomA ? roomB : roomA

    // wrong-role check: guesser should be unable to submit stroke
    const errorWait = waitForMessage<ErrorMessage>(guesserRoom, 'error')
    guesserRoom.send('input', {
      type: 'stroke',
      turnId: firstPrivate.turnId,
      actionId: 'wrong-stroke',
      generation: 0,
      tool: 'draw',
      color: '#000',
      width: 2,
      points: [{ x: 10, y: 10 }],
      timestamp: Date.now(),
      connectionEpoch: 1,
    })
    const error = await errorWait
    expect(error.code).toBe('wrong_role')

    // leak check: only drawer sees private choices for this turn
    const wrongChoice = await Promise.race([
      privateChoicePromiseA.catch(() => null),
      privateChoicePromiseB.catch(() => null),
    ])

    await drawerRoom.send('input', {
      type: 'selectChoice',
      turnId: firstPrivate.turnId,
      choiceId: firstPrivate.choices[0].id,
      actionId: 'select',
    })

    const bank = await Promise.race([waitForMessage<DrawBankMessage>(drawerRoom, 'drawBank'), waitForMessage<DrawBankMessage>(guesserRoom, 'drawBank')])
    expect(bank.board.length).toBeGreaterThan(0)

    await roomA.leave()
    await roomB.leave()
  })
})
