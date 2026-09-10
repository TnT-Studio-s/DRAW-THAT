import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Request } from 'express'

export type RequestIdentity = { subject: string; displayName?: string }

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export async function authenticateRequest(request: Request): Promise<RequestIdentity> {
  const authorization = request.header('authorization')
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()
    const jwksUrl = process.env.SUPABASE_JWKS_URL
    const issuer = process.env.SUPABASE_ISSUER
    const audience = process.env.SUPABASE_AUDIENCE
    if (!jwksUrl || !issuer || !audience) throw new Error('auth_provider_not_configured')
    const jwks = jwksCache.get(jwksUrl) ?? createRemoteJWKSet(new URL(jwksUrl))
    jwksCache.set(jwksUrl, jwks)
    const verified = await jwtVerify(token, jwks, { issuer, audience })
    if (typeof verified.payload.sub !== 'string' || verified.payload.sub.length === 0) throw new Error('invalid_identity')
    return { subject: verified.payload.sub, displayName: typeof verified.payload.email === 'string' ? verified.payload.email : undefined }
  }

  if (process.env.DRAW_DUO_TEST_MODE === '1' || process.env.NODE_ENV === 'development') {
    const subject = request.header('x-draw-duo-user')?.trim()
    if (subject) return { subject }
  }
  throw new Error('authentication_required')
}

export async function authenticateBearerToken(token: string): Promise<RequestIdentity> {
  const request = {
    header(name: string) {
      return name.toLowerCase() === 'authorization' ? `Bearer ${token}` : undefined
    },
  } as Request
  return authenticateRequest(request)
}
