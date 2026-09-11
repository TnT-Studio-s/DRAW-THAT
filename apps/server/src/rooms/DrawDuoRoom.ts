
import { Room, type Client } from '@colyseus/core'
import { randomInt, randomUUID } from 'node:crypto'
import type { CanvasStrokeSnapshot, DrawTool, ServerMessageState, TurnOutcome } from '@drawduo/protocol'
import { CLIENT_BUILD_ID, COSMETIC_CATALOG, MIN_SUPPORTED_BUILD_ID, PROTOCOL_MAJOR, RULES_VERSION, zClientHello, zClientMessage } from '@drawduo/protocol'
import { applyTurnOutcome, normalizeAnswerText, resolveRulesFromEnv, slotCountFromAnswer, slotPatternFromAnswer } from '@drawduo/rules'
import { PromptProvider } from '../services/PromptProvider.js'
import { getCodeByRoom, getInviteOwner, releaseCode, validateCodeForRoom } from '../services/MatchmakerState.js'
import { registerRoom, unregisterRoom } from '../services/RoomRegistry.js'
import { getAccountStore } from '../services/AccountStore.js'
import { getEvidenceStore } from '../services/EvidenceStore.js'
import { authenticateBearerToken } from '../services/AuthService.js'
import type { LetterTile, PlayerState, TurnChoice, TurnState } from './types.js'

type RoomPhase = ServerMessageState['state']['phase']
type RoomInput = { userId?: string; roomCode?: string; authToken?: string }

