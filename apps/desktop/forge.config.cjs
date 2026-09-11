const path = require('node:path')
const fs = require('node:fs')
const { MakerSquirrel } = require('@electron-forge/maker-squirrel')

const runtimeConfig = path.resolve(__dirname, 'draw-duo-runtime.json')
const extraResource = [path.resolve(__dirname, '../web/dist')]
if (fs.existsSync(runtimeConfig)) extraResource.push(runtimeConfig)

module.exports = {
  packagerConfig: {
    asar: true,
    overwrite: true,
    executableName: 'DrawDuo',
    extraResource,
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({ name: 'draw_duo', authors: 'Draw Duo', description: 'A private two-player drawing game.' })],
}
