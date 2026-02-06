const mineflayer = require('mineflayer')

const options = {
    host: process.env.MC_HOST ?? 'localhost',
    port: Number(process.env.MC_PORT ?? 22122),
    username: process.env.MC_USERNAME ?? 'MiniProj_BOT',
  
}
const bot = mineflayer.createBot(options)

bot.once('spawn', () => {
  const viewerPort = Number(process.env.VIEWER_PORT ?? 3000)
  try {
    const { mineflayer: mineflayerViewer } = require('prismarine-viewer')
    mineflayerViewer(bot, { port: viewerPort, firstPerson: true })
    console.log(`[viewer] running at http://localhost:${viewerPort}`)
  } catch (err) {
  }
})

bot.on('chat', (username, message) => {
    if (username === bot.username) return 
    bot.chat(message)
})
