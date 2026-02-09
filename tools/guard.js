/**
 * Guard Tool
 * Guards a position and attacks nearby hostile mobs
 */
const { Movements, goals } = require('mineflayer-pathfinder')

module.exports = function guard(bot) {
    console.log('[Guard] Tool loaded')

    let guardPos = null

    function guardArea(pos) {
        guardPos = pos.clone()

        if (!bot.pvp.target) {
            moveToGuardPos()
        }
    }

    function stopGuarding() {
        guardPos = null
        bot.pvp.stop()
        bot.pathfinder.setGoal(null)
    }

    function getGuardPosition() {
        return guardPos
    }

    function moveToGuardPos() {
        const mcData = require('minecraft-data')(bot.version)
        bot.pathfinder.setMovements(new Movements(bot, mcData))
        bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z))
    }

    // Return to guard position after attacking
    bot.on('stoppedAttacking', () => {
        if (guardPos) {
            moveToGuardPos()
        }
    })

    // Look at nearby entities when idle
    bot.on('physicTick', () => {
        if (bot.pvp.target) return
        if (bot.pathfinder.isMoving()) return

        const entity = bot.nearestEntity()
        if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0))
    })

    // Attack nearby hostile mobs when guarding
    bot.on('physicTick', () => {
        if (!guardPos) return

        const filter = e => e.type === 'mob' && 
                           e.position.distanceTo(bot.entity.position) < 16 &&
                           e.mobType !== 'Armor Stand'

        const entity = bot.nearestEntity(filter)
        if (entity) {
            bot.pvp.attack(entity)
        }
    })

    // Chat commands
    bot.on('chat', (username, message) => {
        if (username === bot.username) return

        if (message === 'guard') {
            const player = bot.players[username]

            if (!player) {
                bot.chat("I can't see you.")
                return
            }

            bot.chat('I will guard that location.')
            guardArea(player.entity.position)
        }

        if (message === 'stop') {
            bot.chat('I will no longer guard this area.')
            stopGuarding()
        }
    })

    // Return public API
    return {
        guardArea,
        stopGuarding,
        getGuardPosition
    }
}
