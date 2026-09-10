import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { matchMaker, Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { MIN_SUPPORTED_BUILD_ID, PROTOCOL_MAJOR, RULES_VERSION, zClientHello } from '@drawduo/protocol'
import { DrawDuoRoom } from './rooms/DrawDuoRoom.js'
import { getCodeByRoom, getInviteOwner, registerPrivateRoom, resolveCode, releaseCode } from './services/MatchmakerState.js'
import { claimQuickRoom, releaseQuickRoom, setQuickRoom } from './services/QuickMatchRegistry.js'
import { getRoom } from './services/RoomRegistry.js'
import { authenticateRequest } from './services/AuthService.js'
import { getAccountStore, type AccountProfile } from './services/AccountStore.js'

const port = Number(process.env.PORT || 2567)
const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
})

gameServer.define('drawduo', DrawDuoRoom)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: Date.now() })
})

app.get('/api/version', (_req, res) => {
  res.json({ app: 'draw-duo', phase: 2, version: '0.2.0', protocolMajor: PROTOCOL_MAJOR, rulesVersion: RULES_VERSION, minimumBuildId: MIN_SUPPORTED_BUILD_ID })
})

app.post('/api/lobby/private/create', async (req, res) => {
  try {
    const room = await matchMaker.createRoom('drawduo', {})
    let ownerPlayerId: string | undefined
    try {
      const identity = await authenticateRequest(req)
      ownerPlayerId = (await getAccountStore().ensurePlayer(identity.subject, identity.displayName)).playerId
    } catch {
      if (process.env.NODE_ENV !== 'development' && process.env.DRAW_DUO_TEST_MODE !== '1') throw new Error('authentication_required')
    }
    const code = registerPrivateRoom(room.roomId, ownerPlayerId)
    res.json({ roomId: room.roomId, roomCode: code.roomCode, status: 'created' })
  } catch (error) {
    res.status(500).json({ error: 'failed_to_create' })
  }
})

app.post('/api/lobby/private/join', async (req, res) => {
  const code = String(req.body?.code ?? '')
  const roomId = resolveCode(code)
  if (!roomId) {
    res.status(404).json({ error: 'invalid_or_expired_code' })
    return
  }
  try {
    const ownerPlayerId = getInviteOwner(code)
    if (ownerPlayerId) {
      const identity = await authenticateRequest(req)
      const joiner = await getAccountStore().ensurePlayer(identity.subject, identity.displayName)
      if (await getAccountStore().areBlocked(ownerPlayerId, joiner.playerId)) {
        res.status(403).json({ error: 'blocked_user' })
        return
      }
    }
    const roomInstance = getRoom(roomId)
    const codeFromRoom = getCodeByRoom(roomId)
    if ((roomInstance?.clients?.length ?? 0) >= 2) {
      res.status(409).json({ error: 'room_full' })
      return
    }
    res.json({ roomId, roomCode: codeFromRoom ?? code })
    if ((roomInstance?.clients?.length ?? 0) === 1) {
      releaseCode(code)
    }
  } catch (_error) {
    res.status(404).json({ error: 'room_not_found' })
  }
})

app.post('/api/match/quick', async (_req, res) => {
  try {
    let userId = String(_req.body?.userId ?? '').trim()
    try {
      const identity = await authenticateRequest(_req)
      if (userId && userId !== identity.subject && _req.header('authorization')) {
        res.status(403).json({ error: 'identity_mismatch' })
        return
      }
      userId = identity.subject
    } catch (error) {
      if (process.env.DRAW_DUO_TEST_MODE !== '1' && process.env.NODE_ENV !== 'development') throw error
    }
    const hello = zClientHello.safeParse({ ..._req.body, userId })
    if (!hello.success) {
      res.status(400).json({ error: 'invalid_match_request' })
      return
    }
    if (hello.data.protocolMajor !== PROTOCOL_MAJOR || hello.data.buildId < MIN_SUPPORTED_BUILD_ID) {
      res.status(426).json({ error: 'update_required', protocolMajor: PROTOCOL_MAJOR, minimumBuildId: MIN_SUPPORTED_BUILD_ID })
      return
    }
    const entrant = await getAccountStore().ensurePlayer(userId)
    const claim = claimQuickRoom(userId)
    if (claim) {
      if (claim.sameUser) {
        setQuickRoom(claim.roomId, userId)
        res.json({ roomId: claim.roomId, roomCode: null, status: 'searching' })
        return
      }
      const queued = await getAccountStore().ensurePlayer(claim.userId)
      if (await getAccountStore().areBlocked(entrant.playerId, queued.playerId)) {
        setQuickRoom(claim.roomId, claim.userId)
        res.status(403).json({ error: 'blocked_user' })
        return
      }
      const room = getRoom(claim.roomId)
      if (room && (room.clients?.length ?? 0) < 2) {
        res.json({ roomId: room.roomId.toString(), roomCode: null, status: 'matched' })
        return
      }
      releaseQuickRoom(claim.roomId)
    }
    const room = await matchMaker.createRoom('drawduo', {})
    setQuickRoom(room.roomId.toString(), userId)
    res.json({ roomId: room.roomId.toString(), roomCode: null, status: 'searching' })
  } catch (_error) {
    res.status(500).json({ error: 'quick_failed' })
  }
})

