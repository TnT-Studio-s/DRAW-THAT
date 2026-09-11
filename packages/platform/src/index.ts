import { CLIENT_BUILD_ID, PROTOCOL_MAJOR, RULES_VERSION, type PlatformId } from '@drawduo/protocol'

export interface PlatformCapabilities {
  platformId: PlatformId
  fullscreen: boolean
  supportsReduceMotion: boolean
  canStoreLocalCredentials: boolean
  canOpenExternalLinks: boolean
  hasNativeAudio: boolean
}

export interface SessionIdentity {
  userId: string
}

export interface PlatformBridge {
  platformId: PlatformId
  backendHttpUrl?: string
  backendWsUrl?: string
  capabilities?: string[]
  requestFullscreen?: () => Promise<void>
  exitFullscreen?: () => Promise<void>
  getAccessToken?: () => Promise<string | null>
}

export interface ClientRuntimeConfig {
  platformId: PlatformId
  backendHttpUrl: string
  backendWsUrl: string
  buildId: string
  protocolMajor: number
  rulesVersion: string
  capabilities: string[]
}

function currentBridge(): PlatformBridge | undefined {
  return (globalThis as typeof globalThis & { drawDuoPlatform?: PlatformBridge }).drawDuoPlatform
}

export function getClientRuntimeConfig(): ClientRuntimeConfig {
  const bridge = currentBridge()
  const capacitor = (globalThis as typeof globalThis & { Capacitor?: { getPlatform?: () => string } }).Capacitor
  const detectedPlatform = capacitor?.getPlatform?.() === 'android' ? 'android' : bridge?.platformId
  const platformId: PlatformId = detectedPlatform === 'android' ? 'android' : detectedPlatform === 'windows' ? 'windows' : 'web-dev'
  const backendHttpUrl = bridge?.backendHttpUrl ?? 'http://127.0.0.1:2567'
  const backendWsUrl = bridge?.backendWsUrl ?? backendHttpUrl.replace(/^http/, 'ws')
  return {
    platformId,
    backendHttpUrl,
    backendWsUrl,
    buildId: CLIENT_BUILD_ID,
    protocolMajor: PROTOCOL_MAJOR,
    rulesVersion: RULES_VERSION,
    capabilities: bridge?.capabilities ?? ['canvas', 'letter-bank', 'rematch'],
  }
}

export async function getClientAccessToken(): Promise<string | null> {
  return await currentBridge()?.getAccessToken?.() ?? null
}

export interface PlatformAdapter {
  capabilities(): PlatformCapabilities
  requestFullscreen(): Promise<void>
  exitFullscreen(): Promise<void>
  persistIdentity(userId: string): Promise<void>
  clearIdentity(): Promise<void>
}

export function browserAdapter(): PlatformAdapter {
  const persistKey = 'draw-duo-user-id'
  return {
    capabilities: () => ({
      platformId: 'web-dev',
      fullscreen: typeof document !== 'undefined' && !!document.documentElement.requestFullscreen,
      supportsReduceMotion: false,
      canStoreLocalCredentials: typeof window !== 'undefined' && typeof window.localStorage !== 'undefined',
      canOpenExternalLinks: true,
      hasNativeAudio: true,
    }),
    requestFullscreen: async () => {
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    },
    exitFullscreen: async () => {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen()
      }
    },
    persistIdentity: async (userId) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(persistKey, userId)
      }
    },
    clearIdentity: async () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(persistKey)
      }
    },
  }
}
