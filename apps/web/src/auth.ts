import { createAuthClient } from '@neondatabase/auth'
import { getClientAccessToken as getPlatformAccessToken } from '@drawduo/platform'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim()
const authClient = authUrl ? createAuthClient(authUrl) : null

export const neonAuthConfigured = authClient !== null

export type AuthUser = {
  id: string
  name?: string
  email?: string
}

function toAuthUser(user: { id: string; name?: string; email?: string } | null | undefined): AuthUser | null {
  return user?.id ? { id: user.id, name: user.name, email: user.email } : null
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (!authClient) return null
  const result = await authClient.getSession()
  if (result.error) throw new Error(result.error.message || 'auth_session_failed')
  return result.data?.session ? toAuthUser(result.data.user) : null
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser | null> {
  if (!authClient) throw new Error('auth_not_configured')
  const result = await authClient.signIn.email({ email, password })
  if (result.error) throw new Error(result.error.message || 'sign_in_failed')
  return getAuthUser()
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<AuthUser | null> {
  if (!authClient) throw new Error('auth_not_configured')
  const result = await authClient.signUp.email({ email, password, name })
  if (result.error) throw new Error(result.error.message || 'sign_up_failed')
  return getAuthUser()
}

export async function signOutNeonAuth(): Promise<void> {
  if (!authClient) return
  const result = await authClient.signOut()
  if (result.error) throw new Error(result.error.message || 'sign_out_failed')
}

export async function getClientAccessToken(): Promise<string | null> {
  if (authClient) {
    try {
      const result = await authClient.getSession()
      const token = result.data?.session?.token
      if (typeof token === 'string' && token.length > 0) return token
    } catch {
      // Fall back to a native platform bridge when the browser auth service is unavailable.
    }
  }
  return getPlatformAccessToken()
}
