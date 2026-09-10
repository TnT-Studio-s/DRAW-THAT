import { contextBridge, ipcRenderer } from 'electron'

const httpUrl = process.env.DRAW_DUO_BACKEND_HTTP_URL || 'http://127.0.0.1:2567'
const wsUrl = process.env.DRAW_DUO_BACKEND_WS_URL || httpUrl.replace(/^http/, 'ws')

contextBridge.exposeInMainWorld('drawDuoPlatform', Object.freeze({
  platformId: 'windows',
  backendHttpUrl: httpUrl,
  backendWsUrl: wsUrl,
  capabilities: ['canvas', 'letter-bank', 'rematch', 'fullscreen'],
  requestFullscreen: () => ipcRenderer.invoke('drawduo:set-fullscreen', true),
  exitFullscreen: () => ipcRenderer.invoke('drawduo:set-fullscreen', false),
  openExternal: (url) => ipcRenderer.invoke('drawduo:open-external', url),
}))
