import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.drawduo.playtest',
  appName: 'Draw Duo',
  webDir: '../web/dist',
  android: {
    backgroundColor: '#f6f0e7',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
