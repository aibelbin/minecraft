const { loader: autoEat } = require('mineflayer-auto-eat')

function selfSustain(bot) {
    console.error("Self sustain bot loaded")

    bot.loadPlugin(autoEat)

    bot.once('spawn', () => {
        bot.autoEat.enableAuto()

        bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 4,
            bannedFood: ['rotten_flesh','spider_eye']
        }

        bot.autoEat.on('eatStart', (opts) => {
            console.log(`Started eating ${opts.food.name} in ${opts.offhand ? 'offhand' : 'hand'}`)
        })

        bot.autoEat.on('eatFinish', (opts) => {
            console.log(`Finished eating ${opts.food.name}`)
        })

        bot.autoEat.on('eatFail', (error) => {
            console.error('Eating failed:', error)
        })
    })
}

module.exports = selfSustain
