/**
 * Guard Tool
 * Guards a position and attacks nearby hostile mobs OR actively protects a player
 */
const { Movements, goals } = require('mineflayer-pathfinder')

module.exports = function guard(bot) {
    console.error('[Guard] Tool loaded')

    let guardPos = null
    let guardPlayerName = null

    function guardArea(pos) {
        guardPos = pos.clone()
        guardPlayerName = null // Clear player guard mode

        if (!bot.pvp.target) {
            moveToGuardPos()
        }
    }

    function guardPlayer(playerName) {
        guardPlayerName = playerName
        guardPos = null // Clear position guard mode
        console.error(`[Guard] Now protecting player: ${playerName}`)
    }

    function stopGuarding() {
        guardPos = null
        guardPlayerName = null
        bot.pvp.stop()
        bot.pathfinder.setGoal(null)
    }

    function getGuardPosition() {
        return guardPos
    }

    function getGuardedPlayer() {
        return guardPlayerName
    }

    function moveToGuardPos() {
        const mcData = require('minecraft-data')(bot.version)
        bot.pathfinder.setMovements(new Movements(bot, mcData))
        bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z))
    }

    function followPlayer(player) {
        const mcData = require('minecraft-data')(bot.version)
        bot.pathfinder.setMovements(new Movements(bot, mcData))
        // Stay within 3 blocks of the player
        bot.pathfinder.setGoal(new goals.GoalFollow(player, 3), true)
    }

    // Return to guard position/player after attacking
    bot.on('stoppedAttacking', () => {
        if (guardPos) {
            moveToGuardPos()
        } else if (guardPlayerName) {
            const player = bot.players[guardPlayerName]
            if (player && player.entity) {
                followPlayer(player.entity)
            }
        }
    })

    // Look at nearby entities when idle
    bot.on('physicsTick', () => {
        if (bot.pvp.target) return
        if (bot.pathfinder.isMoving()) return

        const entity = bot.nearestEntity()
        if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0))
    })

    // Guard position mode: Attack nearby hostile mobs
    bot.on('physicsTick', () => {
        if (!guardPos) return

        const filter = e => e.type === 'mob' && 
                           e.position.distanceTo(bot.entity.position) < 16 &&
                           e.mobType !== 'Armor Stand'

        const entity = bot.nearestEntity(filter)
        if (entity) {
            bot.pvp.attack(entity)
        }
    })

    // Guard player mode: Follow and protect from ALL threats
    bot.on('physicsTick', () => {
        if (!guardPlayerName) return

        const player = bot.players[guardPlayerName]
        
        // Check if player is still visible
        if (!player || !player.entity) {
            console.error(`[Guard] Lost sight of player ${guardPlayerName}`)
            return
        }

        // Update following position if not attacking
        if (!bot.pvp.target) {
            const distance = bot.entity.position.distanceTo(player.entity.position)
            // Only update goal if player moved significantly (> 4 blocks away)
            if (distance > 4) {
                followPlayer(player.entity)
            }
        }

        // Attack any entity (player or mob) that gets too close to the guarded player
        // Exclude the guarded player themselves and the bot
        const threats = Object.values(bot.entities).filter(e => {
            if (e === bot.entity) return false
            if (e === player.entity) return false
            if (e.type !== 'player' && e.type !== 'mob') return false
            if (e.type === 'mob' && e.mobType === 'Armor Stand') return false
            
            // Check if entity is within 8 blocks of the guarded player
            const distanceToPlayer = e.position.distanceTo(player.entity.position)
            return distanceToPlayer < 8
        })

        // Attack the closest threat
        if (threats.length > 0) {
            threats.sort((a, b) => {
                return a.position.distanceTo(player.entity.position) - 
                       b.position.distanceTo(player.entity.position)
            })
            bot.pvp.attack(threats[0])
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

        if (message === 'protect me') {
            const player = bot.players[username]

            if (!player) {
                bot.chat("I can't see you.")
                return
            }

            bot.chat(`I will protect you, ${username}!`)
            guardPlayer(username)
        }

        if (message === 'stop') {
            bot.chat('I will no longer guard this area.')
            stopGuarding()
        }
    })

    // Return public API
    return {
        guardArea,
        guardPlayer,
        stopGuarding,
        getGuardPosition,
        getGuardedPlayer
    }
}
