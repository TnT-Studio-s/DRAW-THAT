import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDevelopment = process.env.DRAW_DUO_DESKTOP_DEV === '1' || !app.isPackaged
let mainWindow

function isAllowedNavigation(url) {
  return isDevelopment
    ? url.startsWith('http://127.0.0.1:5173') || url.startsWith('http://localhost:5173')
    : url.startsWith('file:')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f6f0e7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault()
  })

  if (isDevelopment) {
    void mainWindow.loadURL(process.env.DRAW_DUO_WEB_URL || 'http://127.0.0.1:5173')
  } else {
    void mainWindow.loadFile(path.join(process.resourcesPath, 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; connect-src 'self' http://127.0.0.1:2567 ws://127.0.0.1:2567; style-src 'self' 'unsafe-inline'; script-src 'self'" ] } })
      return
    }
    callback({})
  })
  ipcMain.handle('drawduo:set-fullscreen', (_event, enabled) => {
    mainWindow?.setFullScreen(Boolean(enabled))
  })
  ipcMain.handle('drawduo:open-external', (_event, url) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('external_url_not_allowed')
    return shell.openExternal(url)
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
