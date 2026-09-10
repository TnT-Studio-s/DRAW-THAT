const path = require('node:path')
const { MakerSquirrel } = require('@electron-forge/maker-squirrel')

module.exports = {
  packagerConfig: {
    asar: true,
    overwrite: true,
    extraResource: [path.resolve(__dirname, '../web/dist')],
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({ name: 'draw_duo', authors: 'Draw Duo', description: 'A private two-player drawing game.' })],
}
