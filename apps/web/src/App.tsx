import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
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
  type ServerMessagePrivatePrompt,
  type ServerMessageGuess,
  type ServerMessageTurnResolved,
  COSMETIC_CATALOG,
  STARTER_COSMETIC_IDS,
  cosmeticById,
  type CosmeticCatalogItem,
  type CosmeticEquipSlot,
} from '@drawduo/protocol'
import { getClientRuntimeConfig } from '@drawduo/platform'
import { getAuthUser, getClientAccessToken, neonAuthConfigured, signInWithEmail, signOutNeonAuth, signUpWithEmail, type AuthUser } from './auth'
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
  ownedCosmetics: string[]
  equippedCosmetics: Record<string, string>
}

type CatalogItem = CosmeticCatalogItem

const DRAW_COLORS = COSMETIC_CATALOG.filter((item) => item.type === 'draw_color')
const BRUSH_SIZES = COSMETIC_CATALOG.filter((item) => item.type === 'brush_size')
const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const
const DRAWING_DURATION_MS = 60_000

function difficultyLabel(difficulty: TurnChoice['difficulty']) {
  if (difficulty === 1) return 'Easy'
  if (difficulty === 2) return 'Medium'
  return 'Difficult'
}

function answerGroups(answer: string) {
  return answer.trim().toUpperCase().split(/\s+/).filter(Boolean).map((word) => Array.from(word))
}

function StoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V6.5A6.5 6.5 0 0 1 18 6.5V8h2a1 1 0 0 1 1 1l-1 11a1 1 0 0 1-1 .9H5A1 1 0 0 1 4 20L3 9a1 1 0 0 1 1-1h1Zm2 0h9V6.5a4.5 4.5 0 0 0-9 0V8Zm1.5 4a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm7 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" /></svg>
}

function catalogTypeLabel(type: CatalogItem['type']) {
  if (type === 'draw_color') return 'Colors'
  if (type === 'brush_size') return 'Brush sizes'
  if (type === 'name_font') return 'Name fonts'
  return 'Nameplate borders'
}

function createPreviewSession(): SessionPublicState {
  return {
    roomCode: 'PREVIEW', phase: 'DRAWING', sessionId: 'preview-session', turnsPerSession: 8, turnIndex: 0,
    teamScore: 12, solvedTurns: 2, sessionCoinsPerPlayer: 6, duoStreakCurrent: 2, duoStreakBest: 4,
    playerStates: [
      { sessionId: 'preview-local', userId: 'preview-local', role: 'drawer', wallet: 48, connected: true, ready: true, rematch: false, displayName: 'You', appearance: { draw_color: 'color-blue', brush_size: 'brush-medium', name_font: 'font-plain', nameplate_border: 'border-plain' } },
      { sessionId: 'preview-partner', userId: 'preview-partner', role: 'guesser', wallet: null, connected: true, ready: true, rematch: false, displayName: 'Sunny Scribbler', appearance: { name_color: 'color-purple', name_font: 'font-bubble', nameplate_border: 'border-sunshine' } },
    ],
    activeTurn: {
      turnId: 'preview-turn', turnIndex: 0, phase: 'DRAWING', drawerSessionId: 'preview-local', selectedDifficulty: 2,
      selectedPromptLength: 3, slotPattern: [3], slotCount: 3, remainingMs: 47_000, revealedAnswer: null,
      outcome: null, resolutionId: null, boardGeneration: 0,
      board: [{ id: 'preview-s', letter: 'S', used: false }, { id: 'preview-u', letter: 'U', used: false }, { id: 'preview-n', letter: 'N', used: false }],
    },
    rematchDeadline: null, startedAt: Date.now(), version: 'preview',
  }
}

const baseRuntimeConfig = getClientRuntimeConfig()
const runtimeConfig = {
  ...baseRuntimeConfig,
  backendHttpUrl: import.meta.env.VITE_DRAW_DUO_BACKEND_HTTP_URL || baseRuntimeConfig.backendHttpUrl,
  backendWsUrl: import.meta.env.VITE_DRAW_DUO_BACKEND_WS_URL || import.meta.env.VITE_DRAW_DUO_BACKEND_HTTP_URL?.replace(/^http/, 'ws') || baseRuntimeConfig.backendWsUrl,
}
const WS_URL = runtimeConfig.backendWsUrl
const API_BASE = runtimeConfig.backendHttpUrl

function developmentIdentityHeaders(userId: string): Record<string, string> {
  if (!import.meta.env.DEV || neonAuthConfigured) return {}
  return { [['x', 'draw', 'duo', 'user'].join('-')]: userId }
}

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

type SessionModalAction = 'hide' | 'report' | 'block' | 'leave'
type ReportCategory = 'harassment' | 'inappropriate_drawing' | 'spam' | 'other'
type AuthMode = 'sign-in' | 'sign-up'

const REPORT_CATEGORIES: Array<{ value: ReportCategory; label: string }> = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_drawing', label: 'Inappropriate drawing' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
]

type ModalRequest =
  | { kind: 'clear'; sessionId: string; turnId: string }
  | { kind: 'session-action'; action: SessionModalAction; sessionId: string; turnId: string | null; partnerId: string | null; reportCategory: ReportCategory | null }
  | { kind: 'purchase'; itemId: string }
  | { kind: 'auth'; mode: AuthMode }

type ModalProps = {
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  onClose?: () => void
  fallbackFocusRef?: RefObject<HTMLElement | null>
}

function Modal({ title, eyebrow, children, footer, onClose, fallbackFocusRef }: ModalProps) {
  const modalRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () => Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) {
        event.preventDefault()
        modal.focus()
        return
      }
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
      else if (fallbackFocusRef?.current?.isConnected) fallbackFocusRef.current.focus()
    }
  }, [fallbackFocusRef, onClose])

  return (
    <div className="app-modal__backdrop">
      <section
        ref={modalRef}
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
      >
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="app-modal__body">{children}</div>
        {footer && <div className="app-modal__actions">{footer}</div>}
      </section>
    </div>
  )
}

