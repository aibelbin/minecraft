/**
 * Self-Defense Tool
 * Defends the bot when attacked - fights back or runs away based on health/hunger
 */
const { Movements, goals } = require('mineflayer-pathfinder')

module.exports = function selfDefense(bot) {
    console.log('[SelfDefense] Tool loaded')

    // Check if bot should run away based on health and hunger
    function shouldRunAway() {
        const health = bot.health
        const food = bot.food

        // Run away if health is below 8 (4 hearts) OR hunger is below 4
        return health < 8 || food < 4
    }

    // Run away from an entity
    function runAway(entity) {
        if (!entity) return

        const mcData = require('minecraft-data')(bot.version)
        bot.pathfinder.setMovements(new Movements(bot, mcData))

        // Calculate direction away from the entity
        const dx = bot.entity.position.x - entity.position.x
        const dz = bot.entity.position.z - entity.position.z
        const distance = Math.sqrt(dx * dx + dz * dz)

        if (distance === 0) return

        // Run 20 blocks away in the opposite direction
        const runDistance = 20
        const targetX = bot.entity.position.x + (dx / distance) * runDistance
        const targetZ = bot.entity.position.z + (dz / distance) * runDistance

        bot.pathfinder.setGoal(new goals.GoalXZ(targetX, targetZ), true)
        bot.chat(`Running away! Health: ${bot.health.toFixed(1)}, Hunger: ${bot.food}`)
    }

    // Main self-defense logic
    bot.on('entityHurt', (entity) => {
        // Check if the bot was hurt
        if (entity !== bot.entity) return

        // Find who attacked us
        const attacker = bot.nearestEntity(e =>
            e.type === 'player' &&
            e.position.distanceTo(bot.entity.position) < 8
        )

        if (!attacker) return

        // Check if we should run away or fight back
        if (shouldRunAway()) {
            // Stop any current attack and run
            bot.pvp.stop()
            runAway(attacker)
        } else {
            // Fight back
            bot.pvp.attack(attacker)
            bot.chat(`Defending myself against ${attacker.username || attacker.name}!`)
        }
    })

    // Status check command
    bot.on('chat', (username, message) => {
        if (username === bot.username) return

        if (message === 'status') {
            bot.chat(`Health: ${bot.health.toFixed(1)}/20, Hunger: ${bot.food}/20`)
        }
    })

    bot.on('spawn', () => {
        console.log('[SelfDefense] Bot spawned - self-defense mode active')
    })

    // Return public API
    return {
        shouldRunAway,
        runAway
    }
}