async function withAccount(req: Request, res: Response, work: (account: AccountProfile) => Promise<void>) {
  try {
    const identity = await authenticateRequest(req)
    const account = await getAccountStore().ensurePlayer(identity.subject, identity.displayName)
    if (account.status !== 'active') {
      res.status(403).json({ error: 'account_unavailable' })
      return
    }
    await work(account)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'request_failed'
    const status = code === 'authentication_required' || code === 'invalid_identity' ? 401 : code === 'auth_provider_not_configured' ? 503 : code === 'insufficient_balance' ? 409 : code === 'catalog_item_not_found' || code === 'account_not_found' ? 404 : 400
    res.status(status).json({ error: code })
  }
}

app.get('/api/account/me', async (req, res) => {
  await withAccount(req, res, async (account) => { res.json(account) })
})

app.post('/api/account/terms', async (req, res) => {
  await withAccount(req, res, async (account) => {
    const termsVersion = String(req.body?.termsVersion ?? '').trim()
    if (!termsVersion || termsVersion.length > 64) { res.status(400).json({ error: 'invalid_terms_version' }); return }
    res.json(await getAccountStore().acceptTerms(account.playerId, termsVersion))
  })
})

app.patch('/api/account/profile', async (req, res) => {
  await withAccount(req, res, async (account) => {
    const displayName = String(req.body?.displayName ?? '').trim()
    if (displayName.length < 1 || displayName.length > 32 || /[\r\n]/.test(displayName)) { res.status(400).json({ error: 'invalid_display_name' }); return }
    res.json(await getAccountStore().updateProfile(account.playerId, displayName))
  })
})

app.get('/api/progression/catalog', async (req, res) => {
  await withAccount(req, res, async () => { res.json({ items: await getAccountStore().getCatalog() }) })
})

app.post('/api/progression/purchase', async (req, res) => {
  await withAccount(req, res, async (account) => {
    const itemId = String(req.body?.itemId ?? '').trim()
    const requestId = String(req.body?.requestId ?? '').trim()
    if (!itemId || !requestId || itemId.length > 128 || requestId.length > 128) { res.status(400).json({ error: 'invalid_purchase_request' }); return }
    res.json(await getAccountStore().purchase(account.playerId, itemId, requestId))
  })
})

app.post('/api/safety/block', async (req, res) => {
  await withAccount(req, res, async (account) => {
    const reference = String(req.body?.blockedPlayerId ?? '').trim()
    const blockedId = await getAccountStore().getProfile(reference) ? reference : await getAccountStore().findPlayerIdBySubject(reference)
    if (!blockedId || blockedId === account.playerId) { res.status(400).json({ error: 'invalid_block' }); return }
    await getAccountStore().block(account.playerId, blockedId)
    res.status(204).end()
  })
})

app.delete('/api/safety/block/:blockedPlayerId', async (req, res) => {
  await withAccount(req, res, async (account) => {
    await getAccountStore().unblock(account.playerId, req.params.blockedPlayerId)
    res.status(204).end()
  })
})

app.post('/api/safety/report', async (req, res) => {
  await withAccount(req, res, async (account) => {
    const reference = String(req.body?.subjectPlayerId ?? '').trim()
    const subjectId = await getAccountStore().getProfile(reference) ? reference : await getAccountStore().findPlayerIdBySubject(reference)
    const category = String(req.body?.category ?? '').trim()
    if (!subjectId || subjectId === account.playerId || !['harassment', 'inappropriate_drawing', 'spam', 'other'].includes(category)) { res.status(400).json({ error: 'invalid_report' }); return }
    if (!await getAccountStore().getProfile(subjectId)) { res.status(404).json({ error: 'account_not_found' }); return }
    const reportId = await getAccountStore().report(account.playerId, subjectId, category, String(req.body?.sessionId ?? '').trim() || undefined, String(req.body?.turnId ?? '').trim() || undefined)
    res.status(201).json({ reportId })
  })
})

app.delete('/api/account', async (req, res) => {
  await withAccount(req, res, async (account) => {
    await getAccountStore().requestDeletion(account.playerId)
    res.status(202).json({ status: 'deletion_requested' })
  })
})

app.get('/api/test/state/:roomId', (req, res) => {
  const key = String(req.query.key || '')
  if (key !== process.env.DRAW_DUO_TEST_ADMIN_KEY || key.length === 0) {
    res.status(403).json({ error: 'forbidden' })
    return
  }
  const room = getRoom(req.params.roomId)
  if (!room) {
    res.status(404).json({ error: 'room_not_found' })
    return
  }
  const state = room.getPublicStateForDebug?.()
  res.json(state ?? { error: 'unavailable' })
})

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`[draw-duo-server] listening on ${port}`)
})