const CLIENT_EPOCH = 1
const MAX_CANVAS_COORDINATE = 65535
const MAX_STROKES_PER_TURN = 512
const MAX_POINTS_PER_TURN = 12000
const MAX_STROKE_PAYLOAD_BYTES = 16 * 1024
const MAX_STROKE_BATCHES_PER_SECOND = 20
const MAX_SEEN_ACTIONS = 4096
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export class DrawDuoRoom extends Room {
  maxClients = 2

  private readonly rules = resolveRulesFromEnv()
  private readonly prompts = new PromptProvider()
  private readonly players = new Map<string, PlayerState>()
  private readonly seenActions = new Set<string>()
  private canvasSequence = 0
  private canvasStrokes: CanvasStrokeSnapshot[] = []
  private acceptedPointCount = 0
  private strokeWindowStartedAt = 0
  private strokeWindowCount = 0
  private turn: TurnState | null = null
  private phase: RoomPhase = 'WAITING'
  private turnIndex = 0
  private teamScore = 0
  private solvedTurns = 0
  private sessionCoinsPerPlayer = 0
  private duoStreakCurrent = 0
  private duoStreakBest = 0
  private rematchDeadline: number | null = null
  private readyDeadline: number | null = null
  private sessionStarted = false
  private sessionFinished = false
  private activeSessionId: string | null = null
  private startedAt = Date.now()
  private openingDrawerIndex = randomInt(0, 2)
  private endAfterReveal = false
  private privateRoom = false

  onCreate() {
    registerRoom(this.roomId, this)
    this.setSimulationInterval(() => this.tick(), 100)
    this.onMessage('input', (client, payload: unknown) => this.handleInput(client, payload))
  }

  async onJoin(client: Client, options: RoomInput & Record<string, unknown> = {}) {
    const disposableIdentityMode = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.DRAW_DUO_TEST_MODE === '1'
    let authenticatedUserId = options.userId ?? client.sessionId
    if (!disposableIdentityMode) {
      if (typeof options.authToken !== 'string' || options.authToken.length === 0) throw new Error('authentication_required')
      const identity = await authenticateBearerToken(options.authToken)
      authenticatedUserId = identity.subject
    }
    const hello = zClientHello.safeParse({
      userId: authenticatedUserId,
      roomCode: options.roomCode,
      buildId: options.buildId ?? CLIENT_BUILD_ID,
      protocolMajor: options.protocolMajor ?? PROTOCOL_MAJOR,
      language: options.language ?? 'en',
      platformId: options.platformId ?? 'web-dev',
      capabilities: options.capabilities ?? [],
    })
    if (!hello.success) throw new Error('invalid_client_handshake')
    if (hello.data.protocolMajor !== PROTOCOL_MAJOR || hello.data.buildId < MIN_SUPPORTED_BUILD_ID) throw new Error('update_required')
    const privateCode = getCodeByRoom(this.roomId)
    if (privateCode && !validateCodeForRoom(this.roomId, options.roomCode)) throw new Error('private_admission_required')
    if (privateCode) this.privateRoom = true
    const disconnectedSeat = [...this.players.values()].find((entry) => entry.userId === hello.data.userId && !entry.connected)
    if ([...this.players.values()].some((entry) => entry.userId === hello.data.userId && entry.connected)) throw new Error('user_already_in_room')
    if (this.players.size >= this.maxClients && !disconnectedSeat) throw new Error('room_full')
    if (disconnectedSeat) this.players.delete(disconnectedSeat.sessionId)
    const account = await getAccountStore().ensurePlayer(hello.data.userId)
    if (account.status !== 'active') throw new Error('account_unavailable')
    if (privateCode) {
      const ownerPlayerId = getInviteOwner(privateCode)
      if (ownerPlayerId && ownerPlayerId !== account.playerId && await getAccountStore().areBlocked(ownerPlayerId, account.playerId)) throw new Error('blocked_user')
    }
    this.players.set(client.sessionId, {
      sessionId: client.sessionId,
      userId: hello.data.userId.trim(),
      playerId: account.playerId,
      role: disconnectedSeat?.role ?? (this.players.size === 0 ? 'drawer' : 'guesser'),
      wallet: disconnectedSeat?.wallet ?? account.wallet,
      displayName: account.displayName,
      ownedCosmetics: account.ownedCosmetics,
      equippedCosmetics: account.equippedCosmetics,
      connected: true,
      ready: disconnectedSeat?.ready ?? false,
      rematchVoted: disconnectedSeat?.rematchVoted ?? false,
      connectionEpoch: (disconnectedSeat?.connectionEpoch ?? 0) + 1,
    })
    if (this.players.size === 2 && !this.sessionStarted) {
      const entries = [...this.players.values()]
      const accounts = await Promise.all(entries.map((entry) => getAccountStore().ensurePlayer(entry.userId)))
      await this.startPersistentSession(accounts[0].playerId, accounts[1].playerId)
      this.phase = 'READY_CHECK'
      this.readyDeadline = Date.now() + this.rules.readySeconds * 1000
      if (privateCode) releaseCode(privateCode)
    }
    setTimeout(() => {
      if (this.players.size === 2) this.sendState()
    }, 1000)
  }

  async onLeave(client: Client, consented = false) {
    const player = this.players.get(client.sessionId)
    if (!player) return
    player.connected = false
    this.sendState()
    if (consented) {
      this.handleDisconnectFailure(player)
      return
    }
    try {
      const reconnected = await this.allowReconnection(client, this.rules.reconnectSeconds)
      const current = this.players.get(reconnected.sessionId)
      if (current) {
        current.connected = true
        current.connectionEpoch += 1
      }
      this.sendState()
      this.sendRecovery(reconnected)
    } catch {
      this.handleDisconnectFailure(player)
    }
  }

  onDispose() {
    this.finalizeSession('server_error')
    unregisterRoom(this.roomId)
  }

  getPublicStateForDebug() {
    return this.buildState('debug')
  }

  private handleInput(client: Client, payload: unknown) {
    const normalizedPayload = payload && typeof payload === 'object'
      ? Object.fromEntries(Object.entries(payload as Record<string, unknown>).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]))
      : payload
    const parsed = zClientMessage.safeParse(normalizedPayload)
    if (!parsed.success) return this.sendError(client, 'invalid_message', 'Message did not match the client protocol.')
    const player = this.players.get(client.sessionId)
    if (!player) return this.sendError(client, 'unknown_session', 'Session is not part of this room.')
    const message = parsed.data
    switch (message.type) {
      case 'ready': this.handleReady(player); break
      case 'selectChoice': this.handleChoice(client, player, message); break
      case 'stroke': this.handleStroke(client, player, message); break
      case 'undo': this.handleCanvasCommand(client, player, message, 'undo'); break
      case 'clearCanvas': this.handleCanvasCommand(client, player, message, 'clear'); break
      case 'guess': this.handleGuess(client, player, message); break
      case 'pass': this.handlePass(client, player, message); break
      case 'rematch': this.handleRematch(player); break
      case 'refreshProfile': void this.refreshPlayerProfile(player); break
    }
  }

  private async refreshPlayerProfile(player: PlayerState) {
    const account = await getAccountStore().getProfile(player.playerId)
    if (!account || account.status !== 'active') return
    player.displayName = account.displayName
    player.wallet = account.wallet
    player.ownedCosmetics = account.ownedCosmetics
    player.equippedCosmetics = account.equippedCosmetics
    this.sendState()
  }

  private handleReady(player: PlayerState) {
    if (this.phase !== 'WAITING' && this.phase !== 'READY_CHECK') return
    player.ready = true
    this.phase = 'READY_CHECK'
    this.readyDeadline ??= Date.now() + this.rules.readySeconds * 1000
    this.sendState()
    if (this.players.size === 2 && [...this.players.values()].every((entry) => entry.ready)) setTimeout(() => this.beginTurn(), 0)
  }

  private beginTurn() {
    if (this.players.size < 2 || this.phase === 'CLOSED' || [...this.players.values()].some((entry) => !entry.connected)) return
    if (this.turnIndex >= this.rules.turnsPerSession) {
      this.phase = 'RESULTS'
      this.rematchDeadline = Date.now() + this.rules.rematchSeconds * 1000
      this.finalizeSession('completed')
      this.sendState()
      return
    }
    const entries = [...this.players.values()]
    const drawer = entries[(this.turnIndex + this.openingDrawerIndex) % entries.length]
    for (const player of entries) {
      player.role = player.sessionId === drawer.sessionId ? 'drawer' : 'guesser'
      player.rematchVoted = false
    }
    const choices: TurnChoice[] = this.prompts.makeChoices().map((prompt) => ({
      id: this.prompts.makeChoiceToken(prompt),
      promptId: prompt.id,
      difficulty: prompt.difficulty,
      answer: normalizeAnswerText(prompt.canonicalAnswer),
      hint: `${slotCountFromAnswer(prompt.canonicalAnswer)} letters`,
    }))
    const now = Date.now()
    this.phase = 'SELECTING'
    this.turn = {
      id: `turn-${this.turnIndex + 1}-${now}`,
      index: this.turnIndex,
      drawerSessionId: drawer.sessionId,
      choices,
      phase: 'SELECTING',
      selectionDeadline: now + this.rules.selectionSeconds * 1000,
      countdownDeadline: 0,
      drawingDeadline: 0,
      revealDeadline: 0,
      board: [],
      slotPattern: [],
      slotCount: 0,
      outcome: null,
      resolutionId: null,
      boardGeneration: 0,
      lastGuessAt: 0,
      selectedLength: 0,
    }
    this.sendState()
    const privateChoices = {
      type: 'privateChoices' as const,
      turnId: this.turn.id,
      choices: choices.map((choice) => ({ id: choice.id, difficulty: choice.difficulty, promptHint: choice.hint })),
    }
    this.clients.find((client) => client.sessionId === drawer.sessionId)?.send('privateChoices', privateChoices)
  }

  private handleChoice(client: Client, player: PlayerState, message: { type: 'selectChoice'; turnId: string; choiceId: string; actionId: string }) {
    if (!this.turn || this.phase !== 'SELECTING' || player.role !== 'drawer') return this.sendError(client, 'wrong_role', 'Only the drawer can choose a prompt.')
    if (message.turnId !== this.turn.id) return
    if (Date.now() >= this.turn.selectionDeadline && message.actionId !== `auto-${this.turn.id}`) return this.selectChoiceAutomatically()
    if (this.wasSeen(message.actionId)) return
    const choice = this.turn.choices.find((entry) => entry.id === message.choiceId)
    if (!choice) return this.sendError(client, 'invalid_choice', 'That prompt choice is not available.')
    this.applyChoice(choice)
  }

  private applyChoice(choice: TurnChoice) {
    if (!this.turn) return
    this.turn.selectedChoice = choice
    this.turn.selectedLength = slotCountFromAnswer(choice.answer)
    this.turn.slotPattern = slotPatternFromAnswer(choice.answer)
    this.turn.slotCount = this.turn.selectedLength
    this.turn.board = this.makeBoard(choice.answer)
    this.canvasSequence = 0
    this.canvasStrokes = []
    this.acceptedPointCount = 0
    this.strokeWindowStartedAt = 0
    this.strokeWindowCount = 0
    this.phase = 'COUNTDOWN'
    this.turn.phase = 'COUNTDOWN'
    this.turn.countdownDeadline = Date.now() + this.rules.countdownSeconds * 1000
    this.sendState()
    this.clients.find((client) => client.sessionId === this.turn?.drawerSessionId)?.send('privatePrompt', { type: 'privatePrompt', turnId: this.turn.id, answer: choice.answer })
  }

  private handleStroke(client: Client, player: PlayerState, message: { type: 'stroke'; turnId: string; actionId: string; connectionEpoch: number; generation: number; tool: DrawTool; width: number; color: string; points: Array<{ x: number; y: number; pressure?: number }> }) {
    if (!this.canDraw(client, player, message.turnId, message.generation, message.connectionEpoch)) return
    if (this.seenActions.has(message.actionId)) return
    const ownedItems = COSMETIC_CATALOG.filter((item) => player.ownedCosmetics.includes(item.itemId))
    const allowedColor = ownedItems.some((item) => item.type === 'draw_color' && item.value.toLowerCase() === message.color.toLowerCase())
    const allowedWidth = ownedItems.some((item) => item.type === 'brush_size' && Number(item.value) === message.width)
    if (!allowedWidth || !allowedColor || !HEX_COLOR.test(message.color)) return this.sendError(client, 'invalid_stroke', 'Stroke style is not owned by this player.')
    if (message.points.some((point) => point.x < 0 || point.x > MAX_CANVAS_COORDINATE || point.y < 0 || point.y > MAX_CANVAS_COORDINATE || point.pressure !== undefined && (point.pressure < 0 || point.pressure > 1))) return this.sendError(client, 'invalid_stroke', 'Stroke points are outside the drawing board.')
    if (Buffer.byteLength(JSON.stringify(message), 'utf8') > MAX_STROKE_PAYLOAD_BYTES) return this.sendError(client, 'drawing_limit', 'That stroke is too large.')
    if (this.canvasStrokes.length >= MAX_STROKES_PER_TURN || this.acceptedPointCount + message.points.length > MAX_POINTS_PER_TURN) return this.sendError(client, 'drawing_limit', 'The drawing limit for this turn has been reached.')
    const now = Date.now()
    if (now - this.strokeWindowStartedAt >= 1000) {
      this.strokeWindowStartedAt = now
      this.strokeWindowCount = 0
    }
    if (this.strokeWindowCount >= MAX_STROKE_BATCHES_PER_SECOND) return this.sendError(client, 'drawing_rate_limited', 'Drawing is arriving too quickly.')
    this.wasSeen(message.actionId)
    this.strokeWindowCount += 1
    this.acceptedPointCount += message.points.length
    const event = { type: 'drawEvent' as const, turnId: message.turnId, generation: this.turn?.boardGeneration ?? 0, actorSessionId: client.sessionId, actionId: message.actionId, kind: 'stroke' as const, tool: message.tool, width: message.width, color: message.color, points: message.points, sequence: ++this.canvasSequence }
    this.canvasStrokes.push({ actionId: message.actionId, generation: event.generation, tool: message.tool, color: message.color, width: message.width, points: message.points })
    void getEvidenceStore().append(this.activeSessionId ?? this.roomId.toString(), message.turnId, { sequence: event.sequence, kind: 'stroke', data: event })
    this.broadcast('drawEvent', event)
  }

  private handleCanvasCommand(client: Client, player: PlayerState, message: { type: 'undo' | 'clearCanvas'; turnId: string; actionId: string; connectionEpoch: number; generation: number }, kind: 'undo' | 'clear') {
    if (!this.canDraw(client, player, message.turnId, message.generation, message.connectionEpoch) || this.wasSeen(message.actionId) || !this.turn) return
    if (kind === 'undo') {
      const removed = this.canvasStrokes.pop()
      if (removed) this.acceptedPointCount = Math.max(0, this.acceptedPointCount - removed.points.length)
    }
    else {
      this.turn.boardGeneration += 1
      this.canvasStrokes = []
      this.acceptedPointCount = 0
    }
    this.canvasSequence += 1
    void getEvidenceStore().append(this.activeSessionId ?? this.roomId.toString(), message.turnId, { sequence: this.canvasSequence, kind, data: { turnId: message.turnId, generation: this.turn.boardGeneration, actionId: message.actionId, kind, sequence: this.canvasSequence } })
    this.broadcast('drawEvent', { type: 'drawEvent', turnId: message.turnId, generation: this.turn.boardGeneration, actorSessionId: client.sessionId, actionId: message.actionId, kind, sequence: this.canvasSequence })
    this.broadcast('drawSnapshot', { type: 'drawSnapshot', turnId: message.turnId, generation: this.turn.boardGeneration, sequence: this.canvasSequence, strokes: this.canvasStrokes })
  }

  private handleGuess(client: Client, player: PlayerState, message: { type: 'guess'; turnId: string; actionId: string; connectionEpoch: number; selectedTileIds: string[] }) {
    if (!this.turn || this.phase !== 'DRAWING' || player.role !== 'guesser') return this.sendError(client, 'wrong_role', 'Only the guesser can submit guesses.')
    if (message.turnId !== this.turn.id || message.connectionEpoch !== player.connectionEpoch) return this.sendError(client, 'stale_action', 'The guessing action is stale.')
    if (this.wasSeen(message.actionId)) return
    const now = Date.now()
    if (now >= this.turn.drawingDeadline) return void this.resolveTurn('timeout')
    if (now - this.turn.lastGuessAt < this.rules.acceptedGuessIntervalMs) return
    this.turn.lastGuessAt = now
    const ids = new Set(message.selectedTileIds)
    const answer = this.turn.selectedChoice?.answer.replace(/ /g, '') ?? ''
    const tiles = new Map(this.turn.board.map((tile) => [tile.id, tile]))
    const guess = message.selectedTileIds.map((id) => tiles.get(id)?.letter ?? '').join('')
    const correct = ids.size === message.selectedTileIds.length && ids.size === this.turn.slotCount && !message.selectedTileIds.some((id) => !tiles.has(id)) && guess === answer
    this.broadcast('guess', { type: 'guess', turnId: message.turnId, correct })
    if (correct) this.resolveTurn('solved')
  }

  private handlePass(client: Client, player: PlayerState, message: { type: 'pass'; turnId: string; actionId: string; connectionEpoch: number }) {
    if (!this.turn || this.phase !== 'DRAWING' || player.role !== 'guesser') return this.sendError(client, 'wrong_role', 'Only the guesser can pass.')
    if (message.turnId !== this.turn.id || message.connectionEpoch !== player.connectionEpoch) return this.sendError(client, 'stale_action', 'The pass action is stale.')
    if (this.wasSeen(message.actionId)) return
    if (Date.now() >= this.turn.drawingDeadline) return void this.resolveTurn('timeout')
    this.resolveTurn('passed')
  }

  private handleRematch(player: PlayerState) {
    if (this.phase !== 'RESULTS') return
    player.rematchVoted = true
    if (![...this.players.values()].every((entry) => entry.rematchVoted && entry.connected)) return this.sendState()
    this.turn = null
    this.turnIndex = 0
    this.teamScore = 0
    this.solvedTurns = 0
    this.sessionCoinsPerPlayer = 0
    this.duoStreakCurrent = 0
    this.rematchDeadline = null
    this.readyDeadline = null
    this.openingDrawerIndex = 1 - this.openingDrawerIndex
    this.prompts.resetSession()
    this.sessionStarted = false
    this.sessionFinished = false
    this.endAfterReveal = false
    for (const entry of this.players.values()) entry.ready = true
    this.phase = 'READY_CHECK'
    void this.startRematch()
  }

  private async resolveTurn(outcome: TurnOutcome) {
    if (!this.turn || this.phase === 'RESOLVING' || this.phase === 'REVEAL' || this.phase === 'RESULTS') return
    const selected = this.turn.selectedChoice ?? this.turn.choices[0]
    this.turn.selectedChoice = selected
    this.phase = 'RESOLVING'
    this.turn.phase = 'RESOLVING'
    const entries = [...this.players.values()]
    const resolutionId = `resolution:${this.activeSessionId ?? this.roomId}:${this.turn.id}`
    const preview = { ...applyTurnOutcome(outcome, selected.difficulty, { duoStreakCurrent: this.duoStreakCurrent, duoStreakBest: this.duoStreakBest, solvedTurns: this.solvedTurns, playerWallets: {} }), resolutionId }
    let effectiveOutcome = outcome
    let persisted = null
    try {
      const accounts = await Promise.all(entries.map((entry) => getAccountStore().ensurePlayer(entry.userId)))
      const playerA = accounts[0]
      const playerB = accounts[1]
      const drawerEntry = entries.find((entry) => entry.sessionId === this.turn?.drawerSessionId)
      const drawer = accounts[drawerEntry ? entries.indexOf(drawerEntry) : 0]
      persisted = await getAccountStore().commitTurn({ resolutionId, turnId: this.turn.id, sessionId: this.activeSessionId ?? undefined, turnIndex: this.turn.index, drawer: drawer?.playerId ?? playerA.playerId, promptKey: selected.promptId, outcome, difficulty: selected.difficulty, playerA: playerA.playerId, playerB: playerB.playerId, rulesVersion: RULES_VERSION })
    } catch {
      effectiveOutcome = 'annulled'
    }
    this.turn.outcome = effectiveOutcome
    const fallback = { ...applyTurnOutcome(effectiveOutcome, selected.difficulty, { duoStreakCurrent: this.duoStreakCurrent, duoStreakBest: this.duoStreakBest, solvedTurns: this.solvedTurns, playerWallets: {} }), resolutionId }
    const resolved = effectiveOutcome === outcome ? preview : fallback
    this.turn.resolutionId = resolved.resolutionId
    this.teamScore += resolved.teamPointsAwarded
    if (effectiveOutcome === 'solved') {
      this.solvedTurns += 1
      this.sessionCoinsPerPlayer += resolved.coinsAwardedPerPlayer
      if (persisted) {
        entries[0].wallet = persisted.walletA
        entries[1].wallet = persisted.walletB
        resolved.currentDuoStreak = persisted.currentStreak
        resolved.bestDuoStreak = persisted.bestStreak
      }
    }
    this.duoStreakCurrent = resolved.currentDuoStreak
    this.duoStreakBest = resolved.bestDuoStreak
    this.phase = 'REVEAL'
    this.turn.phase = 'REVEAL'
    this.turn.revealDeadline = Date.now() + this.rules.revealSeconds * 1000
    this.broadcast('turnResolved', { type: 'turnResolved', turnId: this.turn.id, outcome: effectiveOutcome, selectedDifficulty: selected.difficulty, revealedAnswer: selected.answer, teamPointsAwarded: resolved.teamPointsAwarded, coinsAwardedPerPlayer: resolved.coinsAwardedPerPlayer, currentDuoStreak: resolved.currentDuoStreak, bestDuoStreak: resolved.bestDuoStreak })
    this.sendState()
  }

  private tick() {
    const now = Date.now()
    if (this.phase === 'READY_CHECK' && this.readyDeadline && now >= this.readyDeadline) return this.closeExpiredSession('ready_timeout')
    if (this.phase === 'RESULTS' && this.rematchDeadline && now >= this.rematchDeadline) return this.closeExpiredSession('rematch_expired')
    if (!this.turn) return
    if (this.phase === 'SELECTING' && now >= this.turn.selectionDeadline) return this.selectChoiceAutomatically()
    if (this.phase === 'COUNTDOWN' && now >= this.turn.countdownDeadline) {
      this.phase = 'DRAWING'
      this.turn.phase = 'DRAWING'
      this.turn.drawingDeadline = now + this.rules.drawingSeconds * 1000
      this.sendState()
      return this.broadcast('drawBank', { type: 'drawBank', turnId: this.turn.id, board: this.turn.board, slotPattern: this.turn.slotPattern, slotCount: this.turn.slotCount })
    }
    if (this.phase === 'DRAWING' && now >= this.turn.drawingDeadline) return this.resolveTurn('timeout')
    if (this.phase === 'REVEAL' && now >= this.turn.revealDeadline) {
      if (this.endAfterReveal) {
        this.phase = 'RESULTS'
        this.rematchDeadline = now + this.rules.rematchSeconds * 1000
        this.finalizeSession('abandoned')
        return this.sendState()
      }
      this.turnIndex += 1
      return this.beginTurn()
    }
  }

  private selectChoiceAutomatically() {
    if (!this.turn || this.phase !== 'SELECTING') return
    const player = this.players.get(this.turn.drawerSessionId)
    const choice = this.turn.choices[0]
    if (!player || !choice) return
    this.applyChoice(choice)
  }

  private canDraw(client: Client, player: PlayerState, turnId: string, generation: number, connectionEpoch: number) {
    if (!this.turn || this.phase !== 'DRAWING' || player.role !== 'drawer') {
      this.sendError(client, 'wrong_role', 'Only the drawer can draw.')
      return false
    }
    if (turnId !== this.turn.id || generation !== this.turn.boardGeneration || connectionEpoch !== player.connectionEpoch) {
      this.sendError(client, 'stale_action', 'The drawing action is stale.')
      return false
    }
    return true
  }

  private wasSeen(actionId: string) {
    if (this.seenActions.has(actionId)) return true
    if (this.seenActions.size >= MAX_SEEN_ACTIONS) {
      const oldest = this.seenActions.values().next().value as string | undefined
      if (oldest) this.seenActions.delete(oldest)
    }
    this.seenActions.add(actionId)
    return false
  }

  private makeBoard(answer: string): LetterTile[] {
    const board = answer.replace(/ /g, '').split('').map((letter) => ({ id: randomUUID(), letter, used: false }))
    for (let index = 0; index < 4; index += 1) board.push({ id: randomUUID(), letter: String.fromCharCode(65 + randomInt(0, 26)), used: false })
    for (let index = board.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      const tile = board[index]
      board[index] = board[swapIndex]
      board[swapIndex] = tile
    }
    return board
  }

  private sendState() {
    for (const client of this.clients) client.send('sessionState', { type: 'sessionState', state: this.buildState(client.sessionId) })
  }

  private buildState(sessionId: string): ServerMessageState['state'] {
    const now = Date.now()
    const activeTurn = this.turn ? {
      turnId: this.turn.id,
      turnIndex: this.turn.index,
      phase: this.phase,
      drawerSessionId: this.turn.drawerSessionId,
      selectedDifficulty: this.turn.selectedChoice?.difficulty ?? null,
      selectedPromptLength: this.turn.selectedLength,
      slotPattern: this.turn.slotPattern,
      slotCount: this.turn.slotCount,
      remainingMs: this.remainingMs(now),
      revealedAnswer: this.phase === 'REVEAL' || this.phase === 'RESULTS' ? this.turn.selectedChoice?.answer ?? null : null,
      outcome: this.turn.outcome,
      resolutionId: this.turn.resolutionId,
      boardGeneration: this.turn.boardGeneration,
      board: this.phase === 'REVEAL' || this.phase === 'RESULTS' ? this.turn.board : [],
    } : null
    return {
      roomCode: getCodeByRoom(this.roomId), phase: this.phase, sessionId: this.activeSessionId ?? this.roomId.toString(), turnsPerSession: this.rules.turnsPerSession, turnIndex: this.turnIndex,
      teamScore: this.teamScore, solvedTurns: this.solvedTurns, sessionCoinsPerPlayer: this.sessionCoinsPerPlayer, duoStreakCurrent: this.duoStreakCurrent, duoStreakBest: this.duoStreakBest,
      playerStates: [...this.players.values()].map((player) => ({ sessionId: player.sessionId, userId: player.playerId, role: player.role, wallet: player.sessionId === sessionId ? player.wallet : null, connected: player.connected, ready: player.ready, rematch: player.rematchVoted, displayName: player.displayName, appearance: player.equippedCosmetics })),
      activeTurn, rematchDeadline: this.rematchDeadline, startedAt: this.startedAt, version: `${CLIENT_BUILD_ID}:${RULES_VERSION}`,
    }
  }

  private remainingMs(now: number) {
    if (!this.turn) return 0
    if (this.phase === 'SELECTING') return Math.max(0, this.turn.selectionDeadline - now)
    if (this.phase === 'COUNTDOWN') return Math.max(0, this.turn.countdownDeadline - now)
    if (this.phase === 'DRAWING') return Math.max(0, this.turn.drawingDeadline - now)
    if (this.phase === 'REVEAL') return Math.max(0, this.turn.revealDeadline - now)
    return 0
  }

  private sendError(client: Client, code: string, message: string) {
    client.send('error', { type: 'error', code, message })
  }

  private sendRecovery(client: Client) {
    if (!this.turn || !this.turn.selectedChoice) return
    client.send('drawBank', { type: 'drawBank', turnId: this.turn.id, board: this.turn.board, slotPattern: this.turn.slotPattern, slotCount: this.turn.slotCount })
    client.send('drawSnapshot', { type: 'drawSnapshot', turnId: this.turn.id, generation: this.turn.boardGeneration, sequence: this.canvasSequence, strokes: this.canvasStrokes })
    if (client.sessionId === this.turn.drawerSessionId && this.phase !== 'REVEAL' && this.phase !== 'RESULTS') client.send('privatePrompt', { type: 'privatePrompt', turnId: this.turn.id, answer: this.turn.selectedChoice.answer })
  }

  private handleDisconnectFailure(player: PlayerState) {
    if (this.phase === 'REVEAL' || this.phase === 'RESULTS') {
      this.phase = 'RESULTS'
      this.rematchDeadline = Date.now() + this.rules.rematchSeconds * 1000
      this.finalizeSession('abandoned')
      this.sendState()
      return
    }
    if (this.phase === 'WAITING' || this.phase === 'READY_CHECK') {
      this.players.delete(player.sessionId)
      this.finalizeSession('abandoned')
      this.sessionStarted = false
      this.sessionFinished = false
      this.activeSessionId = null
      this.phase = 'WAITING'
      this.readyDeadline = null
      for (const entry of this.players.values()) entry.ready = false
      this.sendState()
      return
    }
    if (this.phase !== 'CLOSED') {
      this.endAfterReveal = true
      void this.resolveTurn('abandoned')
    }
  }

  private async startPersistentSession(playerA: string, playerB: string) {
    const sessionId = randomUUID()
    const progress = await getAccountStore().getDuoProgress(playerA, playerB, RULES_VERSION)
    await getAccountStore().startSession({ sessionId, playerA, playerB, entryContext: this.privateRoom ? 'private' : 'quick', protocolMajor: PROTOCOL_MAJOR, rulesVersion: RULES_VERSION, contentVersion: CLIENT_BUILD_ID })
    this.activeSessionId = sessionId
    this.startedAt = Date.now()
    this.sessionStarted = true
    this.sessionFinished = false
    this.duoStreakCurrent = progress.currentStreak
    this.duoStreakBest = progress.bestStreak
  }

  private async startRematch() {
    try {
      const entries = [...this.players.values()]
      await this.startPersistentSession(entries[0].playerId, entries[1].playerId)
      this.sendState()
      this.beginTurn()
    } catch {
      this.phase = 'ABORTED'
      this.sendState()
    }
  }

  private finalizeSession(status: 'completed' | 'abandoned' | 'server_error') {
    if (!this.sessionStarted || this.sessionFinished || !this.activeSessionId) return
    this.sessionFinished = true
    void getAccountStore().finishSession(this.activeSessionId, this.teamScore, status)
  }

  private closeExpiredSession(reason: string) {
    this.finalizeSession('abandoned')
    this.phase = 'CLOSED'
    this.sendState()
    for (const client of [...this.clients]) client.leave(4000, reason)
  }
}