function sessionModalCopy(action: SessionModalAction) {
  switch (action) {
    case 'hide':
      return { title: 'Hide drawing and leave?', message: 'The drawing will be hidden and this session will end for you.', confirmLabel: 'Hide and leave' }
    case 'report':
      return { title: 'Report partner and leave?', message: 'This will report the partner and leave the session.', confirmLabel: 'Report and leave' }
    case 'block':
      return { title: 'Block partner and leave?', message: 'This will block the partner and leave the session.', confirmLabel: 'Block and leave' }
    case 'leave':
      return { title: 'Leave game?', message: 'You will leave the current session.', confirmLabel: 'Leave game' }
  }
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
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null)
  const [drawBank, setDrawBank] = useState<TileSchema[]>([])
  const [slotPattern, setSlotPattern] = useState<number[]>([])
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([])
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null)
  const [lastTurnReveal, setLastTurnReveal] = useState<ServerMessageTurnResolved | null>(null)
  const [mute, setMute] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [previewGame, setPreviewGame] = useState(false)
  const [drawColor, setDrawColor] = useState('#1a73ff')
  const [drawWidth, setDrawWidth] = useState(12)
  const [drawTool, setDrawTool] = useState<'draw' | 'erase'>('draw')
  const [appState, setAppState] = useState<AppState>({ userId: '', sessionId: '' })
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authDisplayName, setAuthDisplayName] = useState('')
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [showShop, setShowShop] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState('')
  const [safetyMessage, setSafetyMessage] = useState<string | null>(null)
  const [accountSync, setAccountSync] = useState<'loading' | 'ready' | 'offline'>('loading')
  const [showGuide, setShowGuide] = useState(true)
  const [modal, setModal] = useState<ModalRequest | null>(null)
  const connectionEpochRef = useRef(1)
  const intentionalLeaveRef = useRef(false)
  const reconnectingRef = useRef(false)
  const wrongGuessTimerRef = useRef<number | null>(null)

  const clientRef = useRef<Client | null>(null)
  const roomRef = useRef<Room | null>(null)
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const appRootRef = useRef<HTMLDivElement>(null)
  const viewStateRef = useRef<{ connected: boolean; sessionId: string | null }>({ connected: false, sessionId: null })
  const stateReceivedAtRef = useRef(Date.now())
  const [, setClockTick] = useState(0)

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
  const spendableCoins = localPlayer?.wallet ?? profile?.wallet ?? 0

  const ownedCosmeticIds = useMemo(() => new Set(profile?.ownedCosmetics ?? STARTER_COSMETIC_IDS), [profile])
  const availableDrawColors = useMemo(() => DRAW_COLORS.filter((item) => ownedCosmeticIds.has(item.itemId)), [ownedCosmeticIds])
  const availableBrushSizes = useMemo(() => BRUSH_SIZES.filter((item) => ownedCosmeticIds.has(item.itemId)), [ownedCosmeticIds])
  const partnerNameColor = cosmeticById(partner?.appearance?.name_color)?.value ?? '#111111'
  const partnerNameFont = cosmeticById(partner?.appearance?.name_font)?.value ?? 'plain'
  const partnerNameBorder = cosmeticById(partner?.appearance?.nameplate_border)?.value ?? 'plain'
  viewStateRef.current = { connected, sessionId: session?.sessionId ?? null }
  const sessionModal = modal?.kind === 'session-action' ? modal : null
  const purchaseModalItem = modal?.kind === 'purchase' ? catalog.find((item) => item.itemId === modal.itemId) : null
  const authModal = modal?.kind === 'auth' ? modal : null
  const clearModalOpen = Boolean(
    modal?.kind === 'clear'
      && modal.sessionId === session?.sessionId
      && modal.turnId === session?.activeTurn?.turnId
      && session?.phase === 'DRAWING'
      && isDrawer
      && connected,
  )
  const sessionModalOpen = Boolean(
    sessionModal
      && sessionModal.sessionId === session?.sessionId
      && sessionModal.turnId === (session?.activeTurn?.turnId ?? null)
      && sessionModal.partnerId === (partner?.userId ?? null)
      && connected,
  )
  const purchaseModalOpen = Boolean(
    purchaseModalItem
      && showShop
      && profile
      && !previewGame
      && !ownedCosmeticIds.has(purchaseModalItem.itemId)
      && spendableCoins >= purchaseModalItem.price,
  )
  const authModalOpen = Boolean(authModal && neonAuthConfigured)
  const modalOpen = clearModalOpen || sessionModalOpen || purchaseModalOpen || authModalOpen
  const sessionModalDetails = sessionModal ? sessionModalCopy(sessionModal.action) : null

  const rematchTargetMs = session?.rematchDeadline ?? null
  const rematchCountdown = rematchTargetMs ? rematchTargetMs - Date.now() : null

  useEffect(() => {
    if (appState.userId === '' && localUserId) {
      setAppState((state) => ({ ...state, userId: localUserId }))
    }
  }, [localUserId, appState.userId])

  useEffect(() => {
    let active = true
    void getAuthUser().then((user) => {
      if (!active) return
      setAuthUser(user)
      if (user) setAppState((state) => ({ ...state, userId: user.id }))
    }).catch(() => {
      if (active) setAuthUser(null)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (modal && !modalOpen) setModal(null)
  }, [modal, modalOpen])

  useEffect(() => {
    if (!appState.userId) return
    let active = true
    setAccountSync('loading')
    void getClientAccessToken().then((token) => fetch(`${API_BASE}/api/account/me`, { headers: { ...developmentIdentityHeaders(appState.userId), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }))
      .then((response) => {
        if (!response.ok) throw new Error('account_sync_unavailable')
        return response.json() as Promise<AccountProfile>
      })
      .then((account) => { if (active) { setProfile(account); setAccountSync('ready') } })
      .catch(() => { if (active) { setProfile(null); setAccountSync('offline') } })
    return () => { active = false }
  }, [appState.userId])

  useEffect(() => {
    setShowGuide(window.localStorage.getItem('draw-duo-guide-dismissed') !== '1')
  }, [])

  useEffect(() => {
    if (!connected && !previewGame) return
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 250)
    return () => window.clearInterval(timer)
  }, [connected, previewGame])

  useEffect(() => {
    if (profile && localPlayer?.wallet !== null && localPlayer?.wallet !== undefined && profile.wallet !== localPlayer.wallet) {
      setProfile((current) => current ? { ...current, wallet: localPlayer.wallet as number } : current)
    }
  }, [localPlayer?.wallet, profile])

  useEffect(() => {
    const equippedColor = cosmeticById(profile?.equippedCosmetics.draw_color)
    const equippedSize = cosmeticById(profile?.equippedCosmetics.brush_size)
    if (equippedColor?.type === 'draw_color' && ownedCosmeticIds.has(equippedColor.itemId)) {
      setDrawColor(equippedColor.value)
      drawStateRef.current.color = equippedColor.value
    }
    if (equippedSize?.type === 'brush_size' && ownedCosmeticIds.has(equippedSize.itemId)) {
      const width = Number(equippedSize.value)
      setDrawWidth(width)
      drawStateRef.current.width = width
    }
  }, [ownedCosmeticIds, profile?.equippedCosmetics.brush_size, profile?.equippedCosmetics.draw_color])

  useEffect(() => () => {
    if (wrongGuessTimerRef.current !== null) {
      window.clearTimeout(wrongGuessTimerRef.current)
    }
  }, [])

  const dismissGuide = useCallback(() => {
    window.localStorage.setItem('draw-duo-guide-dismissed', '1')
    setShowGuide(false)
  }, [])

  const getCanvasContext = useCallback(() => {
    const canvas = localCanvasRef.current
    if (!canvas) {
      return null
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }

    const size = 1024
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
    const { canvas, ctx } = drawingContext
    if (points.length === 0) {
      return
    }
    const scalePoint = (point: StrokePoint) => ({ x: point.x / 65535 * canvas.width, y: point.y / 65535 * canvas.height })
    const last = scalePoint(points[0])
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
      const point = scalePoint(points[i])
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
    if (previewGame) {
      strokeHistoryRef.current = []
      resetCanvas()
      return
    }
    sendMessage({
      type: 'clearCanvas',
      turnId: session.activeTurn.turnId,
      actionId: crypto.randomUUID(),
      connectionEpoch: connectionEpochRef.current,
      generation: session.activeTurn.boardGeneration,
    })
  }, [connected, isDrawer, previewGame, resetCanvas, sendMessage, session])

  const openAuthModal = useCallback((mode: AuthMode) => {
    setAuthError(null)
    setAuthPassword('')
    setModal({ kind: 'auth', mode })
  }, [])

  const closeModal = useCallback(() => {
    setModal(null)
    setAuthError(null)
    setAuthPassword('')
  }, [])

  const toggleAuthMode = useCallback(() => {
    setAuthError(null)
    setAuthPassword('')
    setModal((current) => current?.kind === 'auth' ? { ...current, mode: current.mode === 'sign-in' ? 'sign-up' : 'sign-in' } : current)
  }, [])

  const submitAuth = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!authModal || authBusy) return
    const email = authEmail.trim()
    const displayName = authDisplayName.trim()
    if (!email || !authPassword || (authModal.mode === 'sign-up' && !displayName)) {
      setAuthError('Complete all fields first.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    try {
      const user = authModal.mode === 'sign-in'
        ? await signInWithEmail(email, authPassword)
        : await signUpWithEmail(email, authPassword, displayName)
      if (!user) throw new Error(authModal.mode === 'sign-up' ? 'Account created. Check your email, then sign in.' : 'Sign-in did not return an account.')
      setAuthUser(user)
      setAppState((state) => ({ ...state, userId: user.id }))
      setModal(null)
      setAuthPassword('')
      setStatus(authModal.mode === 'sign-in' ? 'Signed in' : 'Account created')
    } catch (err) {
      setAuthError((err as Error).message)
    } finally {
      setAuthBusy(false)
    }
  }, [authBusy, authDisplayName, authEmail, authModal, authPassword])

  const signOut = useCallback(async () => {
    try {
      await signOutNeonAuth()
      setAuthUser(null)
      setProfile(null)
      setAccountSync('offline')
      setAppState((state) => ({ ...state, userId: localUserId }))
      setStatus('Signed out')
      setError(null)
    } catch (err) {
      setError(`Sign out failed: ${(err as Error).message}`)
    }
  }, [localUserId])

  const requireAuth = useCallback(() => {
    if (!neonAuthConfigured || authUser) return true
    openAuthModal('sign-in')
    return false
  }, [authUser, openAuthModal])

  const confirmClear = useCallback(() => {
    setModal(null)
    sendClear()
  }, [sendClear])

  const openClearConfirm = useCallback(() => {
    if (!session?.activeTurn || !isDrawer || !connected) return
    setModal({
      kind: 'clear',
      sessionId: session.sessionId,
      turnId: session.activeTurn.turnId,
    })
  }, [connected, isDrawer, session])

  const openSessionAction = useCallback((action: SessionModalAction) => {
    if (!session || !connected || (action !== 'leave' && !partner?.userId)) return
    setModal({
      kind: 'session-action',
      action,
      sessionId: session.sessionId,
      turnId: session.activeTurn?.turnId ?? null,
      partnerId: partner?.userId ?? null,
      reportCategory: action === 'report' ? 'other' : null,
    })
  }, [connected, partner?.userId, session])

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
    setModal(null)
    setSession(null)
    setConnected(false)
    setPreviewGame(false)
    setStatus('Left session')
    setChoices([])
    setSelectedPrompt(null)
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
    stateReceivedAtRef.current = Date.now()
    if (next.phase === 'CLOSED' || next.phase === 'ABORTED') {
      leaveRoom()
      return
    }
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
  }, [leaveRoom, setBoardFromSession])

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

    room.onMessage('privatePrompt', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessagePrivatePrompt>(message)
      if (parsed?.answer) setSelectedPrompt(parsed.answer)
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
      if (parsed.generation < boardGenerationRef.current) return
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
      if (wrongGuessTimerRef.current !== null) {
        window.clearTimeout(wrongGuessTimerRef.current)
      }
      if (parsed.correct) {
        setGuessFeedback('Correct!')
        return
      }
      setGuessFeedback('Try again')
      wrongGuessTimerRef.current = window.setTimeout(() => {
        setSelectedTileIds([])
        setGuessFeedback(null)
        wrongGuessTimerRef.current = null
      }, 650)
    })

    room.onMessage('turnResolved', (message: ServerMessage) => {
      const parsed = parseMessage<ServerMessageTurnResolved>(message)
      if (!parsed) {
        return
      }
      if (wrongGuessTimerRef.current !== null) {
        window.clearTimeout(wrongGuessTimerRef.current)
        wrongGuessTimerRef.current = null
      }
      setLastTurnReveal(parsed)
      setSelectedPrompt(null)
      setGuessFeedback(null)
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
      const authToken = await getClientAccessToken()
      const room = await client.joinById(roomId, {
        roomCode: suppliedRoomCode,
        userId: appState.userId,
        authToken: authToken ?? undefined,
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
    const authToken = await getClientAccessToken()
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...developmentIdentityHeaders(appState.userId),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init.headers,
      },
      ...init,
    })
    const json = res.status === 204 ? null : await res.json()
    if (!res.ok) {
      const message = json.error || `HTTP ${res.status}`
      if (message === 'authentication_required') openAuthModal('sign-in')
      throw new Error(message)
    }
    return json as T
  }, [appState.userId, openAuthModal])

  const acceptTerms = useCallback(async () => {
    try {
      const next = await callApi<AccountProfile>('/api/account/terms', { method: 'POST', body: JSON.stringify({ termsVersion: 'alpha-2026-09' }) })
      setProfile(next)
    } catch (err) {
      setError(`Terms update failed: ${(err as Error).message}`)
    }
  }, [callApi])

  const openShop = useCallback(async () => {
    if (previewGame) {
      setCatalog([...COSMETIC_CATALOG])
      setShowShop(true)
      return
    }
    try {
      const next = await callApi<{ items: CatalogItem[] }>('/api/progression/catalog')
      setCatalog(next.items)
      setShowShop(true)
    } catch (err) {
      setError(`Catalog unavailable: ${(err as Error).message}`)
    }
  }, [callApi, previewGame])

  const openPreviewGame = useCallback(() => {
    const next = createPreviewSession()
    stateReceivedAtRef.current = Date.now()
    setPreviewGame(true)
    setConnected(true)
    setStatus('Preview mode')
    setError(null)
    setShowSettings(false)
    setShowShop(false)
    setSelectedPrompt('SUN')
    setDrawBank(next.activeTurn?.board ?? [])
    setSlotPattern(next.activeTurn?.slotPattern ?? [])
    setSelectedTileIds([])
    setLastTurnReveal(null)
    setAppState((current) => ({ ...current, sessionId: 'preview-local' }))
    setSession(next)
    window.setTimeout(() => resetCanvas(), 0)
  }, [resetCanvas])

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
      sendMessage({ type: 'refreshProfile' })
    } catch (err) {
      setError(`Purchase failed: ${(err as Error).message}`)
    }
  }, [callApi, sendMessage])

  const openPurchaseConfirm = useCallback((itemId: string) => {
    const item = catalog.find((entry) => entry.itemId === itemId)
    if (!item || previewGame || !profile || ownedCosmeticIds.has(itemId) || spendableCoins < item.price) return
    setModal({ kind: 'purchase', itemId })
  }, [catalog, ownedCosmeticIds, previewGame, profile, spendableCoins])

  const confirmPurchase = useCallback(() => {
    if (modal?.kind !== 'purchase' || !purchaseModalOpen || !purchaseModalItem) {
      setModal(null)
      return
    }
    setModal(null)
    void purchaseItem(purchaseModalItem.itemId)
  }, [modal, purchaseItem, purchaseModalItem, purchaseModalOpen])

  const equipItem = useCallback(async (itemId: string, slot?: CosmeticEquipSlot) => {
    try {
      setProfile(await callApi<AccountProfile>('/api/progression/equip', { method: 'POST', body: JSON.stringify({ itemId, slot }) }))
      sendMessage({ type: 'refreshProfile' })
    } catch (err) {
      setError(`Equip failed: ${(err as Error).message}`)
    }
  }, [callApi, sendMessage])

  const hideAndLeave = useCallback(() => {
    resetCanvas()
    leaveRoom()
  }, [leaveRoom, resetCanvas])

  const reportPartner = useCallback(async (category: ReportCategory, target: { partnerId: string; sessionId: string; turnId: string | null }) => {
    const { partnerId, sessionId, turnId } = target
    if (!partnerId) return
    hideAndLeave()
    try {
      await callApi('/api/safety/report', { method: 'POST', body: JSON.stringify({ subjectPlayerId: partnerId, category, sessionId, turnId }) })
      if (!viewStateRef.current.connected && viewStateRef.current.sessionId === null) {
        setSafetyMessage('Report submitted. The drawing was hidden and the session was closed.')
      }
    } catch (err) {
      if (!viewStateRef.current.connected && viewStateRef.current.sessionId === null) {
        setError(`Report failed: ${(err as Error).message}`)
      }
    }
  }, [callApi, hideAndLeave])

  const blockPartner = useCallback(async (partnerId: string) => {
    if (!partnerId) return
    hideAndLeave()
    try {
      await callApi('/api/safety/block', { method: 'POST', body: JSON.stringify({ blockedPlayerId: partnerId }) })
      if (!viewStateRef.current.connected && viewStateRef.current.sessionId === null) {
        setSafetyMessage('Partner blocked. The drawing was hidden and the session was closed.')
      }
    } catch (err) {
      if (!viewStateRef.current.connected && viewStateRef.current.sessionId === null) {
        setError(`Block failed: ${(err as Error).message}`)
      }
    }
  }, [callApi, hideAndLeave])

  const confirmSessionAction = useCallback(() => {
    if (modal?.kind !== 'session-action' || !sessionModalOpen) {
      setModal(null)
      return
    }
    const action = modal.action
    setModal(null)
    if (action === 'hide') {
      hideAndLeave()
    } else if (action === 'report') {
      if (modal.partnerId) void reportPartner(modal.reportCategory ?? 'other', { partnerId: modal.partnerId, sessionId: modal.sessionId, turnId: modal.turnId })
    } else if (action === 'block') {
      if (modal.partnerId) void blockPartner(modal.partnerId)
    } else {
      leaveRoom()
    }
  }, [blockPartner, hideAndLeave, leaveRoom, modal, reportPartner, sessionModalOpen])

  const createPrivateRoom = useCallback(async () => {
    if (!requireAuth()) return
    const payload = await callApi<{ roomId: string; roomCode: string }>(`/api/lobby/private/create`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    setRoomCodeInput(payload.roomCode)
    await joinByRoomId(payload.roomId, payload.roomCode)
  }, [callApi, joinByRoomId, requireAuth])

  const joinPrivateRoom = useCallback(async () => {
    if (!requireAuth()) return
    if (!roomCodeInput.trim()) {
      setError('Enter a room code')
      return
    }
    const payload = await callApi<{ roomId: string; roomCode: string }>(`/api/lobby/private/join`, {
      method: 'POST',
      body: JSON.stringify({ code: roomCodeInput.trim() }),
    })
    await joinByRoomId(payload.roomId)
  }, [callApi, roomCodeInput, joinByRoomId, requireAuth])

  const startQuick = useCallback(async () => {
    if (!requireAuth()) return
    const payload = await callApi<{ roomId: string; roomCode: string | null }>(`/api/match/quick`, {
      method: 'POST',
      body: JSON.stringify({ userId: appState.userId, buildId: runtimeConfig.buildId, protocolMajor: runtimeConfig.protocolMajor, language: 'en', platformId: runtimeConfig.platformId, capabilities: runtimeConfig.capabilities }),
    })
    await joinByRoomId(payload.roomId)
  }, [appState.userId, callApi, joinByRoomId, requireAuth])

  const applyPointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = localCanvasRef.current
    if (!canvas) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 65535),
      y: Math.round(((event.clientY - rect.top) / rect.height) * 65535),
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
      if (modalOpen || (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]'))) {
        return
      }
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
  }, [chooseTile, clearGuess, isDrawer, modalOpen, session, selectedTileIds, submitGuess])

  const groupedSlots = useMemo(() => {
    if (!slotPattern.length) {
      return [selectedTileIds.map((id) => drawBank.find((tile) => tile.id === id) ?? null)]
    }
    const groups: (string | null)[][] = []
    let cursor = 0
    for (const size of slotPattern) {
      groups.push(Array.from({ length: size }, (_, offset) => selectedTileIds[cursor + offset] ?? null))
      cursor += size
    }
    return groups
  }, [drawBank, selectedTileIds, slotPattern])

  const availableTiles = useMemo(() => {
    return drawBank.filter((tile) => !selectedTileIds.includes(tile.id))
  }, [drawBank, selectedTileIds])

  const visibleWordGroups = useMemo<(string | null)[][]>(() => {
    if (isDrawer && selectedPrompt) {
      return answerGroups(selectedPrompt)
    }
    return groupedSlots.map((group) => group.map((tileId) => (
      tileId ? drawBank.find((tile) => tile.id === tileId)?.letter ?? null : null
    )))
  }, [drawBank, groupedSlots, isDrawer, selectedPrompt])

  const remainingTurnMs = session
    ? Math.max(0, (session.activeTurn?.remainingMs ?? 0) - (Date.now() - stateReceivedAtRef.current))
    : 0
  const remainingTurnSeconds = Math.ceil(remainingTurnMs / 1000)
  const drawingTimePercent = Math.min(100, Math.max(0, remainingTurnMs / DRAWING_DURATION_MS * 100))
  const timerIsUrgent = session?.phase === 'DRAWING' && remainingTurnMs > 0 && remainingTurnMs <= 10_000
  const wrongGuess = guessFeedback === 'Try again'
  const solvedReveal = session?.phase === 'REVEAL' && lastTurnReveal?.outcome === 'solved'

  const selectDrawColor = (color: string) => {
    setDrawColor(color)
    setDrawTool('draw')
    drawStateRef.current.color = color
    drawStateRef.current.tool = 'draw'
  }

  const selectDrawTool = (tool: 'draw' | 'erase') => {
    setDrawTool(tool)
    drawStateRef.current.tool = tool
  }

  const cycleDrawColor = (direction: -1 | 1) => {
    const currentIndex = availableDrawColors.findIndex((entry) => entry.value === drawColor)
    const nextIndex = (currentIndex + direction + availableDrawColors.length) % availableDrawColors.length
    selectDrawColor(availableDrawColors[nextIndex].value)
  }

  const cycleBrushWidth = () => {
    const currentIndex = availableBrushSizes.findIndex((entry) => Number(entry.value) === drawWidth)
    const nextWidth = Number(availableBrushSizes[(currentIndex + 1) % availableBrushSizes.length].value)
    setDrawWidth(nextWidth)
    drawStateRef.current.width = nextWidth
  }

  return (
    <div ref={appRootRef} tabIndex={-1} className={`app ${connected ? 'app--game' : 'app--lobby'}${reducedMotion ? ' app--reduced-motion' : ''}`}>
      {!connected && <header className="lobby-header">
        <div>
          <p className="eyebrow">Draw together. Win together.</p>
          <h1>Draw Duo</h1>
          <p className="info muted">A colorful cooperative drawing game with shared streaks and equal rewards.</p>
        </div>
        <div className="lobby-header-actions">
          {neonAuthConfigured && (authUser ? <button className="soft-button" onClick={signOut}>Sign out</button> : <button className="soft-button" onClick={() => openAuthModal('sign-in')}>Sign in</button>)}
          <button className="store-button store-button--lobby" onClick={openShop} disabled={!profile} aria-label="Open reward store"><StoreIcon /><span>Store</span></button>
          <button className="soft-button" onClick={() => setShowSettings((value) => !value)}>Settings</button>
        </div>
      </header>}

      {!connected && showSettings && (
        <section className="lobby-settings" aria-label="Settings">
          <label><input type="checkbox" checked={mute} onChange={(event) => setMute(event.target.checked)} /> Mute sounds</label>
          <label><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> Reduced motion</label>
        </section>
      )}

      {!connected && showGuide && (
        <section className="guide-panel" aria-label="How to play">
          <div>
            <h2>How a duo turn works</h2>
            <p>One player draws while their partner types the answer. Choose a difficulty, communicate through the picture, and solve together before time runs out.</p>
            <p>Both players earn the same coins for a solved turn. Your duo streak belongs to this partnership and resets when a turn fails.</p>
          </div>
          <button onClick={dismissGuide} aria-label="Dismiss how to play guide">Got it</button>
        </section>
      )}

      {!connected && profile && (
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
          <span className="sync-state" role="status">{accountSync === 'ready' ? 'Account synced' : accountSync === 'loading' ? 'Syncing account...' : 'Account offline'}</span>
          {!profile.termsVersion && <button onClick={acceptTerms}>Accept alpha terms</button>}
          <button onClick={openShop}>Cosmetics</button>
        </section>
      )}

      {!connected && !profile && accountSync === 'loading' && <p className="info" role="status">Loading account...</p>}
      {!connected && neonAuthConfigured && !authUser && <p className="info account-auth-prompt">Sign in to join live games and save your progress.</p>}
      {!connected && !profile && accountSync === 'offline' && <p className="info" role="alert">Account sync is unavailable. You can still play, but rewards and profile changes are paused.</p>}

      {showShop && (
        <section className={`shop-panel${connected ? ' shop-panel--overlay' : ''}`} aria-label="Reward store">
          <div className="shop-heading"><div><p className="eyebrow">Spend what you earn</p><h2>Reward Store</h2></div><button onClick={() => setShowShop(false)}>Close</button></div>
          <p className="shop-balance">Your balance: <strong>{spendableCoins} coins</strong></p>
          <div className="shop-grid">
            {catalog.map((item) => {
              const owned = ownedCosmeticIds.has(item.itemId)
              const equipped = Object.values(profile?.equippedCosmetics ?? {}).includes(item.itemId)
              return (
                <article className="shop-item" key={item.itemId}>
                  <div className={`shop-preview shop-preview--${item.type}`} style={item.type === 'draw_color' ? { backgroundColor: item.value } : undefined}>
                    {item.type === 'brush_size' ? <span style={{ width: `${Math.min(34, Math.max(5, Number(item.value)))}px`, height: `${Math.min(34, Math.max(5, Number(item.value)))}px` }} /> : item.type === 'name_font' ? <b className={`name-font--${item.value}`}>Aa</b> : item.type === 'nameplate_border' ? <b className={`nameplate--${item.value}`}>You</b> : null}
                  </div>
                  <div className="shop-item__copy"><small>{catalogTypeLabel(item.type)}</small><b>{item.name}</b><span>{item.price === 0 ? 'Starter' : `${item.price} coins`}</span></div>
                  {!owned ? <button onClick={() => openPurchaseConfirm(item.itemId)} disabled={previewGame || !profile || spendableCoins < item.price}>Unlock</button> : item.type === 'draw_color' ? (
                    <div className="shop-equip-actions">
                      <button onClick={() => equipItem(item.itemId, 'draw_color')} disabled={previewGame || profile?.equippedCosmetics.draw_color === item.itemId}>Brush</button>
                      <button onClick={() => equipItem(item.itemId, 'name_color')} disabled={previewGame || profile?.equippedCosmetics.name_color === item.itemId}>Name</button>
                    </div>
                  ) : <button onClick={() => equipItem(item.itemId)} disabled={previewGame || equipped}>{equipped ? 'Equipped' : 'Equip'}</button>}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {!connected ? (
        <section className="lobby-actions">
          {error && <p className="feedback-message feedback-message--error" role="alert">{error}</p>}
          {safetyMessage && <p className="feedback-message" role="status">{safetyMessage}</p>}
          {status && <p className="connection-status">Status: {status}</p>}
          <div className="primary-actions">
            <button onClick={startQuick} data-testid="quick-join">Quick Partner</button>
            <button onClick={createPrivateRoom} data-testid="create-private">Create Invite</button>
            <button className="preview-button" onClick={openPreviewGame}>Preview Game Screen</button>
          </div>
          <div className="invite-entry">
            <input
              value={roomCodeInput}
              onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
              placeholder="Enter 6-char code"
              maxLength={6}
            />
            <button onClick={joinPrivateRoom} data-testid="join-private">Join Invite</button>
          </div>
        </section>
      ) : (
        <>
          <div className="rotate-device" role="status">Draw Duo plays in portrait. Rotate your device to continue.</div>
          <section className="game-shell">
            <header className="game-hud">
              <p className="room-meta" aria-live="polite">
                Code: <strong>{roomCode ?? '(private code unavailable)'}</strong> &bull; Players: {connectedCount}
              </p>
              <div className="hud-score">
                <span>Points</span>
                <b>{session?.teamScore ?? 0}</b>
              </div>
              <div className="hud-timer" aria-label={`${phaseLabel(session?.phase ?? 'WAITING')}, ${formatTime(remainingTurnMs)} remaining`}>
                <span>{phaseLabel(session?.phase ?? 'WAITING')}</span>
                <b>{formatTime(remainingTurnMs)}</b>
              </div>
              <div className="hud-actions">
                <button className="store-button" onClick={openShop} disabled={!profile && !previewGame} aria-label="Open reward store"><StoreIcon /></button>
                <button className="settings-button" onClick={() => setShowSettings((value) => !value)} aria-label="Game settings" aria-expanded={showSettings}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94a7.5 7.5 0 0 0 .05-.94 7.5 7.5 0 0 0-.05-.94l2.03-1.58-1.92-3.32-2.39.96a7.1 7.1 0 0 0-1.62-.94L14.88 3h-3.84l-.36 3.18a7.1 7.1 0 0 0-1.62.94l-2.39-.96-1.92 3.32 2.03 1.58a7.5 7.5 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.39 1.04.7 1.62.94l.36 3.18h3.84l.36-3.18a7.1 7.1 0 0 0 1.62-.94l2.39.96 1.92-3.32-2.03-1.58ZM12.96 15.2A3.2 3.2 0 1 1 12.96 8.8a3.2 3.2 0 0 1 0 6.4Z" /></svg>
                </button>
              </div>
              <div className={`partner-nameplate nameplate--${partnerNameBorder} name-font--${partnerNameFont}`} style={{ color: partnerNameColor }}>
                <span>Partner</span><b>{partner?.displayName ?? 'Waiting for partner'}</b>
              </div>
            </header>

            {showSettings && (
              <section className="settings-sheet" aria-label="Game settings">
                <div className="settings-sheet__title"><b>Settings</b><button onClick={() => setShowSettings(false)}>Close</button></div>
                <label><input type="checkbox" checked={mute} onChange={(event) => setMute(event.target.checked)} /> Mute sounds</label>
                <label><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> Reduced motion</label>
                <p>{localPlayer?.wallet ?? 0} coins &bull; Streak {session?.duoStreakCurrent ?? 0}</p>
                {partner && <button onClick={() => openSessionAction('hide')}>Hide drawing and leave</button>}
                {partner && <button onClick={() => openSessionAction('report')}>Report and leave</button>}
                {partner && <button onClick={() => openSessionAction('block')}>Block and leave</button>}
                <button className="danger-button" onClick={() => openSessionAction('leave')}>Leave game</button>
              </section>
            )}

            {(error || safetyMessage || status === 'Reconnecting') && (
              <div className="game-toast" role={error ? 'alert' : 'status'}>{error ?? safetyMessage ?? status}</div>
            )}

            <div className="canvas-stage">
              <canvas
                className="game-canvas"
                ref={localCanvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                data-testid="draw-canvas"
                aria-label="Drawing canvas"
                role="img"
                tabIndex={0}
              />

              {session?.phase === 'DRAWING' && (
                <div
                  className={`canvas-timer${timerIsUrgent ? ' canvas-timer--urgent' : ''}`}
                  role="progressbar"
                  aria-label="Drawing time remaining"
                  aria-valuemin={0}
                  aria-valuemax={60}
                  aria-valuenow={remainingTurnSeconds}
                >
                  <div className="canvas-timer__track">
                    <div className="canvas-timer__fill" style={{ width: `${drawingTimePercent}%` }} />
                  </div>
                  <span className="canvas-timer__seconds">{remainingTurnSeconds}</span>
                </div>
              )}

              {session?.phase === 'READY_CHECK' && <div className="stage-card"><h2>Ready to draw?</h2><p>Both players need to ready up.</p></div>}
              {session?.phase === 'WAITING' && <div className="stage-card"><h2>Invite your partner</h2><p>Share the room code shown above.</p></div>}
              {session?.phase === 'SELECTING' && isDrawer && (
                <div className="stage-card stage-card--choices">
                  <p className="eyebrow">Choose your word</p>
                  <div className="choice-grid">
                    {choices.length === 0 && <p>Loading choices...</p>}
                    {choices.map((choice) => (
                      <button key={choice.id} onClick={() => selectChoice(choice.id)} data-testid={`choice-${choice.difficulty}`}>
                        <span>{difficultyLabel(choice.difficulty)}</span>
                        <small>{choice.difficulty === 1 ? 'Quick draw' : choice.difficulty === 2 ? 'Bigger reward' : 'Big challenge'}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {session?.phase === 'SELECTING' && !isDrawer && <div className="stage-card"><h2>Word incoming</h2><p>Your partner is choosing a challenge.</p></div>}
              {session?.phase === 'COUNTDOWN' && <div className="stage-card stage-card--countdown"><h2>Get ready!</h2><p>{isDrawer ? 'You draw. They guess.' : 'Watch closely and type the answer.'}</p></div>}

              {session?.phase === 'REVEAL' && lastTurnReveal && (
                <div className={`result-burst ${solvedReveal ? 'result-burst--solved' : 'result-burst--missed'}`} aria-live="assertive">
                  <h2>{solvedReveal ? 'You got it!' : 'Nice try!'}</h2>
                  {solvedReveal ? (
                    <>
                      <p className="reward-line">+{lastTurnReveal.teamPointsAwarded} points</p>
                      <p>Total {session?.teamScore ?? 0}</p>
                      <p className="streak-line">Streak {session?.duoStreakCurrent ?? 0}</p>
                    </>
                  ) : <p>{lastTurnReveal.outcome === 'passed' ? 'The turn was passed.' : 'Time ran out.'}</p>}
                </div>
              )}

              {session?.phase === 'RESULTS' && (
                <div className="stage-card stage-card--results">
                  <p className="eyebrow">Eight turns complete</p>
                  <h2>Team score {session.teamScore}</h2>
                  <p>Each player earned {session.sessionCoinsPerPlayer} coins.</p>
                  <p>Best streak {session.duoStreakBest}</p>
                </div>
              )}
            </div>

            <section className="word-tray" aria-label="Answer">
              {session?.phase === 'DRAWING' && (
                <>
                  {isDrawer && selectedPrompt && <p className="drawer-prompt-label">Draw: <strong>{selectedPrompt}</strong></p>}
                  {!isDrawer && <p className={`guess-feedback${wrongGuess ? ' guess-feedback--wrong' : ''}`} aria-live="polite">{guessFeedback ?? 'Type your guess'}</p>}
                  <div className={`word-slots${wrongGuess ? ' word-slots--wrong' : ''}`}>
                    {visibleWordGroups.map((group, groupIndex) => (
                      <div className="word-group" key={`word-${groupIndex}`}>
                        {group.map((letter, slotIndex) => {
                          const absoluteSlot = slotPattern.slice(0, groupIndex).reduce((sum, size) => sum + size, 0) + slotIndex
                          return isDrawer ? (
                            <span className="word-slot word-slot--answer" key={`answer-${absoluteSlot}`}>{letter}</span>
                          ) : (
                            <button
                              className="word-slot"
                              key={`guess-${absoluteSlot}`}
                              onClick={() => removeTileAt(absoluteSlot)}
                              disabled={!letter}
                              aria-label={letter ? `Remove ${letter}` : `Empty letter ${absoluteSlot + 1}`}
                              data-testid={`slot-${absoluteSlot}`}
                            >
                              {letter ?? ''}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {session?.phase === 'REVEAL' && lastTurnReveal && (
                <div className={`word-slots word-slots--revealed${solvedReveal ? ' word-slots--correct' : ''}`}>
                  {answerGroups(lastTurnReveal.revealedAnswer).map((group, groupIndex) => (
                    <div className="word-group" key={`reveal-${groupIndex}`}>
                      {group.map((letter, letterIndex) => <span className="word-slot word-slot--answer" key={`reveal-${groupIndex}-${letterIndex}`}>{letter}</span>)}
                    </div>
                  ))}
                </div>
              )}

              {session?.phase === 'RESULTS' && <p className="session-complete">Session complete.</p>}
              {session?.phase !== 'DRAWING' && session?.phase !== 'REVEAL' && session?.phase !== 'RESULTS' && (
                <p className="between-turn-label">{phaseLabel(session?.phase ?? 'WAITING')}</p>
              )}
            </section>

            <section className="control-dock" aria-label={isDrawer ? 'Drawing controls' : 'Guessing controls'}>
              {session?.phase === 'READY_CHECK' && <button className="ready-button" onClick={setReady}>Ready</button>}

              {session?.phase === 'DRAWING' && isDrawer && (
                <>
                  <div className="palette-row">
                    <button className="palette-arrow" onClick={() => cycleDrawColor(-1)} aria-label="Previous color">&larr;</button>
                    <div className="color-swatches">
                      {availableDrawColors.map((color) => (
                        <button
                          key={color.value}
                          className={`color-swatch${drawColor === color.value && drawTool === 'draw' ? ' color-swatch--active' : ''}`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => selectDrawColor(color.value)}
                          aria-label={`${color.name} brush`}
                          aria-pressed={drawColor === color.value && drawTool === 'draw'}
                        />
                      ))}
                    </div>
                    <button className="palette-arrow" onClick={() => cycleDrawColor(1)} aria-label="Next color">&rarr;</button>
                  </div>
                  <div className="drawing-actions">
                    <button className={drawTool === 'draw' ? 'is-active' : ''} onClick={() => selectDrawTool('draw')}>Brush</button>
                    <button className={drawTool === 'erase' ? 'is-active' : ''} onClick={() => selectDrawTool('erase')}>Eraser</button>
                    <button onClick={cycleBrushWidth}>Size {drawWidth}</button>
                    <button onClick={sendUndo}>Undo</button>
                    <button onClick={openClearConfirm}>Clear</button>
                  </div>
                </>
              )}

              {session?.phase === 'DRAWING' && !isDrawer && (
                <div className="keyboard" aria-label="Guess keyboard">
                  {KEYBOARD_ROWS.map((row) => (
                    <div className="keyboard-row" key={row}>
                      {Array.from(row).map((letter) => {
                        const tile = availableTiles.find((entry) => entry.letter === letter)
                        return (
                          <button
                            className="key"
                            key={letter}
                            disabled={!tile}
                            onClick={() => tile && chooseTile(tile.id)}
                            data-testid={tile ? `tile-${tile.id}` : undefined}
                            aria-label={`Letter ${letter}`}
                          >
                            {letter}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  <div className="keyboard-actions">
                    <button onClick={backspaceAction} disabled={selectedTileIds.length === 0}>Backspace</button>
                    <button className="pass-button" onClick={sendPass}>Pass</button>
                    <button className="enter-button" onClick={submitGuess} disabled={selectedTileIds.length !== (session.activeTurn?.slotCount ?? 0)}>Enter</button>
                  </div>
                </div>
              )}

              {session?.phase === 'RESULTS' && (
                <div className="result-actions">
                  <button onClick={requestRematch}>Rematch</button>
                  <button onClick={() => openSessionAction('leave')}>Close</button>
                  {rematchCountdown && rematchCountdown > 0 ? <span>Window {formatTime(rematchCountdown)}</span> : null}
                </div>
              )}
            </section>
          </section>
        </>
      )}
      {authModalOpen && authModal && (
        <Modal
          title={authModal.mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
          eyebrow="Draw Duo account"
          onClose={closeModal}
          fallbackFocusRef={appRootRef}
        >
          <form className="auth-form" onSubmit={submitAuth}>
            {authModal.mode === 'sign-up' && (
              <label className="app-modal__field">
                <span>Display name</span>
                <input value={authDisplayName} onChange={(event) => setAuthDisplayName(event.target.value)} maxLength={32} autoComplete="name" required />
              </label>
            )}
            <label className="app-modal__field">
              <span>Email</span>
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label className="app-modal__field">
              <span>Password</span>
              <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} autoComplete={authModal.mode === 'sign-in' ? 'current-password' : 'new-password'} required />
            </label>
            {authError && <p className="auth-form__error" role="alert">{authError}</p>}
            <div className="auth-form__actions">
              <button type="submit" disabled={authBusy}>{authBusy ? 'Working...' : authModal.mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
              <button type="button" className="modal-button--secondary" onClick={closeModal} disabled={authBusy}>Cancel</button>
            </div>
            <button type="button" className="auth-form__switch" onClick={toggleAuthMode} disabled={authBusy}>
              {authModal.mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
            </button>
          </form>
        </Modal>
      )}
      {clearModalOpen && (
        <Modal
          title="Clear drawing"
          eyebrow="Please confirm"
          footer={(
            <>
              <button type="button" className="modal-button--secondary" onClick={closeModal}>Cancel</button>
              <button type="button" className="modal-button--danger" onClick={confirmClear}>Clear</button>
            </>
          )}
          onClose={closeModal}
          fallbackFocusRef={appRootRef}
        >
          <p>Clear the entire drawing?</p>
        </Modal>
      )}
      {sessionModalOpen && sessionModal && sessionModalDetails && (
        <Modal
          title={sessionModalDetails.title}
          eyebrow="Please confirm"
          footer={(
            <>
              <button type="button" className="modal-button--secondary" onClick={closeModal}>Cancel</button>
              <button type="button" className="modal-button--danger" onClick={confirmSessionAction}>{sessionModalDetails.confirmLabel}</button>
            </>
          )}
          onClose={closeModal}
          fallbackFocusRef={appRootRef}
        >
          <p>{sessionModalDetails.message}</p>
          {sessionModal.action === 'report' && (
            <label className="app-modal__field">
              <span>Reason</span>
              <select
                value={sessionModal.reportCategory ?? 'other'}
                onChange={(event) => {
                  const category = event.target.value as ReportCategory
                  setModal((current) => current?.kind === 'session-action' ? { ...current, reportCategory: category } : current)
                }}
              >
                {REPORT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </label>
          )}
        </Modal>
      )}
      {purchaseModalOpen && purchaseModalItem && (
        <Modal
          title={`Unlock ${purchaseModalItem.name}?`}
          eyebrow="Reward store"
          footer={(
            <>
              <button type="button" className="modal-button--secondary" onClick={closeModal}>Cancel</button>
              <button type="button" onClick={confirmPurchase}>Unlock</button>
            </>
          )}
          onClose={closeModal}
          fallbackFocusRef={appRootRef}
        >
          <p>Spend <strong>{purchaseModalItem.price} coins</strong> to unlock this cosmetic?</p>
          <p>You will have <strong>{spendableCoins - purchaseModalItem.price} coins</strong> left.</p>
        </Modal>
      )}
    </div>
  )
}

export default App
