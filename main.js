// Import the single bot instance
const bot = require('./bot')

// Import all tools
const autoEquip = require('./tools/autoEquip')
const guard = require('./tools/guard')
const selfDefense = require('./tools/selfDefense')

// Initialize all tools with the same bot instance
console.log('Initializing tools...')
autoEquip(bot)
guard(bot)
selfDefense(bot)

console.log('All tools loaded successfully!')
console.log('Bot is ready!')

// Simple echo chat (optional - can be removed if not needed)
bot.on('chat', (username, message) => {
    if (username === bot.username) return
    
    // Echo messages that are not commands
    if (!['guard', 'stop', 'status'].includes(message)) {
        bot.chat(message)
    }
})
