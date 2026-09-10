import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Client, Room } from 'colyseus.js'
import {
  type ServerMessage,
  type ServerMessageDrawEvent,
  type ServerMessageDrawBank,
  type ServerMessageDrawSnapshot,
  type SessionPublicState,
  type PlayerPublicState,
  type TurnOutcome,
  type TileSchema,
  type ServerMessagePrivateChoices,
  type ServerMessageGuess,
  type ServerMessageTurnResolved,
} from '@drawduo/protocol'
import { getClientRuntimeConfig } from '@drawduo/platform'
import './styles.css'

type DrawEvent = ServerMessageDrawEvent

type TurnChoice = {
  id: string
  difficulty: 1 | 2 | 3
}

type AppState = {
  room?: Room
  userId: string
  sessionId: string
}

type AccountProfile = {
  playerId: string
  displayName: string
  termsVersion: string | null
  wallet: number
  lifetimeCoins: number
  duoStreakCurrent: number
  duoStreakBest: number
}

type CatalogItem = { itemId: string; type: string; name: string; price: number; enabled: boolean }

const runtimeConfig = getClientRuntimeConfig()
const WS_URL = runtimeConfig.backendWsUrl
const API_BASE = runtimeConfig.backendHttpUrl

type StrokePoint = {
  x: number
  y: number
  pressure?: number
}

type Stroke = {
  generation: number
  tool: 'draw' | 'erase'
  color: string
  width: number
  points: StrokePoint[]
}

function phaseLabel(phase: SessionPublicState['phase']) {
  switch (phase) {
    case 'WAITING':
      return 'Waiting for players'
    case 'READY_CHECK':
      return 'Ready check'
    case 'SELECTING':
      return 'Select a word'
    case 'COUNTDOWN':
      return 'Get ready'
    case 'DRAWING':
      return 'Drawing in progress'
    case 'RESOLVING':
      return 'Scoring'
    case 'REVEAL':
      return 'Turn result'
    case 'RESULTS':
      return 'Session results'
    case 'ABORTED':
      return 'Session interrupted'
    default:
      return 'Starting'
  }
}

function parseMessage<T>(raw: unknown): T | null {
  return (raw as T) ?? null
}

