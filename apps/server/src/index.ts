import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchMaker, Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { MIN_SUPPORTED_BUILD_ID, PROTOCOL_MAJOR, RULES_VERSION, zClientHello } from '@drawduo/protocol'
import { DrawDuoRoom } from './rooms/DrawDuoRoom.js'
import { getCodeByRoom, getInviteOwner, registerPrivateRoom, resolveCode } from './services/MatchmakerState.js'
import { claimQuickRoom, releaseQuickRoom, setQuickRoom } from './services/QuickMatchRegistry.js'
import { getRoom } from './services/RoomRegistry.js'
import { authenticateRequest } from './services/AuthService.js'
import { getAccountStore, type AccountProfile } from './services/AccountStore.js'
import { getEvidenceStore } from './services/EvidenceStore.js'
import { findProjectRoot } from './services/ProjectPaths.js'
import { PostgresDriver, PostgresPresence } from './services/ColyseusPostgres.js'

const port = Number(process.env.PORT || 2567)
const moderatorSubjects = new Set(
  (process.env.DRAW_DUO_MODERATOR_SUBJECTS ?? process.env.DRAW_DUO_STAFF_SUBJECTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)
export const app = express()
app.use(cors({ optionsSuccessStatus: 200 }))
app.use(express.json())
let acceptingAdmissions = true

function rejectWhenDraining(res: Response) {
  if (acceptingAdmissions) return false
  res.status(503).json({ error: 'server_draining' })
  return true
}

export const httpServer = createServer(app)
const distributedMatchmaking = process.env.DRAW_DUO_FUNCTION === '1' && Boolean(process.env.DATABASE_URL)
export const gameServer = new Server({
  ...(distributedMatchmaking ? { driver: new PostgresDriver(), presence: new PostgresPresence() } : {}),
  transport: new WebSocketTransport({ server: httpServer }),
})

gameServer.define('drawduo', DrawDuoRoom)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: Date.now(), acceptingAdmissions })
})

app.get('/api/ready', async (_req, res) => {
  if (!acceptingAdmissions) {
    res.status(503).json({ ok: false, error: 'server_draining' })
    return
  }
  try {
    await getAccountStore().getCatalog()
    res.json({ ok: true, persistence: process.env.DATABASE_URL ? 'postgres' : 'memory' })
  } catch (error) {
    res.status(503).json({ ok: false, error: error instanceof Error ? error.message : 'not_ready' })
  }
})

app.get('/api/version', (_req, res) => {
  res.json({ app: 'draw-duo', phase: 2, version: '0.2.0', protocolMajor: PROTOCOL_MAJOR, rulesVersion: RULES_VERSION, minimumBuildId: MIN_SUPPORTED_BUILD_ID })
})

app.get('/admin/moderation', (_req, res) => {
  try {
    res.sendFile(path.join(findProjectRoot(path.dirname(fileURLToPath(import.meta.url))), 'admin', 'moderation.html'))
  } catch {
    res.status(404).end()
  }
})

app.post('/api/lobby/private/create', async (req, res) => {
  if (rejectWhenDraining(res)) return
  try {
    const room = await matchMaker.createRoom('drawduo', {})
    let ownerPlayerId: string | undefined
    try {
      const identity = await authenticateRequest(req)
      ownerPlayerId = (await getAccountStore().ensurePlayer(identity.subject, identity.displayName)).playerId
    } catch {
      if (process.env.NODE_ENV !== 'development' && process.env.DRAW_DUO_TEST_MODE !== '1') throw new Error('authentication_required')
    }
    const code = await registerPrivateRoom(room.roomId, ownerPlayerId)
    res.json({ roomId: room.roomId, roomCode: code.roomCode, status: 'created' })
  } catch {
    res.status(500).json({ error: 'failed_to_create' })
  }
})

app.post('/api/lobby/private/join', async (req, res) => {
  if (rejectWhenDraining(res)) return
  const code = String(req.body?.code ?? '')
  const roomId = await resolveCode(code)
  if (!roomId) {
    res.status(404).json({ error: 'invalid_or_expired_code' })
    return
  }
  try {
    const ownerPlayerId = await getInviteOwner(code)
    if (ownerPlayerId) {
      const identity = await authenticateRequest(req)
      const joiner = await getAccountStore().ensurePlayer(identity.subject, identity.displayName)
      if (await getAccountStore().areBlocked(ownerPlayerId, joiner.playerId)) {
        res.status(403).json({ error: 'blocked_user' })
        return
      }
    }
    const roomInstance = getRoom(roomId)
    const listing = (await matchMaker.query({ roomId }))[0]
    const codeFromRoom = await getCodeByRoom(roomId)
    if ((roomInstance?.clients?.length ?? listing?.clients ?? 0) >= 2) {
      res.status(409).json({ error: 'room_full' })
      return
    }
    res.json({ roomId, roomCode: codeFromRoom ?? code })
  } catch (_error) {
    res.status(404).json({ error: 'room_not_found' })
  }
})

