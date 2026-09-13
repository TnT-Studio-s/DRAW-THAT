import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import type { Duplex } from 'node:stream'
import { matchMaker } from '@colyseus/core'
import { gameServer, httpServer } from './index.js'

const matchmakerReady = matchMaker.accept()

type HeaderValue = string | string[] | number

class FetchResponse extends EventEmitter {
  statusCode = 200
  statusMessage = ''
  finished = false
  private headersAreSent = false
  private readonly chunks: Buffer[] = []
  private readonly responseHeaders = new Map<string, { name: string; value: HeaderValue }>()

  constructor(readonly req: IncomingMessage) {
    super()
    const methods = {
      setHeader: this.setHeader,
      getHeader: this.getHeader,
      getHeaders: this.getHeaders,
      getHeaderNames: this.getHeaderNames,
      hasHeader: this.hasHeader,
      removeHeader: this.removeHeader,
      writeHead: this.writeHead,
      write: this.write,
      end: this.end,
      flushHeaders: this.flushHeaders,
      setTimeout: this.setTimeout,
      destroy: this.destroy,
      toResponse: this.toResponse,
    }
    for (const [name, method] of Object.entries(methods)) {
      Object.defineProperty(this, name, { configurable: true, value: method.bind(this), writable: true })
    }
    Object.defineProperty(this, 'headersSent', { configurable: true, get: () => this.headersAreSent })
    Object.defineProperty(this, 'writableEnded', { configurable: true, get: () => this.finished })
    Object.defineProperty(this, 'writableFinished', { configurable: true, get: () => this.finished })
  }

  setHeader(name: string, value: HeaderValue) {
    this.responseHeaders.set(name.toLowerCase(), { name, value })
    return this
  }

  getHeader(name: string) {
    return this.responseHeaders.get(name.toLowerCase())?.value
  }

  getHeaders() {
    return Object.fromEntries([...this.responseHeaders].map(([name, entry]) => [name, entry.value]))
  }

  getHeaderNames() {
    return [...this.responseHeaders.keys()]
  }

  hasHeader(name: string) {
    return this.responseHeaders.has(name.toLowerCase())
  }

  removeHeader(name: string) {
    this.responseHeaders.delete(name.toLowerCase())
  }

  writeHead(statusCode: number, statusMessageOrHeaders?: string | Record<string, HeaderValue>, headers?: Record<string, HeaderValue>) {
    this.statusCode = statusCode
    if (typeof statusMessageOrHeaders === 'string') {
      this.statusMessage = statusMessageOrHeaders
      this.setHeaders(headers)
    } else {
      this.setHeaders(statusMessageOrHeaders)
    }
    this.headersAreSent = true
    return this
  }

  write(chunk: Uint8Array | string, encoding?: BufferEncoding) {
    if (this.finished) return false
    this.headersAreSent = true
    this.chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding) : Buffer.from(chunk))
    return true
  }

  end(chunk?: Uint8Array | string | (() => void), encoding?: BufferEncoding, callback?: () => void) {
    const done = typeof chunk === 'function' ? chunk : callback
    if (typeof chunk !== 'function' && chunk !== undefined) this.write(chunk, encoding)
    if (this.finished) return this
    this.headersAreSent = true
    this.finished = true
    queueMicrotask(() => {
      this.emit('finish')
      this.emit('close')
      done?.()
    })
    return this
  }

  flushHeaders() {
    this.headersAreSent = true
  }

  setTimeout(_milliseconds: number, callback?: () => void) {
    callback?.()
    return this
  }

  destroy(error?: Error) {
    if (error) this.emit('error', error)
    if (!this.finished) this.end()
    return this
  }

  toResponse() {
    const headers = new Headers()
    for (const { name, value } of this.responseHeaders.values()) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, String(item))
      } else {
        headers.set(name, String(value))
      }
    }
    const empty = this.statusCode === 204 || this.statusCode === 304
    const status = this.statusCode === 204 ? 200 : this.statusCode
    const body = empty ? (this.statusCode === 204 ? 'null' : null) : Buffer.concat(this.chunks)
    return new Response(body, { status, headers })
  }

  private setHeaders(headers?: Record<string, HeaderValue>) {
    if (!headers) return
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value)
  }
}

function toNodeRequest(request: Request, body: Buffer) {
  const url = new URL(request.url)
  const socket = new EventEmitter() as EventEmitter & { encrypted?: boolean; readable: boolean; writable: boolean }
  socket.encrypted = url.protocol === 'https:'
  socket.readable = true
  socket.writable = true
  const nodeRequest = Readable.from(body.length ? [body] : []) as Readable & IncomingMessage
  Object.assign(nodeRequest, {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: { ...Object.fromEntries(request.headers.entries()), host: url.host },
    rawHeaders: [...request.headers].flatMap(([name, value]) => [name, value]),
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    socket,
    connection: socket,
    complete: false,
    aborted: false,
    trailers: {},
  })
  nodeRequest.once('end', () => { nodeRequest.complete = true })
  return nodeRequest
}

async function fetchHandler(request: Request) {
  await matchmakerReady
  const body = request.body ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0)
  const nodeRequest = toNodeRequest(request, body)
  const nodeResponse = new FetchResponse(nodeRequest)
  const finished = new Promise<void>((resolve, reject) => {
    nodeResponse.once('finish', resolve)
    nodeResponse.once('error', reject)
  })
  httpServer.emit('request', nodeRequest, nodeResponse)
  await finished
  return nodeResponse.toResponse()
}

type TransportWithSocketServer = { wss: { handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer, callback: (client: unknown) => void) => void; emit: (event: string, client: unknown, req: IncomingMessage) => void } }

export default {
  fetch: fetchHandler,
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const transport = gameServer.transport as unknown as TransportWithSocketServer
    transport.wss.handleUpgrade(req, socket, head, (client) => transport.wss.emit('connection', client, req))
  },
}
