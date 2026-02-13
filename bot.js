const mineflayer = require('mineflayer')
const pvp = require('mineflayer-pvp').plugin
const { pathfinder } = require('mineflayer-pathfinder')
const armorManager = require('mineflayer-armor-manager')

const options = {
    host: process.env.MC_HOST ?? 'localhost',
    port: Number(process.env.MC_PORT ?? 22122),
    username: process.env.MC_USERNAME ?? 'MiniProj_BOT',
}

const bot = mineflayer.createBot(options)

// Load all plugins once
bot.loadPlugin(pvp)
bot.loadPlugin(armorManager)
bot.loadPlugin(pathfinder)

// Viewer setup
bot.once('spawn', () => {
    // Disable viewer by default when running as MCP server (stdout must be JSON-RPC only)
    // Set ENABLE_VIEWER=true to override
    if (process.env.ENABLE_VIEWER !== 'true') {
        console.error('[viewer] disabled (set ENABLE_VIEWER=true to enable)')
        return
    }
    
    const viewerPort = Number(process.env.VIEWER_PORT ?? 3000)
    try {
        const { mineflayer: mineflayerViewer } = require('prismarine-viewer')
        mineflayerViewer(bot, { port: viewerPort, firstPerson: true })
        console.error(`[viewer] running at http://localhost:${viewerPort}`)
    } catch (err) {
        console.error(`[viewer] not available: ${err.message}`)
    }
})

bot.on('kicked', (reason) => console.error('Kicked for', reason))
bot.on('error', (err) => console.error('Error:', err))

module.exports = bot