app.post('/api/match/quick', async (_req, res) => {
  if (rejectWhenDraining(res)) return
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

async function withModerator(req: Request, res: Response, work: (staffSubject: string) => Promise<void>) {
  const moderationSecret = req.header('x-moderation-key')
  if (moderationSecret && moderationSecret === process.env.DRAW_DUO_MODERATION_KEY) {
    return work('service-admin')
  }
  if (process.env.DRAW_DUO_TEST_MODE === '1' && moderationSecret && moderationSecret === process.env.DRAW_DUO_TEST_ADMIN_KEY) {
    return work('test-moderator')
  }
  let identity: Awaited<ReturnType<typeof authenticateRequest>>
  try {
    identity = await authenticateRequest(req)
  } catch {
    res.status(403).json({ error: 'forbidden' })
    return
  }
  if (!moderatorSubjects.has(identity.subject)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }
  return work(identity.subject)
}

async function withOperations(req: Request, res: Response, work: () => Promise<void>) {
  const requestKey = req.header('x-operations-key')
  const configuredKey = process.env.DRAW_DUO_OPERATIONS_KEY
  const testKey = process.env.DRAW_DUO_TEST_ADMIN_KEY
  if ((configuredKey && requestKey === configuredKey) || (process.env.DRAW_DUO_TEST_MODE === '1' && testKey && requestKey === testKey)) {
    await work()
    return
  }
  res.status(403).json({ error: 'forbidden' })
}

app.post('/api/admin/admission', async (req, res) => {
  await withOperations(req, res, async () => {
    if (typeof req.body?.accepting !== 'boolean') {
      res.status(400).json({ error: 'invalid_admission_state' })
      return
    }
    acceptingAdmissions = req.body.accepting
    res.json({ acceptingAdmissions })
  })
})

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

app.post('/api/account/recover', async (req, res) => {
  await withAccount(req, res, async (account) => {
    res.json({ recovered: true, account })
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

app.post('/api/progression/equip', async (req, res) => {
  await withAccount(req, res, async (account) => {
    const itemId = String(req.body?.itemId ?? '').trim()
    const slot = req.body?.slot === undefined ? undefined : String(req.body.slot).trim()
    if (!itemId || itemId.length > 128) { res.status(400).json({ error: 'invalid_equip_request' }); return }
    if (slot !== undefined && (slot.length < 1 || slot.length > 64)) { res.status(400).json({ error: 'invalid_equip_request' }); return }
    res.json(await getAccountStore().equipCosmetic(account.playerId, itemId, slot as Parameters<ReturnType<typeof getAccountStore>['equipCosmetic']>[2]))
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
    const sessionId = String(req.body?.sessionId ?? '').trim() || undefined
    const turnId = String(req.body?.turnId ?? '').trim() || undefined
    const reportId = await getAccountStore().report(account.playerId, subjectId, category, sessionId, turnId)
    if (sessionId && turnId) await getEvidenceStore().retain(sessionId, turnId, 30 * 24 * 60 * 60 * 1000)
    res.status(201).json({ reportId })
  })
})

app.get('/api/safety/admin/reports', async (req, res) => {
  await withModerator(req, res, async () => {
    const status = String(req.query.status ?? 'open').trim() === 'reviewed' ? 'reviewed' : 'open'
    const reports = await getAccountStore().listReports(status)
    res.json({ reports })
  })
})

app.get('/api/safety/admin/reports/:reportId/evidence', async (req, res) => {
  await withModerator(req, res, async (staffSubject) => {
    const report = await getAccountStore().findReport(req.params.reportId)
    if (!report) { res.status(404).json({ error: 'report_not_found' }); return }
    if (!report.sessionId || !report.turnId) { res.json({ reportId: report.reportId, sessionId: null, turnId: null, events: [] }); return }
    const evidence = await getEvidenceStore().get(report.sessionId, report.turnId)
    if (!evidence) { res.status(404).json({ error: 'evidence_expired' }); return }
    await getEvidenceStore().logAccess(staffSubject, report.sessionId, report.turnId)
    res.json({ reportId: report.reportId, ...evidence })
  })
})

app.post('/api/safety/admin/reports/:reportId/review', async (req, res) => {
  await withModerator(req, res, async (staffSubject) => {
    const action = String(req.body?.action ?? '').trim()
    const reason = String(req.body?.reason ?? '').trim()
    if (!['no_action', 'suspend_account', 'remove_content'].includes(action) || !reason || action.length > 128 || reason.length > 1024) {
      res.status(400).json({ error: 'invalid_review_request' })
      return
    }
    const report = action === 'remove_content' ? await getAccountStore().findReport(req.params.reportId) : null
    await getAccountStore().reviewReport(req.params.reportId, staffSubject, action, reason)
    if (report?.sessionId && report.turnId) await getEvidenceStore().remove(report.sessionId, report.turnId)
    res.status(204).end()
  })
})

const evidenceCleanupTimer = setInterval(() => { void getEvidenceStore().purgeExpired() }, 60 * 60 * 1000)
evidenceCleanupTimer.unref()

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

if (process.env.DRAW_DUO_FUNCTION !== '1') {
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[draw-duo-server] listening on ${port}`)
  })
}