function formatTime(ms: number) {
  const value = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(value / 60)
  const s = value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function App() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Idle')
  const [session, setSession] = useState<SessionPublicState | null>(null)
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [choices, setChoices] = useState<TurnChoice[]>([])
  const [drawBank, setDrawBank] = useState<TileSchema[]>([])
  const [slotPattern, setSlotPattern] = useState<number[]>([])
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([])
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null)
  const [lastTurnReveal, setLastTurnReveal] = useState<ServerMessageTurnResolved | null>(null)
  const [mute, setMute] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [appState, setAppState] = useState<AppState>({ userId: '', sessionId: '' })
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [showShop, setShowShop] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState('')
  const [safetyMessage, setSafetyMessage] = useState<string | null>(null)
  const connectionEpochRef = useRef(1)
  const intentionalLeaveRef = useRef(false)
  const reconnectingRef = useRef(false)

  const clientRef = useRef<Client | null>(null)
  const roomRef = useRef<Room | null>(null)
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const boardSizeRef = useRef(512)

  const drawing = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const pointsRef = useRef<StrokePoint[]>([])
  const strokeHistoryRef = useRef<Stroke[]>([])
  const boardGenerationRef = useRef(0)
  const drawStateRef = useRef({
    color: '#1a73ff',
    width: 12,
    tool: 'draw' as 'draw' | 'erase',
  })

  const localUserId = useMemo(() => {
    const existing = window.localStorage.getItem('draw-duo-user-id')
    if (existing) {
      return existing
    }
    const created = crypto.randomUUID()
    window.localStorage.setItem('draw-duo-user-id', created)
    return created
  }, [])

  const mySessionId = appState.sessionId
  const localPlayer = session?.playerStates.find((entry) => entry.sessionId === mySessionId)
  const partner = session?.playerStates.find((entry) => entry.sessionId !== mySessionId)
  const isDrawer = localPlayer?.role === 'drawer'
  const connectedCount = session?.playerStates.filter((entry) => entry.connected).length ?? 0
  const roomCode = session?.roomCode ?? (roomCodeInput || null)

  const rematchTargetMs = session?.rematchDeadline ?? null
  const rematchCountdown = rematchTargetMs ? rematchTargetMs - Date.now() : null

  useEffect(() => {
    if (appState.userId === '' && localUserId) {
      setAppState((state) => ({ ...state, userId: localUserId }))
    }
  }, [localUserId, appState.userId])

  useEffect(() => {
    if (!appState.userId) return
    let active = true
    void fetch(`${API_BASE}/api/account/me`, { headers: { 'x-draw-duo-user': appState.userId } })
      .then((response) => response.ok ? response.json() : null)
      .then((account: AccountProfile | null) => { if (active) setProfile(account) })
      .catch(() => undefined)
    return () => { active = false }
  }, [appState.userId])

  const getCanvasContext = useCallback(() => {
    const canvas = localCanvasRef.current
    if (!canvas) {
      return null
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }

    const size = Math.min(540, canvas.clientWidth)
    boardSizeRef.current = size
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size
      canvas.height = size
    }

    return { canvas, ctx }
  }, [])

  const drawPath = useCallback((points: StrokePoint[], color: string, width: number, tool: 'draw' | 'erase') => {
    const drawingContext = getCanvasContext()
    if (!drawingContext) {
      return
    }
    const { ctx } = drawingContext
    if (points.length === 0) {
      return
    }
    const last = points[0]
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    }
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i]
      ctx.lineTo(point.x, point.y)
    }
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }, [getCanvasContext])

  const resetCanvas = useCallback(() => {
    const drawingContext = getCanvasContext()
    if (!drawingContext) {
      return
    }
    drawingContext.ctx.clearRect(0, 0, drawingContext.canvas.width, drawingContext.canvas.height)
    drawingContext.ctx.fillStyle = '#fff'
    drawingContext.ctx.fillRect(0, 0, drawingContext.canvas.width, drawingContext.canvas.height)
  }, [getCanvasContext])

  const rerenderFromHistory = useCallback(() => {
    resetCanvas()
    const valid = [...strokeHistoryRef.current]
    for (const stroke of valid) {
      if (stroke.points.length > 0) {
        drawPath(stroke.points, stroke.color, stroke.width, stroke.tool)
      }
    }
  }, [drawPath, resetCanvas])

  const applyRemoteEvent = useCallback((event: DrawEvent) => {
    if (!session || !session.activeTurn || event.turnId !== session.activeTurn.turnId) {
      return
    }
    if (event.generation < boardGenerationRef.current) {
      return
    }

    if (event.kind === 'clear') {
      boardGenerationRef.current = event.generation
      strokeHistoryRef.current = []
      resetCanvas()
      return
    }

    if (event.kind === 'undo') {
      boardGenerationRef.current = event.generation
      strokeHistoryRef.current.pop()
      rerenderFromHistory()
      return
    }

    if (!event.points || event.points.length === 0) {
      return
    }
    if (event.tool && event.color && event.width) {
      boardGenerationRef.current = event.generation
      strokeHistoryRef.current.push({
        generation: event.generation,
        tool: event.tool,
        color: event.color,
        width: event.width,
        points: event.points,
      })
      drawPath(event.points, event.color, event.width, event.tool)
    }
  }, [drawPath, resetCanvas, rerenderFromHistory, session])

  const sendMessage = useCallback((payload: unknown) => {
    const room = roomRef.current
    if (!room) {
      return
    }
    room.send('input', payload)
  }, [])

  const sendStroke = useCallback((points: StrokePoint[]) => {
    if (!connected || !session?.activeTurn || !isDrawer) {
      return
    }
    const batchSize = 64
    const generation = session.activeTurn.boardGeneration
    for (let i = 0; i < points.length; i += batchSize) {
      const chunk = points.slice(i, i + batchSize)
      if (chunk.length < 2) {
        continue
      }
      const actionId = crypto.randomUUID()
      const payload = {
        type: 'stroke',
        turnId: session.activeTurn.turnId,
        actionId,
        connectionEpoch: connectionEpochRef.current,
        generation,
        tool: drawStateRef.current.tool,
        color: drawStateRef.current.color,
        width: drawStateRef.current.width,
        points: chunk,
        timestamp: Date.now(),
      }
      sendMessage(payload)

      strokeHistoryRef.current.push({
        generation,
        tool: drawStateRef.current.tool,
        color: drawStateRef.current.color,
        width: drawStateRef.current.width,
        points: chunk,
      })
      drawPath(chunk, drawStateRef.current.color, drawStateRef.current.width, drawStateRef.current.tool)
    }
  }, [connected, drawPath, isDrawer, sendMessage, session])

  const sendUndo = useCallback(() => {
    if (!session?.activeTurn || !isDrawer || !connected) {
      return
    }
    sendMessage({
      type: 'undo',
      turnId: session.activeTurn.turnId,
      actionId: crypto.randomUUID(),
      connectionEpoch: connectionEpochRef.current,
      generation: session.activeTurn.boardGeneration,
    })
  }, [connected, isDrawer, sendMessage, session])

  const sendClear = useCallback(() => {
    if (!session?.activeTurn || !isDrawer || !connected) {
      return
    }
    sendMessage({
      type: 'clearCanvas',
      turnId: session.activeTurn.turnId,
      actionId: crypto.randomUUID(),
      connectionEpoch: connectionEpochRef.current,
      generation: session.activeTurn.boardGeneration,
    })
  }, [connected, isDrawer, sendMessage, session])

  const setReady = useCallback(() => {
    if (!connected) {
      return
    }
    sendMessage({ type: 'ready' })
  }, [connected, sendMessage])

  const selectChoice = useCallback((choiceId: string) => {
    if (!session?.activeTurn || session.phase !== 'SELECTING' || !isDrawer) {
      return
    }
    sendMessage({
      type: 'selectChoice',
      turnId: session.activeTurn.turnId,
      choiceId,
      actionId: crypto.randomUUID(),
    })
  }, [isDrawer, sendMessage, session])

  const submitGuess = useCallback(() => {
    if (!session?.activeTurn || !session.activeTurn || !session.activeTurn.turnId || isDrawer || !connected) {
      return
    }
    if (selectedTileIds.length !== session.activeTurn.slotCount) {
      setGuessFeedback('Fill all slots first')
      return
    }
    sendMessage({
      type: 'guess',
      turnId: session.activeTurn.turnId,
      selectedTileIds,
      actionId: crypto.randomUUID(),
      timestamp: Date.now(),
      connectionEpoch: connectionEpochRef.current,
    })
  }, [connected, isDrawer, selectedTileIds, sendMessage, session])

  const sendPass = useCallback(() => {
    if (!session?.activeTurn || isDrawer || !connected) {
      return
    }
    sendMessage({
      type: 'pass',
      turnId: session.activeTurn.turnId,
      actionId: crypto.randomUUID(),
      timestamp: Date.now(),
      connectionEpoch: connectionEpochRef.current,
    })
  }, [connected, isDrawer, sendMessage, session])

  const requestRematch = useCallback(() => {
    sendMessage({ type: 'rematch' })
  }, [sendMessage])

  const leaveRoom = useCallback(() => {
    intentionalLeaveRef.current = true
    roomRef.current?.leave()
    roomRef.current = null
    setSession(null)
    setConnected(false)
    setStatus('Left session')
    setChoices([])
    setDrawBank([])
    setSlotPattern([])
    setSelectedTileIds([])
  }, [])

  const setBoardFromSession = useCallback((next: SessionPublicState | null) => {
    if (!next?.activeTurn) {
      setChoices([])
      setDrawBank([])
      setSlotPattern([])
      setSelectedTileIds([])
      setStatus('Waiting')
      return
    }

    boardGenerationRef.current = next.activeTurn.boardGeneration

    if (next.phase === 'RESULTS') {
      setStatus('Session result')
      return
    }

    if (next.phase === 'SELECTING') {
      setStatus('Choice selection running')
      return
    }

    if (next.phase === 'COUNTDOWN') {
      setStatus('Countdown active')
      return
    }

    if (next.phase === 'DRAWING') {
      setStatus('Drawing')
    }

    if (next.phase === 'REVEAL') {
      setStatus('Revealing')
    }
  }, [])

  const onSessionState = useCallback((next: SessionPublicState) => {
    setSession((current) => {
      if (!current || current.activeTurn?.turnId !== next.activeTurn?.turnId) {
        setSelectedTileIds([])
      }
      if (!next?.activeTurn) {
        setDrawBank([])
        setSlotPattern([])
      }
      return next
    })
    setBoardFromSession(next)
  }, [setBoardFromSession])

  const wireRoomEvents = useCallback((room: Room) => {
    room.onMessage('sessionState', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessage & { state?: SessionPublicState }>(message)
      const state = (parsed as { state: SessionPublicState })?.state
      if (state) {
        onSessionState(state)
      }
    })

    room.onMessage('privateChoices', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessagePrivateChoices>(message)
      if (parsed?.choices?.length) {
        setChoices(parsed.choices.map((choice) => ({
          id: choice.id,
          difficulty: choice.difficulty,
        })))
      }
    })

    room.onMessage('drawBank', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessageDrawBank>(message)
      if (!parsed) {
        return
      }
      setDrawBank(parsed.board)
      setSlotPattern(parsed.slotPattern)
      setSelectedTileIds([])
      if (parsed.board.length > 0) {
        strokeHistoryRef.current = []
        resetCanvas()
      }
    })

    room.onMessage('drawEvent', (message: ServerMessage) => {
      const parsed = parseMessage<DrawEvent>(message)
      if (parsed) {
        applyRemoteEvent(parsed)
      }
    })

    room.onMessage('drawSnapshot', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessageDrawSnapshot>(message)
      if (!parsed) return
      boardGenerationRef.current = parsed.generation
      strokeHistoryRef.current = parsed.strokes.map((stroke) => ({ generation: stroke.generation, tool: stroke.tool, color: stroke.color, width: stroke.width, points: stroke.points }))
      resetCanvas()
      for (const stroke of parsed.strokes) drawPath(stroke.points, stroke.color, stroke.width, stroke.tool)
    })

    room.onMessage('guess', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessageGuess>(message)
      if (!parsed) {
        return
      }
      setGuessFeedback(parsed.correct ? 'Correct' : 'Wrong guess')
    })

    room.onMessage('turnResolved', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessageTurnResolved>(message)
      if (!parsed) {
        return
      }
      setLastTurnReveal(parsed)
      setGuessFeedback(`Turn ${parsed.outcome}`)
      setSelectedTileIds([])
    })

    room.onMessage('error', (message: ServerMessage) => {
      const parsed = parseMessage<{ code: string; message: string }>(message)
      if (parsed?.message) {
        setError(parsed.message)
      }
    })

    room.onLeave(async () => {
      if (intentionalLeaveRef.current || reconnectingRef.current) {
        return
      }

      reconnectingRef.current = true
      setStatus('Reconnecting')
      try {
        const nextRoom = await clientRef.current?.reconnect(room.reconnectionToken)
        if (!nextRoom) {
          leaveRoom()
          return
        }

        connectionEpochRef.current += 1
        roomRef.current = nextRoom
        wireRoomEvents(nextRoom)
        setConnected(true)
        setStatus('Reconnected')
      } catch {
        leaveRoom()
      } finally {
        reconnectingRef.current = false
      }
    })
  }, [applyRemoteEvent, drawBank.length, drawPath, leaveRoom, onSessionState, resetCanvas])

  const joinByRoomId = useCallback(async (roomId: string, suppliedRoomCode = roomCodeInput) => {
    try {
      intentionalLeaveRef.current = false
      const client = clientRef.current ?? new Client(WS_URL)
      clientRef.current = client
      setStatus('Connecting')
      const room = await client.joinById(roomId, {
        roomCode: suppliedRoomCode,
        userId: appState.userId,
        authToken: import.meta.env.VITE_SUPABASE_ACCESS_TOKEN,
        buildId: runtimeConfig.buildId,
        protocolMajor: runtimeConfig.protocolMajor,
        language: 'en',
        platformId: runtimeConfig.platformId,
        capabilities: runtimeConfig.capabilities,
      })
      roomRef.current = room
      setAppState((state) => ({ ...state, sessionId: room.sessionId, userId: appState.userId }))
      setConnected(true)
      wireRoomEvents(room)
      room.onError((code, message) => {
        setError(`${code}: ${message}`)
      })
      setStatus('Connected')
      setError(null)
    } catch (err) {
      setError(`Join failed: ${(err as Error).message}`)
      setStatus('Join failed')
    }
  }, [appState.userId, roomCodeInput, wireRoomEvents])

  const callApi = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-draw-duo-user': appState.userId,
        ...init.headers,
      },
      ...init,
    })
    const json = res.status === 204 ? null : await res.json()
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`)
    }
    return json as T
  }, [appState.userId])

  const acceptTerms = useCallback(async () => {
    try {
      const next = await callApi<AccountProfile>('/api/account/terms', { method: 'POST', body: JSON.stringify({ termsVersion: 'alpha-2026-09' }) })
      setProfile(next)
    } catch (err) {
      setError(`Terms update failed: ${(err as Error).message}`)
    }
  }, [callApi])

  const openShop = useCallback(async () => {
    try {
      const next = await callApi<{ items: CatalogItem[] }>('/api/progression/catalog')
      setCatalog(next.items)
      setShowShop(true)
    } catch (err) {
      setError(`Catalog unavailable: ${(err as Error).message}`)
    }
  }, [callApi])

  const saveProfile = useCallback(async () => {
    try {
      const next = await callApi<AccountProfile>('/api/account/profile', { method: 'PATCH', body: JSON.stringify({ displayName: profileDraft.trim() }) })
      setProfile(next)
      setEditingProfile(false)
    } catch (err) {
      setError(`Profile update failed: ${(err as Error).message}`)
    }
  }, [callApi, profileDraft])

  const purchaseItem = useCallback(async (itemId: string) => {
    try {
      await callApi('/api/progression/purchase', { method: 'POST', body: JSON.stringify({ itemId, requestId: crypto.randomUUID() }) })
      setProfile(await callApi<AccountProfile>('/api/account/me'))
    } catch (err) {
      setError(`Purchase failed: ${(err as Error).message}`)
    }
  }, [callApi])

  const hideAndLeave = useCallback(() => {
    resetCanvas()
    leaveRoom()
  }, [leaveRoom, resetCanvas])

  const reportPartner = useCallback(async () => {
    if (!partner) return
    try {
      await callApi('/api/safety/report', { method: 'POST', body: JSON.stringify({ subjectPlayerId: partner.userId, category: 'other', sessionId: session?.sessionId, turnId: session?.activeTurn?.turnId }) })
      setSafetyMessage('Report submitted. The drawing was hidden and the session was closed.')
      hideAndLeave()
    } catch (err) {
      setError(`Report failed: ${(err as Error).message}`)
    }
  }, [callApi, hideAndLeave, partner, session])

  const blockPartner = useCallback(async () => {
    if (!partner) return
    try {
      await callApi('/api/safety/block', { method: 'POST', body: JSON.stringify({ blockedPlayerId: partner.userId }) })
      setSafetyMessage('Partner blocked. The drawing was hidden and the session was closed.')
      hideAndLeave()
    } catch (err) {
      setError(`Block failed: ${(err as Error).message}`)
    }
  }, [callApi, hideAndLeave, partner])

  const createPrivateRoom = useCallback(async () => {
    const payload = await callApi<{ roomId: string; roomCode: string }>(`/api/lobby/private/create`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    setRoomCodeInput(payload.roomCode)
    await joinByRoomId(payload.roomId, payload.roomCode)
  }, [callApi, joinByRoomId])

  const joinPrivateRoom = useCallback(async () => {
    if (!roomCodeInput.trim()) {
      setError('Enter a room code')
      return
    }
    const payload = await callApi<{ roomId: string; roomCode: string }>(`/api/lobby/private/join`, {
      method: 'POST',
      body: JSON.stringify({ code: roomCodeInput.trim() }),
    })
    await joinByRoomId(payload.roomId)
  }, [callApi, roomCodeInput, joinByRoomId])

  const startQuick = useCallback(async () => {
    const payload = await callApi<{ roomId: string; roomCode: string | null }>(`/api/match/quick`, {
      method: 'POST',
      body: JSON.stringify({ userId: appState.userId, buildId: runtimeConfig.buildId, protocolMajor: runtimeConfig.protocolMajor, language: 'en', platformId: runtimeConfig.platformId, capabilities: runtimeConfig.capabilities }),
    })
    await joinByRoomId(payload.roomId)
  }, [appState.userId, callApi, joinByRoomId])

  const applyPointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = localCanvasRef.current
    if (!canvas) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * boardSizeRef.current,
      y: ((event.clientY - rect.top) / rect.height) * boardSizeRef.current,
      pressure: event.pressure,
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !connected || session?.phase !== 'DRAWING') {
      return
    }
    if (pointerIdRef.current !== null) {
      return
    }

    const canvas = localCanvasRef.current
    if (!canvas) {
      return
    }

    const point = applyPointerPosition(event)
    if (!point) {
      return
    }

    drawing.current = true
    pointerIdRef.current = event.pointerId
    pointsRef.current = [point]
    if (canvas) {
      canvas.setPointerCapture(event.pointerId)
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !connected || session?.phase !== 'DRAWING') {
      return
    }
    if (!drawing.current || pointerIdRef.current !== event.pointerId) {
      return
    }

    const point = applyPointerPosition(event)
    if (!point) {
      return
    }

    const lastPoint = pointsRef.current.at(-1)
    if (!lastPoint) {
      pointsRef.current = [point]
      return
    }

    pointsRef.current.push(point)

    if (lastPoint && pointsRef.current.length % 2 === 0) {
      drawPath(pointsRef.current.slice(-2), drawStateRef.current.color, drawStateRef.current.width, drawStateRef.current.tool)
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || pointerIdRef.current !== event.pointerId) {
      return
    }
    if (pointsRef.current.length > 1) {
      sendStroke(pointsRef.current)
    }
    pointerIdRef.current = null
    drawing.current = false
    pointsRef.current = []
    if (localCanvasRef.current) {
      localCanvasRef.current.releasePointerCapture(event.pointerId)
    }
  }

  const onPointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    pointerIdRef.current = null
    drawing.current = false
    pointsRef.current = []
  }

  const chooseTile = (tileId: string) => {
    if (!session?.activeTurn || isDrawer || !session.phase || selectedTileIds.includes(tileId)) {
      return
    }
    if (!session.activeTurn.slotCount) {
      return
    }
    if (selectedTileIds.length >= session.activeTurn.slotCount) {
      return
    }
    const tile = drawBank.find((entry) => entry.id === tileId)
    if (!tile) {
      return
    }
    setSelectedTileIds((current) => [...current, tileId])
    setGuessFeedback(null)
  }

  const removeTileAt = (index: number) => {
    if (index < 0 || index >= selectedTileIds.length) {
      return
    }
    setSelectedTileIds((current) => current.filter((_, valueIndex) => valueIndex !== index))
  }

  const clearGuess = () => {
    if (selectedTileIds.length === 0) {
      return
    }
    setSelectedTileIds([])
  }

  const backspaceAction = () => {
    setSelectedTileIds((current) => current.slice(0, -1))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!session || !session.activeTurn || isDrawer || session.phase !== 'DRAWING') {
        return
      }

      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      if (event.key === 'Enter') {
        submitGuess()
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        backspaceAction()
        return
      }

      if (event.key === ' ') {
        clearGuess()
        return
      }

      const upper = event.key.toUpperCase()
      if (upper.length !== 1 || upper < 'A' || upper > 'Z') {
        return
      }
      const freeTile = drawBank.find((tile) => tile.letter === upper && !selectedTileIds.includes(tile.id))
      if (!freeTile) {
        setGuessFeedback('No matching tile')
        return
      }
      chooseTile(freeTile.id)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [chooseTile, clearGuess, isDrawer, session, selectedTileIds, submitGuess])

  const groupedSlots = useMemo(() => {
    if (!slotPattern.length) {
      return [selectedTileIds.map((id) => drawBank.find((tile) => tile.id === id) ?? null)]
    }
    const groups: (string | null)[][] = []
    let cursor = 0
    for (const size of slotPattern) {
      const ids = selectedTileIds.slice(cursor, cursor + size)
      groups.push(ids.map((tileId) => tileId))
      cursor += size
    }
    return groups
  }, [drawBank, selectedTileIds, slotPattern])

  const availableTiles = useMemo(() => {
    return drawBank.filter((tile) => !selectedTileIds.includes(tile.id))
  }, [drawBank, selectedTileIds])

  return (
    <div className="app">
      <header>
        <div>
          <h1>Draw Duo - Phase 3</h1>
          <p className="info muted">Active model: gpt-5.3-codex-spark in this session.</p>
        </div>
        <div className="controls">
          <label>
            <input type="checkbox" checked={mute} onChange={(event) => setMute(event.target.checked)} />
            Mute
          </label>
          <label>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            Reduced motion
          </label>
          {connected && <button onClick={leaveRoom}>Leave</button>}
        </div>
      </header>

      {profile && (
        <section className="account-strip" aria-label="Account and progression">
          {editingProfile ? (
            <>
              <input value={profileDraft} maxLength={32} onChange={(event) => setProfileDraft(event.target.value)} aria-label="Display name" />
              <button onClick={saveProfile}>Save name</button>
              <button onClick={() => setEditingProfile(false)}>Cancel</button>
            </>
          ) : (
            <>
              <span className="account-name">{profile.displayName}</span>
              <button onClick={() => { setProfileDraft(profile.displayName); setEditingProfile(true) }}>Edit name</button>
            </>
          )}
          <span>{profile.wallet} coins</span>
          <span>Lifetime {profile.lifetimeCoins}</span>
          <span>Duo streak {profile.duoStreakCurrent} (best {profile.duoStreakBest})</span>
          {!profile.termsVersion && <button onClick={acceptTerms}>Accept alpha terms</button>}
          <button onClick={openShop}>Cosmetics</button>
        </section>
      )}

      {showShop && (
        <section className="shop-panel" aria-label="Cosmetic catalog">
          <div className="controls"><strong>Earn-only cosmetics</strong><button onClick={() => setShowShop(false)}>Close</button></div>
          {catalog.map((item) => (
            <div className="shop-item" key={item.itemId}>
              <span>{item.name}</span><span>{item.price} coins</span>
              <button onClick={() => purchaseItem(item.itemId)} disabled={!profile || profile.wallet < item.price}>Purchase</button>
            </div>
          ))}
        </section>
      )}

      {error && <p className="muted" role="alert">{error}</p>}
      {safetyMessage && <p className="info" role="status">{safetyMessage}</p>}
      {status && <p className="info">Status: {status}</p>}

      {!connected ? (
        <section>
          <div className="controls">
            <button onClick={startQuick} data-testid="quick-join">Quick Partner</button>
            <button onClick={createPrivateRoom} data-testid="create-private">Create Invite</button>
          </div>
          <div className="controls">
            <input
              value={roomCodeInput}
              onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
              placeholder="Enter 6-char code"
              maxLength={6}
            />
            <button onClick={joinPrivateRoom} data-testid="join-private">Join Invite</button>
          </div>
          <p className="info">
            Practice locally in the canvas above.
          </p>
        </section>
      ) : (
        <section>
          <div className="info">
            <p>
              Code: <strong>{roomCode ?? '(private code unavailable)'}</strong> • Players:
              {' '}
              {connectedCount}
            </p>
            <p>{phaseLabel(session?.phase ?? 'WAITING')} • {session ? formatTime(session?.activeTurn?.remainingMs ?? 0) : '0:00'}</p>
            <p>
              Team Score: {session?.teamScore ?? 0} • Session solved: {session?.solvedTurns ?? 0}/{session?.turnsPerSession ?? 8}
              {' '}
              • Streak {session?.duoStreakCurrent ?? 0} (best {session?.duoStreakBest ?? 0})
            </p>
            <p>
              You: {localPlayer?.wallet ?? 0} coins • Partner: {
                session?.playerStates
                  .filter((entry: PlayerPublicState) => entry.sessionId !== mySessionId)
                  .map((entry) => entry.wallet)
                  .join('')
              } coins
            </p>
          </div>

          <div className="layout">
            <section className="canvas-box">
              <canvas
                ref={localCanvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                data-testid="draw-canvas"
                aria-label="Drawing canvas"
              />
              <div className="controls">
                <label>
                  Brush
                  <select
                    value={drawStateRef.current.width}
                    onChange={(event) => {
                      const width = Number(event.target.value)
                      drawStateRef.current.width = width
                    }}
                  >
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                  </select>
                </label>
                <label>
                  <select
                    value={drawStateRef.current.color}
                    onChange={(event) => {
                      drawStateRef.current.color = event.target.value
                    }}
                  >
                    <option value="#1a73ff">Blue</option>
                    <option value="#111">Black</option>
                    <option value="#c62828">Red</option>
                    <option value="#2e7d32">Green</option>
                    <option value="#f57c00">Orange</option>
                    <option value="#6a1b9a">Purple</option>
                  </select>
                  Palette
                </label>
                {isDrawer && (
                  <>
                    <button onClick={() => drawStateRef.current.tool = 'erase'}>Eraser</button>
                    <button onClick={() => drawStateRef.current.tool = 'draw'}>Brush</button>
                    <button onClick={sendUndo} disabled={session?.phase !== 'DRAWING'}>Undo</button>
                    <button onClick={sendClear} disabled={session?.phase !== 'DRAWING'}>Clear</button>
                  </>
                )}
                {!isDrawer && (
                  <button onClick={sendPass} disabled={session?.phase !== 'DRAWING'}>Pass</button>
                )}
              </div>
            </section>

            <aside className="sidebar">
              {session?.phase === 'READY_CHECK' && (
                <div className="word-banks">
                  <p className="info">Both players must ready up.</p>
                  <button onClick={setReady}>Ready</button>
                </div>
              )}

              {session?.phase === 'SELECTING' && isDrawer && (
                <div className="word-banks">
                  <p>Pick one difficulty:</p>
                  <div className="choice-grid">
                    {choices.length === 0 && <p>No choices yet.</p>}
                    {choices.map((choice) => (
                      <button
                        key={choice.id}
                        onClick={() => selectChoice(choice.id)}
                        data-testid={`choice-${choice.difficulty}`}
                      >
                        Difficulty {choice.difficulty}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {session?.phase === 'SELECTING' && !isDrawer && (
                <div className="word-banks">
                  <p>Waiting for drawer choice...</p>
                </div>
              )}

              {session?.phase === 'DRAWING' && (
                <div className="word-banks">
                  <p>Slots</p>
                  <div className="slots">
                    {slotPattern.length === 0 ? (
                      <p className="muted">Waiting for active bank</p>
                    ) : (
                      groupedSlots.map((group, groupIndex) => (
                        <div key={`${groupIndex}`}>
                          {group.map((tileId, slotIndex) => {
                            const absoluteSlot = (session?.activeTurn?.slotPattern.slice(0, groupIndex).reduce((sum, section) => sum + section, 0) || 0) + slotIndex
                            return (
                              <button
                                key={`${groupIndex}-${slotIndex}`}
                                className="slot"
                                onClick={() => removeTileAt(absoluteSlot)}
                                data-testid={`slot-${absoluteSlot}`}
                              >
                                {tileId ? drawBank.find((entry) => entry.id === tileId)?.letter : '•'}
                              </button>
                            )
                          })}
                          <span className="muted"> </span>
                        </div>
                      ))
                    )}
                  </div>

                  <p>
                    Tiles
                  </p>
                  <div className="tile-grid">
                    {availableTiles.map((tile) => (
                      <button
                        key={tile.id}
                        className="tile"
                        disabled={selectedTileIds.includes(tile.id)}
                        onClick={() => chooseTile(tile.id)}
                        data-testid={`tile-${tile.id}`}
                      >
                        {tile.letter}
                      </button>
                    ))}
                  </div>

                  <div className="controls">
                    <button onClick={backspaceAction}>Backspace</button>
                    <button onClick={clearGuess}>Clear Answer</button>
                    <button onClick={submitGuess} disabled={selectedTileIds.length !== (session.activeTurn?.slotCount ?? 0)}>
                      Submit
                    </button>
                  </div>
                  {guessFeedback && <p className="info">{guessFeedback}</p>}
                </div>
              )}

              {session?.phase === 'REVEAL' && lastTurnReveal && (
                <div className="word-banks">
                  <p>
                    Turn {lastTurnReveal.outcome}: +{lastTurnReveal.teamPointsAwarded} team / +{lastTurnReveal.coinsAwardedPerPlayer} each
                  </p>
                  <p>Answer: {lastTurnReveal.revealedAnswer}</p>
                </div>
              )}

              {session?.phase === 'RESULTS' && (
                <div className="word-banks">
                  <p className="info">Session complete.</p>
                  <p>Rematch or close and requeue.</p>
                  <div className="controls">
                    <button onClick={requestRematch}>Rematch</button>
                    <button onClick={leaveRoom}>Close</button>
                    {partner && <button onClick={reportPartner}>Report partner</button>}
                    {partner && <button onClick={blockPartner}>Block partner</button>}
                  </div>
                  {rematchCountdown && rematchCountdown > 0 ? (
                    <p className="muted">Rematch window: {formatTime(rematchCountdown)}</p>
                  ) : null}
                </div>
              )}

              <p className="muted" role="status">You are: {localPlayer?.role ?? 'Unknown'}</p>
              {partner && session?.phase !== 'RESULTS' && <div className="controls"><button onClick={hideAndLeave}>Hide drawing and leave</button><button onClick={reportPartner}>Report and leave</button><button onClick={blockPartner}>Block and leave</button></div>}
            </aside>
          </div>
        </section>
      )}

      <section className="info muted" style={{ marginTop: '0.7rem' }}>
        <p>
          Public tests are run with headless browser sessions against localhost. Keep both local windows using independent contexts.
        </p>
      </section>
    </div>
  )
}

export default App
